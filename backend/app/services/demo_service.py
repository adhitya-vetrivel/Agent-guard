import asyncio
import json
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import async_session_factory
from app.services.agent_service import AgentService
from app.services.policy_service import PolicyService
from app.services.risk_service import RiskService
from app.services.behavior_service import BehaviorService
from app.services.audit_service import AuditService
from app.services.honeytools import is_honeytool
from app.models.agent import Agent, AgentStatus
from app.models.tool_call import ToolCall
from app.models.audit_log import AuditLog, AuditAction
from app.models.risk_event import RiskEvent, RiskSeverity
from app.schemas.agent import AgentRegister
from app.schemas.policy import PolicyCreate
from app.models.user import User, UserRole
from app.security.auth import hash_password
from sqlalchemy import select
import uuid


DEMO_AGENTS = [
    {
        "name": "ResearchAgent",
        "role": "research",
        "capabilities": ["web_search", "read_file", "summarize", "extract_data", "analyze_document"],
    },
    {
        "name": "FinanceAgent",
        "role": "finance",
        "capabilities": ["read_file", "calculate", "list_files", "analyze_spreadsheet", "generate_report"],
    },
    {
        "name": "EmailAgent",
        "role": "communication",
        "capabilities": ["read_file", "write_file", "send_message", "list_contacts", "draft_response"],
    },
    {
        "name": "DevOpsAgent",
        "role": "devops",
        "capabilities": ["read_file", "execute_command", "list_processes", "check_system", "deploy_service", "view_logs"],
    },
    {
        "name": "DataAgent",
        "role": "data",
        "capabilities": ["read_file", "query_database", "export_data", "generate_report", "analyze_dataset", "visualize"],
    },
    {
        "name": "SupportAgent",
        "role": "support",
        "capabilities": ["read_file", "search_knowledge_base", "read_ticket", "update_ticket", "send_message", "escalate"],
    },
]


TOOLS = {
    "research": ["web_search", "read_file", "summarize", "extract_data", "analyze_document", "search_database"],
    "finance": ["read_file", "calculate", "list_files", "analyze_spreadsheet", "generate_report", "query_financial_data"],
    "communication": ["read_file", "write_file", "send_message", "list_contacts", "draft_response", "read_inbox"],
    "devops": ["read_file", "execute_command", "list_processes", "check_system", "deploy_service", "view_logs"],
    "data": ["read_file", "query_database", "export_data", "generate_report", "analyze_dataset", "visualize"],
    "support": ["read_file", "search_knowledge_base", "read_ticket", "update_ticket", "send_message", "escalate"],
}

HONEYTOOLS = ["download_customer_database", "export_all_secrets", "root_shell"]

# Behavioral config per agent: (total_calls, min_risk, max_risk, denied_count, honeytool_count, burst_profile)
# burst_profile: "steady" | "bursty" | "erratic" | "low"
AGENT_PROFILES = {
    "ResearchAgent":  {"calls": 35, "risk_min": 3, "risk_max": 8, "denied": 0, "honeytools": 0, "burst": "steady"},
    "FinanceAgent":   {"calls": 55, "risk_min": 15, "risk_max": 35, "denied": 5, "honeytools": 0, "burst": "bursty"},
    "EmailAgent":     {"calls": 60, "risk_min": 60, "risk_max": 100, "denied": 8, "honeytools": 3, "burst": "erratic"},
    "DevOpsAgent":    {"calls": 90, "risk_min": 10, "risk_max": 20, "denied": 2, "honeytools": 0, "burst": "steady"},
    "DataAgent":      {"calls": 20, "risk_min": 1, "risk_max": 5, "denied": 0, "honeytools": 0, "burst": "low"},
    "SupportAgent":   {"calls": 40, "risk_min": 25, "risk_max": 50, "denied": 6, "honeytools": 0, "burst": "erratic"},
}


def _generate_timestamps(count: int, burst: str) -> list[datetime]:
    now = datetime.now(timezone.utc)
    if burst == "steady":
        hours_ago = sorted([random.uniform(0, 24) for _ in range(count)])
        return [now - timedelta(hours=h) for h in hours_ago]
    elif burst == "bursty":
        # 70% of calls in a 2-hour window, rest spread
        hours_ago = []
        for _ in range(count):
            if random.random() < 0.7:
                hours_ago.append(random.uniform(0, 2))
            else:
                hours_ago.append(random.uniform(2, 24))
        hours_ago.sort()
        return [now - timedelta(hours=h) for h in hours_ago]
    elif burst == "erratic":
        # Many calls in short windows, including late-night (4-7 hours ago)
        hours_ago = []
        for _ in range(count):
            if random.random() < 0.5:
                hours_ago.append(random.uniform(0, 1.5))
            elif random.random() < 0.3:
                hours_ago.append(random.uniform(4, 7))  # late-night cluster
            else:
                hours_ago.append(random.uniform(1.5, 24))
        hours_ago.sort()
        return [now - timedelta(hours=h) for h in hours_ago]
    else:  # low
        hours_ago = sorted([random.uniform(0, 24) for _ in range(count)])
        return [now - timedelta(hours=h) for h in hours_ago]


