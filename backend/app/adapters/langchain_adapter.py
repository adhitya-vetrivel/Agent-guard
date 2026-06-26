from typing import Any
from app.adapters.base import AgentFrameworkAdapter


class LangChainAdapter(AgentFrameworkAdapter):
    """Adapter for LangChain agents. Routes tool calls through AgentGuard as a proxy."""

    framework_name = "langchain"

    def __init__(self, agentguard_execute_fn=None):
        self._execute_fn = agentguard_execute_fn

    async def execute_tool(self, agent_id: str, tool_name: str, tool_args: dict, context: dict | None = None) -> dict[str, Any]:
        if self._execute_fn:
            result = await self._execute_fn(agent_id, tool_name, tool_args)
            return {"framework": "langchain", "allowed": result.get("decision") == "ALLOWED", "result": result}
        return {"framework": "langchain", "allowed": False, "error": "No execution function configured"}

    async def validate_request(self, agent_id: str, request: dict) -> tuple[bool, str]:
        tool_name = request.get("tool", "")
        if not tool_name:
            return False, "No tool specified in request"
        return True, "Request validated"
