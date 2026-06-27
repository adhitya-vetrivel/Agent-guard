from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.models.agent import Agent, AgentStatus
from app.models.tool_call import ToolCall
from app.models.risk_event import RiskEvent
from app.schemas.agent import AgentRegister, AgentUpdate
import json


class AgentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_agent(self, data: AgentRegister, is_demo: bool = False) -> Agent:
        agent = Agent(
            name=data.name,
            role=data.role,
            capabilities=json.dumps(data.capabilities),
            public_key=data.public_key,
            status=AgentStatus.ACTIVE,
            is_demo=is_demo,
        )
        self.session.add(agent)
        await self.session.flush()
        return agent

    async def get_agent(self, agent_id: str) -> Agent | None:
        from app.services.demo_service import is_demo_mode_active
        is_demo = await is_demo_mode_active(self.session)
        result = await self.session.execute(select(Agent).where(Agent.id == agent_id, Agent.is_demo == is_demo))
        return result.scalar_one_or_none()

    async def get_agents(self, skip: int = 0, limit: int = 100) -> list[Agent]:
        from app.services.demo_service import is_demo_mode_active
        is_demo = await is_demo_mode_active(self.session)
        result = await self.session.execute(
            select(Agent).where(Agent.is_demo == is_demo).offset(skip).limit(limit).order_by(Agent.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_agent(self, agent_id: str, data: AgentUpdate) -> Agent | None:
        agent = await self.get_agent(agent_id)
        if not agent:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if "status" in update_data:
            update_data["status"] = AgentStatus(update_data["status"])
        for key, value in update_data.items():
            setattr(agent, key, value)
        agent.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return agent

    async def delete_agent(self, agent_id: str) -> bool:
        agent = await self.get_agent(agent_id)
        if not agent:
            return False
        await self.session.delete(agent)
        await self.session.flush()
        return True

    async def block_agent(self, agent_id: str) -> Agent | None:
        return await self.update_agent(agent_id, AgentUpdate(status="BLOCKED"))

    async def unquarantine_agent(self, agent_id: str) -> Agent | None:
        return await self.update_agent(agent_id, AgentUpdate(status="ACTIVE"))

    async def set_risk_score(self, agent_id: str, score: float) -> Agent | None:
        agent = await self.get_agent(agent_id)
        if not agent:
            return None
        agent.risk_score = max(0.0, min(100.0, score))
        agent.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return agent

    async def get_agent_stats(self) -> dict:
        from datetime import datetime, timedelta, timezone
        total = await self.session.execute(select(func.count(Agent.id)))
        active = await self.session.execute(
            select(func.count(Agent.id)).where(Agent.status == AgentStatus.ACTIVE)
        )
        blocked = await self.session.execute(
            select(func.count(Agent.id)).where(Agent.status == AgentStatus.BLOCKED)
        )
        quarantined = await self.session.execute(
            select(func.count(Agent.id)).where(Agent.status == AgentStatus.QUARANTINED)
        )
        tool_calls = await self.session.execute(select(func.count(ToolCall.id)))
        threats = await self.session.execute(
            select(func.count(RiskEvent.id)).where(RiskEvent.severity == "CRITICAL")
        )
        avg_risk = await self.session.execute(select(func.avg(Agent.risk_score)))
        avg_val = avg_risk.scalar() or 0.0

        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        risk_today = await self.session.execute(
            select(func.count(RiskEvent.id)).where(RiskEvent.created_at >= today)
        )

        return {
            "total_agents": total.scalar() or 0,
            "active_agents": active.scalar() or 0,
            "blocked_agents": blocked.scalar() or 0,
            "quarantined_agents": quarantined.scalar() or 0,
            "total_tool_calls": tool_calls.scalar() or 0,
            "threats_detected": threats.scalar() or 0,
            "risk_events_today": risk_today.scalar() or 0,
            "average_risk_score": round(float(avg_val), 2),
        }
