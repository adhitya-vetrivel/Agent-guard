import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.agent_service import AgentService
from app.schemas.agent import AgentRegister, AgentUpdate
from app.models.agent import Agent, AgentStatus


class TestAgentService:
    @pytest.mark.asyncio
    async def test_create_agent(self, session: AsyncSession):
        service = AgentService(session)
        data = AgentRegister(name="NewAgent", role="dev", capabilities=["search_web"])
        agent = await service.create_agent(data)
        assert agent.name == "NewAgent"
        assert agent.role == "dev"
        assert agent.status == AgentStatus.ACTIVE
        assert agent.risk_score == 0.0
        assert agent.id is not None

    @pytest.mark.asyncio
    async def test_get_agent(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        agent = await service.get_agent(sample_agent.id)
        assert agent is not None
        assert agent.id == sample_agent.id
        assert agent.name == "TestAgent"

    @pytest.mark.asyncio
    async def test_get_agent_not_found(self, session: AsyncSession):
        service = AgentService(session)
        agent = await service.get_agent("nonexistent-id")
        assert agent is None

    @pytest.mark.asyncio
    async def test_get_agents(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        agents = await service.get_agents()
        assert len(agents) >= 1
        assert any(a.id == sample_agent.id for a in agents)

    @pytest.mark.asyncio
    async def test_update_agent(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        updated = await service.update_agent(sample_agent.id, AgentUpdate(name="UpdatedName"))
        assert updated is not None
        assert updated.name == "UpdatedName"

    @pytest.mark.asyncio
    async def test_update_agent_not_found(self, session: AsyncSession):
        service = AgentService(session)
        updated = await service.update_agent("nonexistent", AgentUpdate(name="X"))
        assert updated is None

    @pytest.mark.asyncio
    async def test_delete_agent(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        result = await service.delete_agent(sample_agent.id)
        assert result == True
        deleted = await service.get_agent(sample_agent.id)
        assert deleted is None

    @pytest.mark.asyncio
    async def test_delete_agent_not_found(self, session: AsyncSession):
        service = AgentService(session)
        result = await service.delete_agent("nonexistent")
        assert result == False

    @pytest.mark.asyncio
    async def test_block_agent(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        blocked = await service.block_agent(sample_agent.id)
        assert blocked is not None
        assert blocked.status == AgentStatus.BLOCKED

    @pytest.mark.asyncio
    async def test_unquarantine_agent(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        sample_agent.status = AgentStatus.QUARANTINED
        await session.flush()
        unquarantined = await service.unquarantine_agent(sample_agent.id)
        assert unquarantined is not None
        assert unquarantined.status == AgentStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_set_risk_score(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        updated = await service.set_risk_score(sample_agent.id, 75.5)
        assert updated is not None
        assert updated.risk_score == 75.5

    @pytest.mark.asyncio
    async def test_set_risk_score_clamps(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        updated = await service.set_risk_score(sample_agent.id, 150.0)
        assert updated is not None
        assert updated.risk_score == 100.0
        updated = await service.set_risk_score(sample_agent.id, -10.0)
        assert updated is not None
        assert updated.risk_score == 0.0

    @pytest.mark.asyncio
    async def test_get_agent_stats(self, session: AsyncSession, sample_agent: Agent):
        service = AgentService(session)
        stats = await service.get_agent_stats()
        assert stats["total_agents"] >= 1
        assert stats["active_agents"] >= 1
        assert "total_tool_calls" in stats
        assert "average_risk_score" in stats