async def seed_demo_data():
    async with async_session_factory() as session:
        existing = await session.execute(select(User).where(User.email == "admin@agentguard.io"))
        if existing.scalar_one_or_none():
            print("Demo data already seeded")
            return

        admin = User(
            email="admin@agentguard.io",
            password_hash=hash_password("admin123"),
            name="Admin",
            role=UserRole.ADMIN,
        )
        session.add(admin)

        demo_user = User(
            email="demo@agentguard.io",
            password_hash=hash_password("demo123"),
            name="Demo User",
            role=UserRole.DEMO,
        )
        session.add(demo_user)
        await session.flush()

        agent_service = AgentService(session)
        policy_service = PolicyService(session)
        risk_service = RiskService(session)
        audit_service = AuditService(session)
        behavior_service = BehaviorService(session)

        from app.anomaly.detector import anomaly_detector

        for agent_data in DEMO_AGENTS:
            agent = await agent_service.create_agent(
                AgentRegister(
                    name=agent_data["name"],
                    role=agent_data["role"],
                    capabilities=agent_data["capabilities"],
                ),
                is_demo=True,
            )

            allowed_tools = TOOLS.get(agent_data["role"], [])
            policy = PolicyCreate(
                name=f"{agent_data['name']}-policy",
                description=f"Default policy for {agent_data['name']}",
                allowed_tools=allowed_tools,
                denied_tools=HONEYTOOLS,
                agent_id=agent.id,
                role=agent_data["role"],
            )
            await policy_service.create_policy(policy)

            profile = AGENT_PROFILES[agent_data["name"]]
            timestamps = _generate_timestamps(profile["calls"], profile["burst"])

            denied_count = 0
            honeytool_count = 0
            risk_events_to_create = []
            agent_final_risk = profile["risk_min"]

            for i, ts in enumerate(timestamps):
                # Determine if this call is a honeytool, denied, or allowed
                is_ht = False
                is_denied = False

                if honeytool_count < profile["honeytools"] and i > profile["calls"] // 3:
                    # Honeytool calls happen in the middle-later portion
                    if random.random() < max(0.05, profile["honeytools"] / max(profile["calls"], 1) * 3):
                        is_ht = True
                        honeytool_count += 1

                if not is_ht and denied_count < profile["denied"]:
                    # Denied calls: try a tool that's not in allowed list
                    if random.random() < max(0.05, profile["denied"] / max(profile["calls"], 1) * 2):
                        is_denied = True
                        denied_count += 1

                if is_ht:
                    tool_name = random.choice(HONEYTOOLS)
                    decision = "BLOCKED"
                    risk_score = 100.0
                    agent_final_risk = 100.0
                elif is_denied:
                    # Pick a tool outside this role's allowed set
                    forbidden_pool = []
                    for r, tools in TOOLS.items():
                        if r != agent_data["role"]:
                            forbidden_pool.extend(tools)
                    forbidden_pool.extend(HONEYTOOLS)
                    tool_name = random.choice(forbidden_pool)
                    decision = "DENIED"
                    risk_score = round(random.uniform(profile["risk_min"], profile["risk_max"]), 1)
                    agent_final_risk = max(agent_final_risk, risk_score)
                else:
                    tool_name = random.choice(allowed_tools)
                    decision = "ALLOWED"
                    risk_score = round(random.uniform(profile["risk_min"], profile["risk_max"]), 1)
                    agent_final_risk = max(agent_final_risk, risk_score)

                tc = ToolCall(
                    agent_id=agent.id,
                    agent_name=agent.name,
                    tool_name=tool_name,
                    tool_args="{}",
                    decision=decision,
                    risk_score=risk_score,
                    reason="Normal operation" if decision == "ALLOWED" else f"{decision}: {tool_name}",
                    is_honeytool=is_ht,
                    session_id=str(uuid.uuid4()),
                    execution_time_ms=round(random.uniform(50, 500), 2),
                    created_at=ts,
                )
                session.add(tc)

                audit_action = AuditAction.TOOL_EXECUTE
                if is_ht:
                    audit_action = AuditAction.DECOY_TRIGGER
                elif decision == "DENIED":
                    audit_action = AuditAction.TOOL_DENIED

                audit_entry = AuditLog(
                    action=audit_action,
                    agent_id=agent.id,
                    agent_name=agent.name,
                    tool_name=tool_name,
                    decision=decision,
                    risk_score=risk_score,
                    reason=f"{decision}: {tool_name} {'(honeytool)' if is_ht else ''}",
                    details=json.dumps({
                        "is_honeytool": is_ht,
                        "risk_score": risk_score,
                    }),
                    timestamp=ts,
                )
                session.add(audit_entry)

                # Create risk events for high-risk calls
                if risk_score > 50:
                    severity = RiskSeverity.CRITICAL if risk_score > 80 else RiskSeverity.HIGH
                    re = RiskEvent(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        severity=severity,
                        risk_score=risk_score,
                        reason=f"Risk score {risk_score:.1f} - {tool_name}",
                        tool_name=tool_name,
                        triggered_containment=is_ht or risk_score > 80,
                        created_at=ts,
                    )
                    session.add(re)

            # Create incident report if honeytools were triggered
            if profile["honeytools"] > 0:
                try:
                    from app.services.risk_explanation_service import IncidentService
                    incident_service = IncidentService(session)
                    await incident_service.create_incident(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        agent_role=agent_data["role"],
                        trigger_type="honeytool",
                        trigger_reason=f"Agent triggered {profile['honeytools']} honeytool(s) during operation",
                        severity="CRITICAL",
                        tools_invoked=HONEYTOOLS[:profile["honeytools"]],
                        actions_taken=["BLOCKED: honeytool access attempt", "Automatic containment triggered"],
                    )
                except Exception:
                    pass

            if profile["honeytools"] > 0:
                agent.status = AgentStatus.QUARANTINED
                re = RiskEvent(
                    agent_id=agent.id,
                    agent_name=agent.name,
                    severity=RiskSeverity.CRITICAL,
                    risk_score=100.0,
                    reason=f"Automatic containment triggered - multiple honeytool detections",
                    tool_name="containment",
                    triggered_containment=True,
                    created_at=timestamps[-1] + timedelta(seconds=1),
                )
                session.add(re)

                contain_entry = AuditLog(
                    action=AuditAction.CONTAINMENT,
                    agent_id=agent.id,
                    agent_name=agent.name,
                    risk_score=100.0,
                    reason=f"Agent {agent.name} contained after honeytool trigger",
                    timestamp=timestamps[-1] + timedelta(seconds=1),
                )
                session.add(contain_entry)

            agent.risk_score = agent_final_risk
            agent.last_seen = timestamps[-1]
            await session.flush()

            # Feed varied behavior samples to anomaly detector
            profile_features = await behavior_service.build_behavior_profile(agent.id)
            base_features = anomaly_detector.extract_features(profile_features)
            n_samples = 6 if profile["calls"] > 40 else 4
            for _ in range(n_samples):
                noisy = [f + random.uniform(-0.5, 0.5) * max(abs(f), 1) for f in base_features]
                anomaly_detector.add_sample(noisy)

        await session.commit()
        print(f"Demo data seeded: {len(DEMO_AGENTS)} agents, ~{sum(p['calls'] for p in AGENT_PROFILES.values())} tool calls")
        print(f"Anomaly detector: {len(anomaly_detector.feature_buffer)} samples, initialized={anomaly_detector.initialized}")


