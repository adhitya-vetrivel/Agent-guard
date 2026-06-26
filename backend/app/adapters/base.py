from typing import Any, Protocol


class AgentFrameworkAdapter(Protocol):
    """Protocol for agent framework adapters. All adapters proxy tool calls through AgentGuard."""

    framework_name: str = "base"

    async def execute_tool(self, agent_id: str, tool_name: str, tool_args: dict, context: dict | None = None) -> dict[str, Any]:
        """Execute a tool through the AgentGuard execution pipeline."""
        ...

    async def validate_request(self, agent_id: str, request: dict) -> tuple[bool, str]:
        """Validate that a request conforms to AgentGuard policies."""
        ...
