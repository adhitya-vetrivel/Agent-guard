import json
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent
from app.models.risk_contribution import RiskContribution
from app.models.tool_call import ToolCall
from app.models.risk_event import RiskEvent
from app.services.risk_service import RiskService


class RiskExplanationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def record_contribution(
        self,
        agent_id: str,
        tool_call_id: str | None,
        contributor: str,
        score_delta: float,
        running_total: float,
        reason: str,
    ):
        severity = RiskService.get_severity_static(running_total)
        contrib = RiskContribution(
            agent_id=agent_id,
            tool_call_id=tool_call_id,
            contributor=contributor,
            score_delta=round(score_delta, 2),
            running_total=round(running_total, 2),
            severity=severity,
            reason=reason,
        )
        self.session.add(contrib)
        await self.session.flush()

    async def get_explanation(self, agent_id: str) -> dict[str, Any]:
        agent = await self.session.execute(select(Agent).where(Agent.id == agent_id))
        agent = agent.scalar_one_or_none()
        if not agent:
            return {"error": "Agent not found"}

        contribs = await self.session.execute(
            select(RiskContribution)
            .where(RiskContribution.agent_id == agent_id)
            .order_by(RiskContribution.created_at.asc())
        )
        contributions = contribs.scalars().all()

        tool_calls = await self.session.execute(
            select(ToolCall)
            .where(ToolCall.agent_id == agent_id)
            .order_by(ToolCall.created_at.desc())
            .limit(50)
        )
        recent_tool_calls = tool_calls.scalars().all()

        risk_events = await self.session.execute(
            select(RiskEvent)
            .where(RiskEvent.agent_id == agent_id)
            .order_by(RiskEvent.created_at.desc())
            .limit(50)
        )
        events = risk_events.scalars().all()

        # Aggregate by contributor
        breakdown: dict[str, float] = {}
        for c in contributions:
            breakdown[c.contributor] = round(breakdown.get(c.contributor, 0) + c.score_delta, 2)

        timeline = [
            {
                "timestamp": c.created_at.isoformat(),
                "contributor": c.contributor,
                "score_delta": c.score_delta,
                "running_total": c.running_total,
                "severity": c.severity,
                "reason": c.reason,
            }
            for c in contributions
        ]

        return {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "current_risk_score": agent.risk_score,
            "status": agent.status.value,
            "breakdown": breakdown,
            "timeline": timeline,
            "recent_tool_calls": [
                {
                    "id": tc.id,
                    "tool_name": tc.tool_name,
                    "decision": tc.decision,
                    "risk_score": tc.risk_score,
                    "created_at": tc.created_at.isoformat() if tc.created_at else None,
                }
                for tc in recent_tool_calls
            ],
            "risk_events": [
                {
                    "id": e.id,
                    "severity": e.severity.value,
                    "risk_score": e.risk_score,
                    "reason": e.reason,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in events
            ],
        }


class IncidentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_incident(
        self,
        agent_id: str,
        agent_name: str,
        agent_role: str | None,
        trigger_type: str,
        trigger_reason: str,
        severity: str = "CRITICAL",
        timeline: list | None = None,
        risk_breakdown: dict | None = None,
        actions_taken: list | None = None,
        tools_invoked: list | None = None,
    ) -> Any:
        from app.models.incident_report import IncidentReport, IncidentSeverity, IncidentStatus

        sev_map = {"LOW": IncidentSeverity.LOW, "MEDIUM": IncidentSeverity.MEDIUM,
                    "HIGH": IncidentSeverity.HIGH, "CRITICAL": IncidentSeverity.CRITICAL}
        sev = sev_map.get(severity.upper(), IncidentSeverity.CRITICAL)

        recommended = self._get_recommended_actions(trigger_type)

        report = IncidentReport(
            agent_id=agent_id,
            agent_name=agent_name,
            agent_role=agent_role,
            severity=sev,
            status=IncidentStatus.OPEN if severity != "CRITICAL" else IncidentStatus.CONTAINED,
            trigger_reason=trigger_reason,
            trigger_type=trigger_type,
            timeline=json.dumps(timeline or []),
            risk_breakdown=json.dumps(risk_breakdown or {}),
            actions_taken=json.dumps(actions_taken or []),
            containment_status="contained" if severity == "CRITICAL" else "none",
            tools_invoked=json.dumps(tools_invoked or []),
            recommended_actions=json.dumps(recommended),
        )
        self.session.add(report)
        await self.session.flush()
        return report

    def _get_recommended_actions(self, trigger_type: str) -> list[str]:
        actions = {
            "honeytool": [
                "Immediately quarantine all sessions for this agent",
                "Revoke all API keys and tokens used by the agent",
                "Conduct full audit of agent's recent activity log",
                "Review and update policy rules for honeytool detection",
                "Verify no data exfiltration occurred before containment",
            ],
            "containment": [
                "Review risk score thresholds and adjust if necessary",
                "Analyze tool call sequence leading to containment",
                "Update behavior detection models with new patterns",
                "Verify quarantine isolation is effective",
            ],
            "privilege_escalation": [
                "Review agent role permissions and capabilities",
                "Audit all recent tool invocations for unauthorized access",
                "Apply principle of least privilege to agent roles",
                "Enable additional monitoring for this agent class",
            ],
            "risk_threshold": [
                "Investigate root cause of risk score increase",
                "Review recent tool call patterns for anomalies",
                "Consider temporary policy restrictions for this agent",
                "Enable verbose logging for future monitoring",
            ],
        }
        return actions.get(trigger_type, [
            "Review incident details and take corrective action",
            "Update security policies if needed",
            "Monitor agent behavior for recurrence",
            "Document incident for future reference",
        ])

    async def get_incidents(
        self, skip: int = 0, limit: int = 50,
        severity: str | None = None, status: str | None = None,
        agent_id: str | None = None,
    ) -> list[Any]:
        from app.models.incident_report import IncidentReport
        query = select(IncidentReport)
        if severity:
            query = query.where(IncidentReport.severity == severity.upper())
        if status:
            query = query.where(IncidentReport.status == status.upper())
        if agent_id:
            query = query.where(IncidentReport.agent_id == agent_id)
        query = query.order_by(IncidentReport.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_incident(self, incident_id: str) -> Any | None:
        from app.models.incident_report import IncidentReport
        result = await self.session.execute(select(IncidentReport).where(IncidentReport.id == incident_id))
        return result.scalar_one_or_none()
