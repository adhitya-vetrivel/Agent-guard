from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.tool_call import ToolCall
from app.models.agent import Agent
import json


class BehaviorService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_tool_frequency(self, agent_id: str, hours: int = 1) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(func.count(ToolCall.id))
            .where(ToolCall.agent_id == agent_id)
            .where(ToolCall.created_at >= cutoff)
        )
        return result.scalar() or 0

    async def get_tool_sequence(self, agent_id: str, limit: int = 20) -> list[str]:
        result = await self.session.execute(
            select(ToolCall.tool_name)
            .where(ToolCall.agent_id == agent_id)
            .order_by(ToolCall.created_at.desc())
            .limit(limit)
        )
        return [row[0] for row in result.all()]

    async def get_denied_requests(self, agent_id: str, hours: int = 24) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(func.count(ToolCall.id))
            .where(ToolCall.agent_id == agent_id)
            .where(ToolCall.decision == "DENIED")
            .where(ToolCall.created_at >= cutoff)
        )
        return result.scalar() or 0

    async def get_tool_diversity(self, agent_id: str, hours: int = 24) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(func.count(func.distinct(ToolCall.tool_name)))
            .where(ToolCall.agent_id == agent_id)
            .where(ToolCall.created_at >= cutoff)
        )
        return result.scalar() or 0

    async def get_failed_attempts(self, agent_id: str, hours: int = 24) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(func.count(ToolCall.id))
            .where(ToolCall.agent_id == agent_id)
            .where(ToolCall.decision.in_(["DENIED", "ERROR"]))
            .where(ToolCall.created_at >= cutoff)
        )
        return result.scalar() or 0

    async def build_behavior_profile(self, agent_id: str) -> dict:
        return {
            "agent_id": agent_id,
            "tool_frequency_1h": await self.get_tool_frequency(agent_id, 1),
            "tool_frequency_24h": await self.get_tool_frequency(agent_id, 24),
            "denied_requests_24h": await self.get_denied_requests(agent_id, 24),
            "tool_diversity_24h": await self.get_tool_diversity(agent_id, 24),
            "failed_attempts_24h": await self.get_failed_attempts(agent_id, 24),
            "recent_tools": await self.get_tool_sequence(agent_id, 10),
        }

    async def detect_rapid_burst(self, agent_id: str) -> bool:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=10)
        result = await self.session.execute(
            select(func.count(ToolCall.id))
            .where(ToolCall.agent_id == agent_id)
            .where(ToolCall.created_at >= cutoff)
        )
        return (result.scalar() or 0) > 5

    async def detect_privilege_escalation(self, agent: Agent, tool_name: str) -> bool:
        tools_hierarchy = {
            "read_file": 1,
            "list_files": 1,
            "write_file": 2,
            "execute_command": 3,
            "root_shell": 5,
            "export_all_secrets": 5,
            "download_customer_database": 5,
        }
        current_level = tools_hierarchy.get(tool_name, 0)
        recent_tools = await self.get_tool_sequence(agent.id, 5)
        if not recent_tools:
            return False
        max_previous = max(tools_hierarchy.get(t, 0) for t in recent_tools)
        return (current_level - max_previous) >= 3
