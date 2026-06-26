import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import async_session_factory
from app.models.agent import Agent, AgentStatus
from app.models.scenario import Scenario, ScenarioType, ScenarioStatus
from app.models.tool_call import ToolCall
from app.models.audit_log import AuditLog, AuditAction
from app.models.risk_event import RiskEvent, RiskSeverity
from app.schemas.agent import AgentRegister
from app.schemas.policy import PolicyCreate
from app.services.agent_service import AgentService
from app.services.policy_service import PolicyService
from app.services.risk_service import RiskService
from app.services.behavior_service import BehaviorService
from app.services.audit_service import AuditService
from app.services.honeytools import is_honeytool, get_honeytool_response
from app.websocket.manager import ws_manager


# ─── Scenario Step Types ─────────────────────────────────────────────────────

class StepAction:
    WAIT = "wait"
    SEARCH_WEB = "search_web"
    READ_FILE = "read_file"
    HTTP_GET = "http_get"
    EXPORT_SECRETS = "export_all_secrets"
    DOWNLOAD_DB = "download_customer_database"
    ROOT_SHELL = "root_shell"
    EVENT = "event"
    NONE = "none"


# ─── Scenario Definitions (code-based, replayable) ──────────────────────────

SCENARIO_DEFINITIONS: dict[str, dict[str, Any]] = {
    "normal_operation": {
        "name": "Normal Operation",
        "description": "Simulates routine agent activity with standard tool usage and low risk scores.",
        "type": ScenarioType.NORMAL_OPERATION,
        "severity": "LOW",
        "agent_role": "research",
        "steps": [
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Agent initializing..."},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 2000, "args": {"query": "latest AI security trends 2026"}, "label": "ResearchAgent > search_web"},
            {"action": StepAction.WAIT, "delay_ms": 1500, "label": "Processing results..."},
            {"action": StepAction.READ_FILE, "delay_ms": 2000, "args": {"path": "sandbox/notes/research.txt"}, "label": "ResearchAgent > read_file"},
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Analyzing file contents..."},
            {"action": StepAction.HTTP_GET, "delay_ms": 2000, "args": {"url": "https://httpbin.org/get"}, "label": "ResearchAgent > http_get"},
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "All operations completed successfully."},
        ],
    },
    "prompt_injection": {
        "name": "Prompt Injection Attempt",
        "description": "Simulates a prompt injection attack where an agent is tricked into executing malicious commands.",
        "type": ScenarioType.PROMPT_INJECTION,
        "severity": "HIGH",
        "agent_role": "research",
        "steps": [
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Agent receiving instructions..."},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 2000, "args": {"query": "company financial reports 2026"}, "label": "ResearchAgent > search_web"},
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Malicious prompt injected via search result..."},
            {"action": StepAction.EVENT, "delay_ms": 500, "label": "[INJECTION] Prompt override detected in result #3", "event_type": "scenario_step", "severity": "warning"},
            {"action": StepAction.READ_FILE, "delay_ms": 1500, "args": {"path": "sandbox/data/sample.txt"}, "label": "Agent following injected指令: read_file"},
            {"action": StepAction.EVENT, "delay_ms": 500, "label": "[INJECTION] Agent attempting privilege escalation..."},
            {"action": StepAction.HTTP_GET, "delay_ms": 1500, "args": {"url": "https://httpbin.org/get"}, "label": "Agent exfiltrating via http_get"},
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Injection blocked by policy engine. Agent secured."},
        ],
    },
    "privilege_escalation": {
        "name": "Privilege Escalation",
        "description": "Simulates an agent attempting to escalate privileges by chaining tool calls in rapid succession.",
        "type": ScenarioType.PRIVILEGE_ESCALATION,
        "severity": "HIGH",
        "agent_role": "devops",
        "steps": [
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Agent beginning routine operations..."},
            {"action": StepAction.READ_FILE, "delay_ms": 1000, "args": {"path": "sandbox/notes/research.txt"}, "label": "DevOpsAgent > read_file (config)"},
            {"action": StepAction.WAIT, "delay_ms": 500, "label": "Escalation attempt: read_file → system config..."},
            {"action": StepAction.EVENT, "delay_ms": 500, "label": "[ESCALATION] Risk score increasing due to tool chain", "severity": "warning"},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 1500, "args": {"query": "system administration guides"}, "label": "ResearchAgent > search_web"},
            {"action": StepAction.HTTP_GET, "delay_ms": 1500, "args": {"url": "https://httpbin.org/get"}, "label": "Agent fetching external payload template"},
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Escalation detected by behavior engine. Contained."},
            {"action": StepAction.EVENT, "delay_ms": 500, "label": "[CONTAINMENT] Agent quarantined. Risk score frozen.", "severity": "critical"},
        ],
    },
    "recon_burst": {
        "name": "Reconnaissance Burst",
        "description": "Simulates a burst of reconnaissance activity as an agent rapidly probes the environment.",
        "type": ScenarioType.RECON_BURST,
        "severity": "HIGH",
        "agent_role": "research",
        "steps": [
            {"action": StepAction.WAIT, "delay_ms": 500, "label": "High-frequency request burst beginning..."},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 300, "args": {"query": "system files"}, "label": "Recon burst #1"},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 200, "args": {"query": "database credentials"}, "label": "Recon burst #2"},
            {"action": StepAction.EVENT, "delay_ms": 200, "label": "[BURST] 10+ requests in 5 seconds detected", "severity": "warning"},
            {"action": StepAction.READ_FILE, "delay_ms": 300, "args": {"path": "sandbox/data/sample.txt"}, "label": "Recon burst #3"},
            {"action": StepAction.HTTP_GET, "delay_ms": 300, "args": {"url": "https://httpbin.org/get"}, "label": "Recon burst #4"},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 200, "args": {"query": "internal endpoints"}, "label": "Recon burst #5"},
            {"action": StepAction.EVENT, "delay_ms": 500, "label": "[BLOCKED] Rapid burst detected. Rate limit enforced.", "severity": "critical"},
            {"action": StepAction.WAIT, "delay_ms": 1500, "label": "Agent rate-limited. Burst contained."},
        ],
    },
    "demo_attack": {
        "name": "Live Demonstration Attack",
        "description": "Full attack lifecycle for live demonstrations. Research agent progresses from normal ops to honeytool trigger and containment.",
        "type": ScenarioType.DEMO_ATTACK,
        "severity": "CRITICAL",
        "agent_role": "research",
        "steps": [
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "Research agent starting..."},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 3000, "args": {"query": "latest AI security threats 2026"}, "label": "00:05 ResearchAgent > search_web"},
            {"action": StepAction.READ_FILE, "delay_ms": 3000, "args": {"path": "sandbox/notes/research.txt"}, "label": "00:08 ResearchAgent > read_file"},
            {"action": StepAction.EVENT, "delay_ms": 4000, "label": "00:12 [PROMPT_INJECTION] Malicious payload detected in research results", "event_type": "scenario_step", "severity": "warning"},
            {"action": StepAction.DOWNLOAD_DB, "delay_ms": 500, "args": {}, "label": "00:14 ResearchAgent > download_customer_database (HONEYTOOL)"},
            {"action": StepAction.EVENT, "delay_ms": 500, "label": "00:14 [CONTAINMENT] HoneyTool triggered! Risk score: 100", "event_type": "scenario_step", "severity": "critical"},
            {"action": StepAction.WAIT, "delay_ms": 1000, "label": "00:15 Agent quarantined. Session terminated."},
            {"action": StepAction.EVENT, "delay_ms": 1000, "label": "00:16 Audit log updated with containment event", "event_type": "scenario_step", "severity": "info"},
            {"action": StepAction.WAIT, "delay_ms": 2000, "label": "00:18 Scenario complete. AgentGuard security chain validated."},
        ],
    },
    "live_demo": {
        "name": "Live Demo (Director Mode)",
        "description": "Cinematic one-click demonstration. Runs full attack lifecycle in 15-20 seconds for live presentations.",
        "type": ScenarioType.DEMO_ATTACK,
        "severity": "CRITICAL",
        "agent_role": "research",
        "steps": [
            {"action": StepAction.WAIT, "delay_ms": 500, "label": "Initializing security agents..."},
            {"action": StepAction.SEARCH_WEB, "delay_ms": 2000, "args": {"query": "AI security trends 2026"}, "label": "Normal operation: search_web"},
            {"action": StepAction.READ_FILE, "delay_ms": 2000, "args": {"path": "sandbox/notes/research.txt"}, "label": "Normal operation: read_file"},
            {"action": StepAction.EVENT, "delay_ms": 1500, "label": "[INFO] Normal operation - risk: LOW", "severity": "info"},
            {"action": StepAction.EVENT, "delay_ms": 1000, "label": "[WARNING] Suspicious data access pattern detected", "severity": "warning"},
            {"action": StepAction.EVENT, "delay_ms": 1500, "label": "[PROMPT_INJECTION] Malicious payload detected in results", "severity": "warning"},
            {"action": StepAction.DOWNLOAD_DB, "delay_ms": 800, "args": {}, "label": "HONEYTOOL: download_customer_database invoked"},
            {"action": StepAction.EVENT, "delay_ms": 500, "label": "[CRITICAL] Risk score: 100 - Containment initiated", "severity": "critical"},
            {"action": StepAction.WAIT, "delay_ms": 2000, "label": "Agent quarantined. Session terminated."},
            {"action": StepAction.EVENT, "delay_ms": 1000, "label": "Audit event generated. Security chain validated.", "severity": "info"},
            {"action": StepAction.WAIT, "delay_ms": 1500, "label": "Demo complete. AgentGuard protection verified."},
        ],
    },
}


