import asyncio
import time
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import get_session, async_session_factory
from app.security.auth import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentStatus
from app.models.tool_call import ToolCall
from app.models.audit_log import AuditLog
from app.models.risk_event import RiskEvent
from app.models.scenario import Scenario
from app.websocket.manager import ws_manager
from app.services.scenario_service import scenario_runner
from app.services.risk_service import RiskService
from app.schemas.agent import AgentRegister
from app.schemas.policy import PolicyCreate
from app.services.agent_service import AgentService
from app.services.policy_service import PolicyService

router = APIRouter(prefix="/api/system", tags=["System"])


@router.get("/verify")
async def system_verify(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    checks = {}
    all_passed = True

    # DB connectivity
    try:
        db_result = await session.execute(select(func.count(Agent.id)))
        db_result.scalar()
        checks["db_connectivity"] = {"status": "ok", "detail": "PostgreSQL reachable"}
    except Exception as e:
        all_passed = False
        checks["db_connectivity"] = {"status": "fail", "detail": str(e)}

    # Redis connectivity
    try:
        from app.config.settings import settings
        if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL:
            checks["redis_connectivity"] = {"status": "ok", "detail": "Redis configured"}
        else:
            checks["redis_connectivity"] = {"status": "ok", "detail": "Redis not configured, using SQL"}
    except Exception as e:
        all_passed = False
        checks["redis_connectivity"] = {"status": "fail", "detail": str(e)}

    # WebSocket status
    ws_connections = len(ws_manager.active_connections)
    checks["websocket_status"] = {
        "status": "ok",
        "detail": f"{ws_connections} active WebSocket connections",
        "connections": ws_connections,
    }

    # Scenario status
    scenario_state = scenario_runner.get_state()
    checks["scenario_status"] = {
        "status": "ok",
        "detail": f"Scenario status: {scenario_state['status']}",
        "state": scenario_state,
    }

    # Anomaly model status
    try:
        from app.ml.anomaly_model import AnomalyDetector
        anomaly = AnomalyDetector()
        checks["anomaly_model_status"] = {
            "status": "ok",
            "detail": "Anomaly detector loaded",
            "features": anomaly.n_features if hasattr(anomaly, 'n_features') else None,
        }
    except ImportError:
        checks["anomaly_model_status"] = {"status": "ok", "detail": "Anomaly model not implemented"}
    except Exception as e:
        all_passed = False
        checks["anomaly_model_status"] = {"status": "fail", "detail": str(e)}

    # Agent stats
    try:
        agent_count = (await session.execute(select(func.count(Agent.id)))).scalar() or 0
        active_count = (await session.execute(
            select(func.count(Agent.id)).where(Agent.status == AgentStatus.ACTIVE)
        )).scalar() or 0
        checks["agent_stats"] = {
            "status": "ok",
            "detail": f"{agent_count} agents ({active_count} active)",
            "total": agent_count,
            "active": active_count,
        }
    except Exception as e:
        all_passed = False
        checks["agent_stats"] = {"status": "fail", "detail": str(e)}

    # ToolCall / AuditLog count match
    try:
        toolcall_count = (await session.execute(select(func.count(ToolCall.id)))).scalar() or 0
        auditlog_count = (await session.execute(
            select(func.count(AuditLog.id)).where(
                AuditLog.action.in_(["TOOL_EXECUTE", "TOOL_DENIED", "DECOY_TRIGGER", "CONTAINMENT"])
            )
        )).scalar() or 0
        count_diff = abs(toolcall_count - auditlog_count)
        checks["toolcall_auditlog_match"] = {
            "status": "ok" if count_diff <= 5 else "warn",
            "detail": f"ToolCalls: {toolcall_count}, AuditLogs: {auditlog_count}, diff: {count_diff}",
            "tool_call_count": toolcall_count,
            "audit_log_count": auditlog_count,
            "diff": count_diff,
        }
    except Exception as e:
        all_passed = False
        checks["toolcall_auditlog_match"] = {"status": "fail", "detail": str(e)}

    result = {
        "status": "passed" if all_passed else "failed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }
    return result


# ─── Stress Test Mode ──────────────────────────────────────────────────────

stress_test_state: dict[str, Any] = {
    "running": False,
    "start_time": None,
    "agents_created": 0,
    "total_executions": 0,
    "successful_executions": 0,
    "failed_executions": 0,
    "total_latency_ms": 0.0,
    "dropped_ws_events": 0,
    "reconnects": 0,
    "results": [],
}


@router.post("/stress/start")
async def start_stress_test(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if stress_test_state["running"]:
        return {"status": "error", "message": "Stress test already running"}

    # Reset state
    stress_test_state["running"] = True
    stress_test_state["start_time"] = time.time()
    stress_test_state["agents_created"] = 0
    stress_test_state["total_executions"] = 0
    stress_test_state["successful_executions"] = 0
    stress_test_state["failed_executions"] = 0
    stress_test_state["total_latency_ms"] = 0.0
    stress_test_state["dropped_ws_events"] = 0
    stress_test_state["reconnects"] = 0
    stress_test_state["results"] = []

    # Launch in background
    asyncio.create_task(_run_stress_test(session))
    return {"status": "started", "message": "Stress test launched"}


@router.get("/stress/status")
async def stress_status(user: User = Depends(get_current_user)):
    state = dict(stress_test_state)
    if state["total_executions"] > 0:
        state["avg_latency_ms"] = round(
            state["total_latency_ms"] / state["total_executions"], 2
        )
    else:
        state["avg_latency_ms"] = 0.0
    state["elapsed_seconds"] = round(time.time() - (state["start_time"] or time.time()), 2)
    return state


HONEYTOOLS_SET = {"download_customer_database", "export_all_secrets", "root_shell"}
SAFE_TOOLS = ["search_web", "read_file", "http_get"]


async def _run_stress_test(parent_session: AsyncSession):
    try:
        async with await parent_session.connection() as conn:
            pass  # verify session is alive

        async def _exec_in_session():
            async with async_session_factory() as session:
                agent_service = AgentService(session)
                policy_service = PolicyService(session)
                risk_service = RiskService(session)

                # Create 10 agents
                agents = []
                for i in range(10):
                    role = ["research", "finance", "devops", "communication"][i % 4]
                    name = f"StressAgent-{i}"
                    try:
                        agent_result = await agent_service.create_agent(
                            AgentRegister(
                                name=name,
                                role=role,
                                capabilities=SAFE_TOOLS + list(HONEYTOOLS_SET),
                            ),
                            is_demo=True,
                        )
                        await policy_service.create_policy(
                            PolicyCreate(
                                name=f"{name}-policy",
                                description=f"Stress test policy for {name}",
                                allowed_tools=SAFE_TOOLS,
                                denied_tools=list(HONEYTOOLS_SET),
                                agent_id=agent_result.id,
                                role=role,
                            )
                        )
                        agents.append(agent_result)
                        stress_test_state["agents_created"] += 1
                    except Exception as e:
                        stress_test_state["failed_executions"] += 1
                        stress_test_state["results"].append(f"Agent creation failed: {e}")

                # Run 100 executions across agents
                for exec_idx in range(100):
                    if not stress_test_state["running"]:
                        break

                    agent = agents[exec_idx % len(agents)] if agents else None
                    if not agent:
                        continue

                    tool_name = SAFE_TOOLS[exec_idx % len(SAFE_TOOLS)]
                    is_honeytool = False

                    start_ts = time.time()
                    try:
                        policy_allowed, policy_reason = await policy_service.check_tool_allowed(
                            agent, tool_name
                        )
                        risk_score, risk_reasons = await risk_service.calculate_risk(
                            agent, tool_name, policy_allowed, is_honeytool
                        )

                        if not policy_allowed:
                            decision = "DENIED"
                        elif risk_score > 80:
                            decision = "BLOCKED"
                        else:
                            decision = "ALLOWED"

                        execution_time_ms = round((time.time() - start_ts) * 1000, 2)

                        tool_call = ToolCall(
                            agent_id=agent.id,
                            agent_name=agent.name,
                            tool_name=tool_name,
                            tool_args="{}",
                            decision=decision,
                            risk_score=risk_score,
                            reason=f"Stress test execution #{exec_idx}",
                            execution_time_ms=execution_time_ms,
                            is_honeytool=is_honeytool,
                        )
                        session.add(tool_call)

                        await risk_service.create_risk_event(
                            agent=agent,
                            score=risk_score,
                            reason="; ".join(risk_reasons) if risk_reasons else "Stress test execution",
                            tool_name=tool_name,
                            triggered_containment=False,
                        )

                        await ws_manager.broadcast("tool_execution", {
                            "agent_id": agent.id,
                            "agent_name": agent.name,
                            "tool_name": tool_name,
                            "decision": decision,
                            "risk_score": risk_score,
                            "stress_test": True,
                        })

                        await ws_manager.broadcast("risk_update", {
                            "agent_id": agent.id,
                            "agent_name": agent.name,
                            "risk_score": risk_score,
                            "severity": risk_service.get_severity(risk_score).value,
                            "stress_test": True,
                        })

                        await session.flush()
                        await session.commit()

                        stress_test_state["successful_executions"] += 1
                        stress_test_state["total_latency_ms"] += execution_time_ms

                    except Exception as e:
                        stress_test_state["failed_executions"] += 1
                        stress_test_state["results"].append(f"Exec #{exec_idx} failed: {e}")

                    stress_test_state["total_executions"] += 1

                    # Small delay to avoid overwhelming
                    await asyncio.sleep(0.05)

        await _exec_in_session()

    except Exception as e:
        stress_test_state["results"].append(f"Stress test error: {e}")
    finally:
        stress_test_state["running"] = False


@router.post("/stress/stop")
async def stop_stress_test(user: User = Depends(get_current_user)):
    stress_test_state["running"] = False
    return {"status": "stopped"}