async def simulate_attack():
    async with async_session_factory() as session:
        result = await session.execute(
            select(Agent).where(Agent.is_demo == True).where(Agent.status == AgentStatus.ACTIVE)
        )
        agents = result.scalars().all()
        if not agents:
            return

        agent = random.choice(agents)
        honeytool = random.choice(HONEYTOOLS)

        risk_service = RiskService(session)
        audit_service = AuditService(session)
        behavior_service = BehaviorService(session)
        # Import inside function to break circular import
        from app.anomaly.detector import anomaly_detector

        tc = ToolCall(
            agent_id=agent.id,
            agent_name=agent.name,
            tool_name=honeytool,
            tool_args="{}",
            decision="BLOCKED",
            risk_score=100.0,
            reason=f"HONEYTOOL TRIGGERED: {honeytool}",
            is_honeytool=True,
            execution_time_ms=0.1,
        )
        session.add(tc)

        agent.risk_score = 100.0
        agent.status = AgentStatus.QUARANTINED
        agent.jwt_identity = None
        agent.updated_at = datetime.now(timezone.utc)

        re = RiskEvent(
            agent_id=agent.id,
            agent_name=agent.name,
            severity=RiskSeverity.CRITICAL,
            risk_score=100.0,
            reason=f"Decoy tool '{honeytool}' called by {agent.name}",
            tool_name=honeytool,
            triggered_containment=True,
            details="Automatic containment triggered by honeytool",
        )
        session.add(re)

        await audit_service.log(
            action=AuditAction.DECOY_TRIGGER,
            agent_id=agent.id,
            agent_name=agent.name,
            tool_name=honeytool,
            decision="BLOCKED",
            risk_score=100.0,
            reason=f"Decoy tool triggered by {agent.name}: immediate containment",
            details=json.dumps({
                "attack_type": "honeytool_trigger",
                "tool": honeytool,
                "containment": "automatic",
            }),
        )

        await audit_service.log(
            action=AuditAction.CONTAINMENT,
            agent_id=agent.id,
            agent_name=agent.name,
            risk_score=100.0,
            reason=f"Agent {agent.name} contained after honeytool trigger",
        )

        # Update anomaly detector
        behavior_profile = await behavior_service.build_behavior_profile(agent.id)
        features = anomaly_detector.extract_features(behavior_profile)
        anomaly_detector.add_sample(features)

        await session.flush()
        await session.commit()

        from app.websocket.manager import ws_manager
        await ws_manager.broadcast("containment", {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "risk_score": 100.0,
            "reason": f"Decoy tool '{honeytool}' triggered automatic containment",
            "tool_name": honeytool,
            "severity": "CRITICAL",
        })
        print(f"Attack simulated: {agent.name} triggered {honeytool} -> contained")
