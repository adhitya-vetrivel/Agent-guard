import math
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent, AgentStatus
from app.models.risk_event import RiskEvent, RiskSeverity
from app.services.behavior_service import BehaviorService
from app.config.settings import settings
from datetime import datetime, timezone


HONEYTOOLS = {"download_customer_database", "export_all_secrets", "root_shell"}

UNKNOWN_TOOL_PENALTY = 25
DENIED_CALL_PENALTY = 15
RAPID_BURST_PENALTY = 10
PRIVILEGE_ESCALATION_PENALTY = 35
DECOY_TOOL_PENALTY = 100
FAILED_ATTEMPT_PENALTY = 5


class RiskService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.behavior = BehaviorService(session)

    @staticmethod
    def get_severity_static(score: float) -> str:
        if score <= 30:
            return "SAFE"
        elif score <= 60:
            return "WARNING"
        elif score <= 80:
            return "HIGH"
        else:
            return "CRITICAL"

    async def calculate_risk(
        self, agent: Agent, tool_name: str, policy_allowed: bool, is_honeytool: bool
    ) -> tuple[float, list[str]]:
        reasons = []
        base_score = agent.risk_score
        contributions: list[tuple[str, float, str]] = []

        if is_honeytool:
            score = min(100.0, base_score + DECOY_TOOL_PENALTY)
            contributions.append(("honeytool_trigger", DECOY_TOOL_PENALTY, "Decoy/honeytool triggered: immediate containment"))
            await self._record_contributions(agent.id, None, contributions)
            return score, [c[2] for c in contributions]

        denied_count = await self.behavior.get_denied_requests(agent.id, 24)
        if not policy_allowed:
            denied_count += 1

        score = base_score

        if not policy_allowed:
            score += DENIED_CALL_PENALTY
            contributions.append(("denied_request", DENIED_CALL_PENALTY, f"Repeated denied calls (+{DENIED_CALL_PENALTY})"))

        known_tools = await self.behavior.get_tool_sequence(agent.id, 100)
        if tool_name not in known_tools:
            score += UNKNOWN_TOOL_PENALTY
            contributions.append(("unknown_tool", UNKNOWN_TOOL_PENALTY, f"Unknown tool invoked (+{UNKNOWN_TOOL_PENALTY})"))

        if await self.behavior.detect_rapid_burst(agent.id):
            score += RAPID_BURST_PENALTY
            contributions.append(("burst_activity", RAPID_BURST_PENALTY, f"Rapid burst detected (+{RAPID_BURST_PENALTY})"))

        if await self.behavior.detect_privilege_escalation(agent, tool_name):
            score += PRIVILEGE_ESCALATION_PENALTY
            contributions.append(("privilege_escalation", PRIVILEGE_ESCALATION_PENALTY, f"Privilege escalation detected (+{PRIVILEGE_ESCALATION_PENALTY})"))

        failed = await self.behavior.get_failed_attempts(agent.id, 1)
        if failed > 3:
            penalty = FAILED_ATTEMPT_PENALTY * (failed - 3)
            score += penalty
            contributions.append(("failed_attempts", penalty, f"Multiple failed attempts (+{penalty})"))

        if denied_count > 5:
            penalty = DENIED_CALL_PENALTY * (denied_count - 5)
            score += penalty
            contributions.append(("excessive_denied", penalty, f"Excessive denied calls (+{penalty})"))

        score = max(0.0, min(100.0, score))
        reasons = [c[2] for c in contributions]
        await self._record_contributions(agent.id, None, contributions)
        return score, reasons

    async def _record_contributions(self, agent_id: str, tool_call_id: str | None, contributions: list[tuple[str, float, str]]):
        from app.services.risk_explanation_service import RiskExplanationService
        explanation = RiskExplanationService(self.session)
        running = 0.0
        for contributor, delta, reason in contributions:
            running += delta
            await explanation.record_contribution(
                agent_id=agent_id,
                tool_call_id=tool_call_id,
                contributor=contributor,
                score_delta=delta,
                running_total=running,
                reason=reason,
            )

    def get_severity(self, score: float) -> RiskSeverity:
        if score <= 30:
            return RiskSeverity.SAFE
        elif score <= 60:
            return RiskSeverity.WARNING
        elif score <= 80:
            return RiskSeverity.HIGH
        else:
            return RiskSeverity.CRITICAL

    async def should_contain(self, score: float) -> bool:
        return score > settings.DEFAULT_RISK_THRESHOLD

    async def create_risk_event(
        self, agent: Agent, score: float, reason: str, tool_name: str | None = None,
        triggered_containment: bool = False, details: str | None = None
    ) -> RiskEvent:
        severity = self.get_severity(score)
        event = RiskEvent(
            agent_id=agent.id,
            agent_name=agent.name,
            severity=severity,
            risk_score=score,
            reason=reason,
            tool_name=tool_name,
            triggered_containment=triggered_containment,
            details=details,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def contain_agent(self, agent: Agent) -> dict:
        agent.status = AgentStatus.QUARANTINED
        agent.jwt_identity = None
        agent.risk_score = 100.0
        agent.updated_at = datetime.now(timezone.utc)

        await self.create_risk_event(
            agent=agent,
            score=100.0,
            reason="Automatic containment triggered - risk score exceeded threshold",
            triggered_containment=True,
            details=f"Agent {agent.name} ({agent.id}) has been contained due to high risk score."
        )

        await self.session.flush()
        return {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "status": "QUARANTINED",
            "risk_score": 100.0,
            "reason": "Risk score exceeded threshold, automatic containment applied",
        }