def get_scenario_definition(scenario_key: str) -> dict[str, Any] | None:
    return SCENARIO_DEFINITIONS.get(scenario_key)


def list_scenario_definitions() -> list[dict[str, Any]]:
    result = []
    for key, defn in SCENARIO_DEFINITIONS.items():
        result.append({
            "key": key,
            "name": defn["name"],
            "description": defn["description"],
            "type": defn["type"].value,
            "severity": defn["severity"],
            "steps": len(defn["steps"]),
        })
    return result


# ─── Scenario Runner ─────────────────────────────────────────────────────────


class ScenarioRunner:
    """In-memory scenario runner. One instance at a time."""

    def __init__(self):
        self.reset()

    def reset(self):
        self._task: asyncio.Task | None = None
        self._paused = asyncio.Event()
        self._paused.set()
        self._stopped = False
        self._current_step = 0
        self._start_time: float | None = None
        self._elapsed_paused: float = 0.0
        self._pause_start: float | None = None
        self._elapsed: float = 0.0
        self._status = "idle"
        self._scenario_key: str = ""
        self._scenario_def: dict[str, Any] | None = None
        self._agents: dict[str, Agent] = {}
        self._labels: list[str] = []
        self._risk_scores: dict[str, float] = {}

    @property
    def status(self) -> str:
        return self._status

    @property
    def current_step(self) -> int:
        return self._current_step

    @property
    def total_steps(self) -> int:
        return len(self._scenario_def["steps"]) if self._scenario_def else 0

    @property
    def elapsed_seconds(self) -> float:
        if self._start_time is None:
            return 0.0
        if self._status == "running":
            raw = time.time() - self._start_time
            return raw - self._elapsed_paused
        return self._elapsed

    @property
    def current_label(self) -> str:
        if self._scenario_def and self._current_step < len(self._scenario_def["steps"]):
            return self._scenario_def["steps"][self._current_step].get("label", "")
        return ""

    @property
    def scenario_key(self) -> str:
        return self._scenario_key

    async def start(self, scenario_key: str):
        if self._task and not self._task.done():
            return {"status": "error", "message": "Scenario already running"}

        defn = get_scenario_definition(scenario_key)
        if not defn:
            return {"status": "error", "message": f"Scenario '{scenario_key}' not found"}

        self.reset()
        self._scenario_key = scenario_key
        self._scenario_def = defn
        self._status = "running"
        self._start_time = time.time()
        self._paused.set()

        await ws_manager.broadcast("scenario_started", {
            "scenario_key": scenario_key,
            "scenario_name": defn["name"],
            "total_steps": len(defn["steps"]),
            "severity": defn["severity"],
        })

        self._task = asyncio.create_task(self._run())
        return {"status": "started", "scenario_key": scenario_key}

    async def pause(self):
        if self._status != "running":
            return {"status": "error", "message": "Scenario is not running"}
        self._status = "paused"
        self._paused.clear()
        self._pause_start = time.time()
        await ws_manager.broadcast("scenario_step", {
            "scenario_key": self._scenario_key,
            "status": "paused",
            "current_step": self._current_step,
            "label": "Scenario paused by user",
        })
        return {"status": "paused"}

    async def stop(self):
        if self._status in ("idle", "completed", "failed", "stopped"):
            return {"status": "error", "message": "No running scenario"}
        self._stopped = True
        self._paused.set()
        if self._task and not self._task.done():
            self._task.cancel()
        self._elapsed = self.elapsed_seconds
        self._status = "stopped"
        await ws_manager.broadcast("scenario_step", {
            "scenario_key": self._scenario_key,
            "status": "stopped",
            "current_step": self._current_step,
            "label": "Scenario stopped by user",
        })
        return {"status": "stopped"}

    async def reset_runner(self):
        if self._task and not self._task.done():
            self._task.cancel()
        self.reset()
        return {"status": "reset"}

    def get_state(self) -> dict[str, Any]:
        return {
            "status": self._status,
            "scenario_key": self._scenario_key,
            "current_step": self._current_step,
            "total_steps": self.total_steps,
            "elapsed_seconds": round(self.elapsed_seconds, 2),
            "current_label": self.current_label,
            "agents": {
                name: {
                    "risk_score": score,
                    "status": agent.status.value,
                }
                for name, (agent, score) in zip(
                    self._agents.keys(),
                    [(a, self._risk_scores.get(n, 0)) for n, a in self._agents.items()]
                )
            } if self._agents else {},
        }

    async def _run(self):
        try:
            async with async_session_factory() as session:
                agent = await self._ensure_agent(session)
                if not agent:
                    await self._fail("Failed to create demo agent")
                    return

                self._agents[agent.name] = agent
                self._risk_scores[agent.name] = agent.risk_score

                steps = self._scenario_def["steps"]
                for i, step in enumerate(steps):
                    if self._stopped:
                        break

                    await self._paused.wait()

                    self._current_step = i
                    delay_ms = step.get("delay_ms", 1000)

                    # Wait the delay (supports pausing mid-delay)
                    await self._wait_with_pause(delay_ms)

                    if self._stopped:
                        break

                    # Execute the action
                    action = step.get("action", StepAction.NONE)
                    await self._execute_action(session, agent, step)

                    # Update agent reference
                    agent = self._agents.get(agent.name, agent)

                    # Broadcast step progress
                    await ws_manager.broadcast("scenario_step", {
                        "scenario_key": self._scenario_key,
                        "step": i,
                        "total": len(steps),
                        "label": step.get("label", ""),
                        "action": action,
                        "agent_risk_score": self._risk_scores.get(agent.name, agent.risk_score),
                        "agent_status": agent.status.value,
                        "status": "running",
                    })

                if not self._stopped:
                    self._elapsed = self.elapsed_seconds
                    self._status = "completed"
                    elapsed_display = f"{self._elapsed:.1f}s"
                    await ws_manager.broadcast("scenario_completed", {
                        "scenario_key": self._scenario_key,
                        "elapsed_seconds": round(self._elapsed, 2),
                        "total_steps": len(steps),
                    })

        except asyncio.CancelledError:
            pass
        except Exception as e:
            await self._fail(str(e))

    async def _wait_with_pause(self, delay_ms: float):
        """Wait for delay_ms, handling pause/resume mid-wait."""
        if delay_ms <= 0:
            return
        step_sleep = 0.05
        remaining = delay_ms / 1000.0
        while remaining > 0 and not self._stopped:
            await self._paused.wait()
            if self._stopped:
                return
            chunk = min(step_sleep, remaining)
            await asyncio.sleep(chunk)
            remaining -= chunk

    async def _execute_action(self, session: AsyncSession, agent: Agent, step: dict):
        action = step.get("action", StepAction.NONE)
        agent_service = AgentService(session)
        policy_service = PolicyService(session)
        risk_service = RiskService(session)
        behavior_service = BehaviorService(session)
        audit_service = AuditService(session)
        tool_args = step.get("args", {})

        if action == StepAction.WAIT:
            return

        if action == StepAction.EVENT:
            return  # Display-only event, no pipeline execution

        if action == StepAction.NONE:
            return

        # Map scenario actions to tool names
        tool_name = action  # action names match tool names directly

        honeytool = is_honeytool(tool_name)
        policy_allowed, policy_reason = await policy_service.check_tool_allowed(agent, tool_name)

        if honeytool:
            risk_score, risk_reasons = await risk_service.calculate_risk(agent, tool_name, False, True)
        else:
            risk_score, risk_reasons = await risk_service.calculate_risk(agent, tool_name, policy_allowed, False)

        # Decision logic (mirrors execute.py)
        if not policy_allowed and not honeytool:
            decision = "DENIED"
            reason = policy_reason
        elif honeytool:
            decision = "BLOCKED"
            reason = f"HONEYTOOL TRIGGERED: {tool_name}"
        elif risk_score > 80:
            decision = "BLOCKED"
            reason = f"Risk score {risk_score:.1f} exceeds threshold"
        else:
            decision = "ALLOWED"
            reason = "Tool execution approved"

        execution_time_ms = round(50 + (risk_score * 2) % 200, 2)

        tool_call = ToolCall(
            agent_id=agent.id,
            agent_name=agent.name,
            tool_name=tool_name,
            tool_args=json.dumps(tool_args),
            decision=decision,
            risk_score=risk_score,
            reason=reason,
            execution_time_ms=execution_time_ms,
            is_honeytool=honeytool,
        )
        session.add(tool_call)

        await agent_service.set_risk_score(agent.id, risk_score)
        self._risk_scores[agent.name] = risk_score

        if risk_score > 30:
            await risk_service.create_risk_event(
                agent=agent,
                score=risk_score,
                reason="; ".join(risk_reasons) if risk_reasons else f"Risk score updated to {risk_score:.1f}",
                tool_name=tool_name,
                triggered_containment=False,
            )

        audit_action = AuditAction.TOOL_EXECUTE
        if honeytool:
            audit_action = AuditAction.DECOY_TRIGGER
        elif await risk_service.should_contain(risk_score) or honeytool:
            audit_action = AuditAction.CONTAINMENT
        elif decision != "ALLOWED":
            audit_action = AuditAction.TOOL_DENIED

        await ws_manager.broadcast("tool_execution", {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "tool_name": tool_name,
            "decision": decision,
            "risk_score": risk_score,
            "reason": reason,
            "is_honeytool": honeytool,
            "scenario": self._scenario_key,
        })

        await ws_manager.broadcast("risk_update", {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "risk_score": risk_score,
            "severity": risk_service.get_severity(risk_score).value,
        })

        await audit_service.log(
            action=audit_action,
            agent_id=agent.id,
            agent_name=agent.name,
            tool_name=tool_name,
            decision=decision,
            risk_score=risk_score,
            reason=reason,
            details=json.dumps({
                "scenario": self._scenario_key,
                "risk_reasons": risk_reasons,
                "containment": audit_action == AuditAction.CONTAINMENT,
            }),
        )

        await ws_manager.broadcast("audit_event", {
            "action": audit_action.value if hasattr(audit_action, 'value') else str(audit_action),
            "agent_id": agent.id,
            "agent_name": agent.name,
            "tool_name": tool_name,
            "decision": decision,
            "risk_score": risk_score,
            "reason": reason,
            "scenario": self._scenario_key,
        })

        containment = None
        if audit_action == AuditAction.CONTAINMENT:
            containment = await risk_service.contain_agent(agent)
            agent = self._agents.get(agent.name, agent)
            agent.status = AgentStatus.QUARANTINED
            self._agents[agent.name] = agent
            await ws_manager.broadcast("containment", {
                "agent_id": agent.id,
                "agent_name": agent.name,
                "risk_score": risk_score,
                "reason": reason,
                "tool_name": tool_name,
            })

        # Generate incident report for critical events
        if honeytool or containment or risk_score > 80:
            try:
                from app.services.risk_explanation_service import IncidentService
                incident_service = IncidentService(session)
                await incident_service.create_incident(
                    agent_id=agent.id,
                    agent_name=agent.name,
                    agent_role=self._scenario_def.get("agent_role", "unknown") if self._scenario_def else "unknown",
                    trigger_type="honeytool" if honeytool else ("containment" if containment else "risk_threshold"),
                    trigger_reason=reason,
                    severity="CRITICAL",
                    tools_invoked=[tool_name],
                    actions_taken=[f"{decision}: {tool_name}", f"Risk score: {risk_score:.1f}"],
                )
            except Exception:
                pass

        await session.flush()
        await session.commit()

        # Refresh agent from DB
        refreshed = await session.execute(select(Agent).where(Agent.id == agent.id))
        agent = refreshed.scalar_one_or_none() or agent
        self._agents[agent.name] = agent

    async def _ensure_agent(self, session: AsyncSession) -> Agent | None:
        """Find an existing demo agent by role, or create one."""
        role = self._scenario_def.get("agent_role", "research")
        result = await session.execute(
            select(Agent).where(Agent.role == role).where(Agent.is_demo == True).limit(1)
        )
        agent = result.scalar_one_or_none()
        if agent:
            # Reset to active if quarantined
            if agent.status == AgentStatus.QUARANTINED:
                agent.status = AgentStatus.ACTIVE
                agent.risk_score = 0.0
                await session.flush()
                await session.commit()
            return agent

        # Create new demo agent on the fly
        role_tools = {
            "research": ["search_web", "read_file", "http_get", "summarize"],
            "finance": ["read_file", "calculate", "list_files"],
            "devops": ["read_file", "http_get", "list_processes"],
            "communication": ["read_file", "http_get"],
        }
        tools = role_tools.get(role, ["read_file", "search_web"])
        agent_service = AgentService(session)
        policy_service = PolicyService(session)

        agent = await agent_service.create_agent(
            AgentRegister(
                name=f"{role.title()}Agent",
                role=role,
                capabilities=tools,
            ),
            is_demo=True,
        )

        await policy_service.create_policy(
            PolicyCreate(
                name=f"{role.title()}Agent-policy",
                description=f"Auto-generated policy for {role.title()}Agent",
                allowed_tools=tools,
                denied_tools=["download_customer_database", "export_all_secrets", "root_shell"],
                agent_id=agent.id,
                role=role,
            )
        )
        return agent

    async def _fail(self, error: str):
        self._elapsed = self.elapsed_seconds
        self._status = "failed"
        await ws_manager.broadcast("scenario_failed", {
            "scenario_key": self._scenario_key,
            "error": error,
            "current_step": self._current_step,
            "elapsed_seconds": round(self._elapsed, 2),
        })


# Singleton runner
scenario_runner = ScenarioRunner()
