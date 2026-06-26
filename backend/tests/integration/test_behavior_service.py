import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
import pytest_asyncio
from app.services.behavior_service import BehaviorService
from app.models.agent import Agent, AgentStatus
from app.models.tool_call import ToolCall


@pytest_asyncio.fixture
async def agent_with_tool_calls(session: AsyncSession) -> Agent:
    agent = Agent(
        id=str(uuid.uuid4()),
        name="BehaviorAgent",
        role="tester",
        capabilities="[]",
        status=AgentStatus.ACTIVE,
        risk_score=0.0,
        is_demo=False,
    )
    session.add(agent)
    await session.flush()

    tools = ["search_web", "read_file", "search_web", "http_get", "search_web"]
    decisions = ["ALLOWED", "ALLOWED", "ALLOWED", "ALLOWED", "DENIED"]
    for tool, decision in zip(tools, decisions):
        tc = ToolCall(
            id=str(uuid.uuid4()),
            agent_id=agent.id,
            agent_name=agent.name,
            tool_name=tool,
            decision=decision,
            risk_score=5.0 if decision == "DENIED" else 0.0,
            created_at=datetime.now(timezone.utc),
        )
        session.add(tc)
    await session.flush()
    return agent


class TestBehaviorService:
    @pytest.mark.asyncio
    async def test_get_tool_frequency(self, session: AsyncSession, agent_with_tool_calls: Agent):
        service = BehaviorService(session)
        freq = await service.get_tool_frequency(agent_with_tool_calls.id, 24)
        assert freq == 5

    @pytest.mark.asyncio
    async def test_get_tool_frequency_no_calls(self, session: AsyncSession, sample_agent: Agent):
        service = BehaviorService(session)
        freq = await service.get_tool_frequency(sample_agent.id, 24)
        assert freq == 0

    @pytest.mark.asyncio
    async def test_get_tool_sequence(self, session: AsyncSession, agent_with_tool_calls: Agent):
        service = BehaviorService(session)
        seq = await service.get_tool_sequence(agent_with_tool_calls.id, 10)
        assert len(seq) == 5

    @pytest.mark.asyncio
    async def test_get_denied_requests(self, session: AsyncSession, agent_with_tool_calls: Agent):
        service = BehaviorService(session)
        denied = await service.get_denied_requests(agent_with_tool_calls.id, 24)
        assert denied == 1

    @pytest.mark.asyncio
    async def test_get_tool_diversity(self, session: AsyncSession, agent_with_tool_calls: Agent):
        service = BehaviorService(session)
        diversity = await service.get_tool_diversity(agent_with_tool_calls.id, 24)
        assert diversity == 3

    @pytest.mark.asyncio
    async def test_get_failed_attempts(self, session: AsyncSession, agent_with_tool_calls: Agent):
        service = BehaviorService(session)
        failed = await service.get_failed_attempts(agent_with_tool_calls.id, 24)
        assert failed == 1

    @pytest.mark.asyncio
    async def test_build_behavior_profile(self, session: AsyncSession, agent_with_tool_calls: Agent):
        service = BehaviorService(session)
        profile = await service.build_behavior_profile(agent_with_tool_calls.id)
        assert profile["agent_id"] == agent_with_tool_calls.id
        assert profile["tool_frequency_24h"] == 5
        assert profile["denied_requests_24h"] == 1
        assert profile["tool_diversity_24h"] == 3
        assert len(profile["recent_tools"]) == 5

    @pytest.mark.asyncio
    async def test_detect_rapid_burst_false(self, session: AsyncSession, agent_with_tool_calls: Agent):
        service = BehaviorService(session)
        is_burst = await service.detect_rapid_burst(agent_with_tool_calls.id)
        assert is_burst == False

    @pytest.mark.asyncio
    async def test_detect_rapid_burst_true(self, session: AsyncSession, sample_agent: Agent):
        service = BehaviorService(session)
        now = datetime.now(timezone.utc)
        for _ in range(6):
            tc = ToolCall(
                id=str(uuid.uuid4()),
                agent_id=sample_agent.id,
                agent_name=sample_agent.name,
                tool_name="search_web",
                decision="ALLOWED",
                created_at=now,
            )
            session.add(tc)
        await session.flush()
        is_burst = await service.detect_rapid_burst(sample_agent.id)
        assert is_burst == True

    @pytest.mark.asyncio
    async def test_detect_privilege_escalation(self, session: AsyncSession, sample_agent: Agent):
        service = BehaviorService(session)
        now = datetime.now(timezone.utc)
        for tool in ["read_file", "list_files"]:
            tc = ToolCall(
                id=str(uuid.uuid4()),
                agent_id=sample_agent.id,
                agent_name=sample_agent.name,
                tool_name=tool,
                decision="ALLOWED",
                created_at=now,
            )
            session.add(tc)
        await session.flush()

        is_escalation = await service.detect_privilege_escalation(sample_agent, "root_shell")
        assert is_escalation == True

    @pytest.mark.asyncio
    async def test_detect_privilege_escalation_false(self, session: AsyncSession, sample_agent: Agent):
        service = BehaviorService(session)
        now = datetime.now(timezone.utc)
        tc = ToolCall(
            id=str(uuid.uuid4()),
            agent_id=sample_agent.id,
            agent_name=sample_agent.name,
            tool_name="search_web",
            decision="ALLOWED",
            created_at=now,
        )
        session.add(tc)
        await session.flush()

        is_escalation = await service.detect_privilege_escalation(sample_agent, "read_file")
        assert is_escalation == False
