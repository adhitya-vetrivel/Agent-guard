import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.risk_service import RiskService
from app.models.agent import Agent, AgentStatus
from app.models.risk_event import RiskEvent, RiskSeverity
from app.models.tool_call import ToolCall


class TestRiskServiceIntegration:
    @pytest.mark.asyncio
    async def test_calculate_risk_honeytool(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
        score, reasons = await service.calculate_risk(
            sample_agent, "export_all_secrets", policy_allowed=False, is_honeytool=True
        )
        assert score == 100.0
        assert any("honeytool" in r.lower() for r in reasons)

    @pytest.mark.asyncio
    async def test_calculate_risk_denied_call(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
        score, reasons = await service.calculate_risk(
            sample_agent, "unknown_tool", policy_allowed=False, is_honeytool=False
        )
        assert score > 0
        assert any("denied" in r.lower() for r in reasons)

    @pytest.mark.asyncio
    async def test_calculate_risk_unknown_tool(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
        score, reasons = await service.calculate_risk(
            sample_agent, "completely_unknown_tool", policy_allowed=True, is_honeytool=False
        )
        assert any("unknown" in r.lower() for r in reasons)

    @pytest.mark.asyncio
    async def test_calculate_risk_rapid_burst(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
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
        score, reasons = await service.calculate_risk(
            sample_agent, "search_web", policy_allowed=True, is_honeytool=False
        )
        assert any("burst" in r.lower() for r in reasons)

    @pytest.mark.asyncio
    async def test_calculate_risk_privilege_escalation(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
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
        score, reasons = await service.calculate_risk(
            sample_agent, "root_shell", policy_allowed=True, is_honeytool=False
        )
        assert any("privilege" in r.lower() for r in reasons)

    @pytest.mark.asyncio
    async def test_calculate_risk_normal_operation(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
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
        score, reasons = await service.calculate_risk(
            sample_agent, "search_web", policy_allowed=True, is_honeytool=False
        )
        assert score == 0.0
        assert reasons == []

    @pytest.mark.asyncio
    async def test_calculate_risk_clamps_score(self, session: AsyncSession, sample_agent_with_risk: Agent):
        service = RiskService(session)
        score, reasons = await service.calculate_risk(
            sample_agent_with_risk, "unknown_tool", policy_allowed=False, is_honeytool=False
        )
        assert 0 <= score <= 100

    @pytest.mark.asyncio
    async def test_create_risk_event(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
        event = await service.create_risk_event(
            agent=sample_agent,
            score=75.0,
            reason="Test risk event",
            tool_name="search_web",
            triggered_containment=False,
        )
        assert event.id is not None
        assert event.risk_score == 75.0
        assert event.severity == RiskSeverity.HIGH
        assert event.agent_id == sample_agent.id

    @pytest.mark.asyncio
    async def test_contain_agent(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
        result = await service.contain_agent(sample_agent)
        assert result["status"] == "QUARANTINED"
        assert result["risk_score"] == 100.0
        assert result["agent_id"] == sample_agent.id

        await session.refresh(sample_agent)
        assert sample_agent.status == AgentStatus.QUARANTINED
        assert sample_agent.risk_score == 100.0
        assert sample_agent.jwt_identity is None

    @pytest.mark.asyncio
    async def test_contain_agent_creates_risk_event(self, session: AsyncSession, sample_agent: Agent):
        service = RiskService(session)
        await service.contain_agent(sample_agent)
        from sqlalchemy import select
        result = await session.execute(
            select(RiskEvent).where(RiskEvent.agent_id == sample_agent.id)
        )
        events = result.scalars().all()
        assert len(events) == 1
        assert events[0].triggered_containment == True
        assert events[0].risk_score == 100.0
