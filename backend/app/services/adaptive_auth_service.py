from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent, AgentStatus
from app.services.policy_service import PolicyService
import json

SENSITIVE_TOOLS = {"root_shell", "export_all_secrets", "download_customer_database", "deploy_service", "escalate"}
PRIVILEGED_TOOLS = {"execute_command", "deploy_service", "root_shell"}
WRITE_OPERATIONS = {"write_file", "send_message", "draft_response", "update_ticket", "deploy_service"}
OUTBOUND_REQUESTS = {"http_get", "web_search", "search_web"}
DELEGATION_TOOLS = {"escalate", "deploy_service"}


class AdaptiveAuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.policy_service = PolicyService(session)

    async def get_effective_permissions(self, agent: Agent) -> dict:
        policy = await self.policy_service.get_policy_for_agent(agent)
        base_allowed = json.loads(policy.allowed_tools) if policy and policy.allowed_tools else []
        base_denied = json.loads(policy.denied_tools) if policy and policy.denied_tools else []

        risk_score = agent.risk_score
        risk_adjustments = []
        risk_restrictions = []

        if agent.status == AgentStatus.QUARANTINED:
            risk_adjustments.append({
                "level": "CRITICAL",
                "restriction": "Agent is quarantined - all operations denied",
                "score_range": "81-100",
            })
            return {
                "agent_id": agent.id,
                "agent_name": agent.name,
                "current_risk_score": risk_score,
                "current_status": agent.status.value,
                "base_permissions": base_allowed,
                "base_denied": base_denied,
                "risk_adjustments": risk_adjustments,
                "effective_restrictions": ["ALL_TOOLS_DENIED"],
                "effective_permissions": [],
            }

        if risk_score > 80:
            risk_adjustments.append({
                "level": "CRITICAL",
                "restriction": "Critical risk - all operations denied",
                "score_range": "81-100",
            })
            risk_restrictions.extend(WRITE_OPERATIONS | OUTBOUND_REQUESTS | DELEGATION_TOOLS | SENSITIVE_TOOLS | PRIVILEGED_TOOLS)
            risk_restrictions.append("ALL_WRITE")
            risk_restrictions.append("ALL_OUTBOUND")
            risk_restrictions.append("ALL_DELEGATION")

        elif risk_score > 60:
            risk_adjustments.append({
                "level": "HIGH",
                "restriction": "Write operations, outbound requests, and delegation disabled",
                "score_range": "61-80",
            })
            risk_restrictions.extend(WRITE_OPERATIONS | OUTBOUND_REQUESTS | DELEGATION_TOOLS)
            risk_restrictions.append("ALL_WRITE")
            risk_restrictions.append("ALL_OUTBOUND")
            risk_restrictions.append("ALL_DELEGATION")

        elif risk_score > 30:
            risk_adjustments.append({
                "level": "RESTRICTED",
                "restriction": "Sensitive and privileged tools disabled",
                "score_range": "31-60",
            })
            risk_restrictions.extend(SENSITIVE_TOOLS | PRIVILEGED_TOOLS)

        effective = []
        for tool in base_allowed:
            if tool not in base_denied and tool not in risk_restrictions:
                effective.append(tool)

        effective_restriction_labels = []
        if "ALL_WRITE" in risk_restrictions:
            effective_restriction_labels.append("Write operations disabled (high risk)")
        if "ALL_OUTBOUND" in risk_restrictions:
            effective_restriction_labels.append("Outbound requests disabled (high risk)")
        if "ALL_DELEGATION" in risk_restrictions:
            effective_restriction_labels.append("Delegation disabled (high risk)")
        for r in sorted(risk_restrictions):
            if r not in ("ALL_WRITE", "ALL_OUTBOUND", "ALL_DELEGATION"):
                effective_restriction_labels.append(f"Tool '{r}' restricted (risk-adaptive)")

        return {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "current_risk_score": risk_score,
            "current_status": agent.status.value,
            "base_permissions": base_allowed,
            "base_denied": base_denied,
            "risk_adjustments": risk_adjustments,
            "effective_restrictions": effective_restriction_labels,
            "effective_permissions": effective,
        }

    async def check_tool_allowed_adaptive(self, agent: Agent, tool_name: str) -> tuple[bool, str]:
        effective = await self.get_effective_permissions(agent)

        if agent.status == AgentStatus.QUARANTINED:
            return False, "Agent is quarantined"

        if effective["current_risk_score"] > 80:
            return False, f"All operations denied due to critical risk ({effective['current_risk_score']:.1f})"

        if tool_name in effective["effective_restrictions"] or tool_name in [
            r.replace("Tool '", "").replace("' restricted (risk-adaptive)", "")
            for r in effective["effective_restrictions"]
        ]:
            return False, f"Tool '{tool_name}' restricted by risk-adaptive policy (risk: {effective['current_risk_score']:.1f})"

        if tool_name not in effective["effective_permissions"]:
            return False, f"Tool '{tool_name}' not in effective permissions"

        return True, "Tool allowed by adaptive policy"
