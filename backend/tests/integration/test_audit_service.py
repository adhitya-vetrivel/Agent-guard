import uuid
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.audit_service import AuditService
from app.models.audit_log import AuditLog, AuditAction
from app.models.agent import Agent, AgentStatus
from app.models.tool_call import ToolCall


class TestAuditService:
    @pytest.mark.asyncio
    async def test_log(self, session: AsyncSession, sample_agent: Agent):
        service = AuditService(session)
        entry = await service.log(
            action=AuditAction.TOOL_EXECUTE,
            agent_id=sample_agent.id,
            agent_name=sample_agent.name,
            tool_name="search_web",
            decision="ALLOWED",
            risk_score=10.0,
        )
        assert entry.id is not None
        assert entry.action == AuditAction.TOOL_EXECUTE
        assert entry.agent_id == sample_agent.id
        assert entry.tool_name == "search_web"

    @pytest.mark.asyncio
    async def test_get_logs_empty(self, session: AsyncSession):
        service = AuditService(session)
        logs = await service.get_logs()
        assert logs == []

    @pytest.mark.asyncio
    async def test_get_logs_with_data(self, session: AsyncSession, sample_agent: Agent):
        service = AuditService(session)
        await service.log(
            action=AuditAction.TOOL_EXECUTE,
            agent_id=sample_agent.id,
            agent_name=sample_agent.name,
            tool_name="search_web",
        )
        await service.log(
            action=AuditAction.AGENT_BLOCK,
            agent_id=sample_agent.id,
            agent_name=sample_agent.name,
        )
        logs = await service.get_logs()
        assert len(logs) == 2

    @pytest.mark.asyncio
    async def test_get_logs_filter_by_action(self, session: AsyncSession, sample_agent: Agent):
        service = AuditService(session)
        await service.log(action=AuditAction.TOOL_EXECUTE, agent_id=sample_agent.id, agent_name=sample_agent.name)
        await service.log(action=AuditAction.AGENT_BLOCK, agent_id=sample_agent.id, agent_name=sample_agent.name)
        filtered = await service.get_logs(action="TOOL_EXECUTE")
        assert len(filtered) == 1
        assert filtered[0].action == AuditAction.TOOL_EXECUTE

    @pytest.mark.asyncio
    async def test_get_logs_filter_by_agent(self, session: AsyncSession, sample_agent: Agent):
        other_id = str(uuid.uuid4())
        service = AuditService(session)
        await service.log(action=AuditAction.TOOL_EXECUTE, agent_id=sample_agent.id, agent_name=sample_agent.name)
        await service.log(action=AuditAction.TOOL_EXECUTE, agent_id=other_id, agent_name="Other")
        filtered = await service.get_logs(agent_id=sample_agent.id)
        assert len(filtered) == 1

    @pytest.mark.asyncio
    async def test_get_logs_search(self, session: AsyncSession, sample_agent: Agent):
        service = AuditService(session)
        await service.log(action=AuditAction.TOOL_EXECUTE, agent_id=sample_agent.id, agent_name="AlphaAgent", tool_name="search")
        await service.log(action=AuditAction.TOOL_EXECUTE, agent_id=sample_agent.id, agent_name="BetaAgent", tool_name="read")
        searched = await service.get_logs(search="Alpha")
        assert len(searched) == 1
        assert searched[0].agent_name == "AlphaAgent"

    @pytest.mark.asyncio
    async def test_get_risk_over_time_empty(self, session: AsyncSession):
        service = AuditService(session)
        data = await service.get_risk_over_time(24)
        assert data == []

    @pytest.mark.asyncio
    async def test_get_risk_over_time_with_risk_events(self, session: AsyncSession, sample_agent: Agent):
        from app.models.risk_event import RiskEvent, RiskSeverity
        service = AuditService(session)
        now = datetime.now(timezone.utc)
        for i in range(3):
            re = RiskEvent(
                id=str(uuid.uuid4()),
                agent_id=sample_agent.id,
                agent_name=sample_agent.name,
                severity=RiskSeverity.WARNING,
                risk_score=float(30 + i * 10),
                reason=f"Test event {i}",
                created_at=now,
            )
            session.add(re)
        await session.flush()
        data = await service.get_risk_over_time(24)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_get_tool_usage(self, session: AsyncSession, sample_agent: Agent):
        service = AuditService(session)
        now = datetime.now(timezone.utc)
        for tool in ["search_web", "search_web", "read_file"]:
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
        usage = await service.get_tool_usage(24)
        search = next((u for u in usage if u["tool"] == "search_web"), None)
        assert search is not None
        assert search["count"] == 2

    @pytest.mark.asyncio
    async def test_get_agent_activity(self, session: AsyncSession, sample_agent: Agent):
        service = AuditService(session)
        now = datetime.now(timezone.utc)
        for _ in range(3):
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
        activity = await service.get_agent_activity(24)
        agent_act = next((a for a in activity if a["agent"] == sample_agent.name), None)
        assert agent_act is not None
        assert agent_act["count"] == 3
