from typing import Any
from app.adapters.base import AgentFrameworkAdapter


class CrewAIAdapter(AgentFrameworkAdapter):
    """Adapter for CrewAI agents. Routes tool calls through AgentGuard as a security proxy."""

    framework_name = "crewai"

    def __init__(self, agentguard_execute_fn=None):
        self._execute_fn = agentguard_execute_fn

    async def execute_tool(self, agent_id: str, tool_name: str, tool_args: dict, context: dict | None = None) -> dict[str, Any]:
        if self._execute_fn:
            result = await self._execute_fn(agent_id, tool_name, tool_args)
            return {"framework": "crewai", "allowed": result.get("decision") == "ALLOWED", "result": result}
        return {"framework": "crewai", "allowed": False, "error": "No execution function configured"}

    async def validate_request(self, agent_id: str, request: dict) -> tuple[bool, str]:
        tool_name = request.get("tool", "") or (request.get("function", {}) or {}).get("name", "")
        if not tool_name:
            return False, "No tool specified in CrewAI request"
        return True, "CrewAI request validated"
