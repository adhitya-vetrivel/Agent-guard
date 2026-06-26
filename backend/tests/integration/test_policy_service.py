import uuid
import json
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.policy_service import PolicyService
from app.schemas.policy import PolicyCreate, PolicyUpdate
from app.models.policy import Policy
from app.models.agent import Agent, AgentStatus


class TestPolicyService:
    @pytest.mark.asyncio
    async def test_create_policy(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        data = PolicyCreate(
            name="Test Policy",
            description="A test policy",
            allowed_tools=["search_web", "read_file"],
            denied_tools=["export_all_secrets"],
            agent_id=sample_agent.id,
        )
        policy = await service.create_policy(data)
        assert policy.name == "Test Policy"
        assert json.loads(policy.allowed_tools) == ["search_web", "read_file"]
        assert json.loads(policy.denied_tools) == ["export_all_secrets"]
        assert policy.is_active == True

    @pytest.mark.asyncio
    async def test_get_policy(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        policy = await service.create_policy(
            PolicyCreate(name="GetTest", allowed_tools=["read_file"], denied_tools=[])
        )
        fetched = await service.get_policy(policy.id)
        assert fetched is not None
        assert fetched.id == policy.id

    @pytest.mark.asyncio
    async def test_get_policy_not_found(self, session: AsyncSession):
        service = PolicyService(session)
        assert await service.get_policy("nonexistent") is None

    @pytest.mark.asyncio
    async def test_get_policies(self, session: AsyncSession):
        service = PolicyService(session)
        await service.create_policy(
            PolicyCreate(name="Policy1", allowed_tools=[], denied_tools=[])
        )
        await service.create_policy(
            PolicyCreate(name="Policy2", allowed_tools=[], denied_tools=[])
        )
        policies = await service.get_policies()
        assert len(policies) >= 2

    @pytest.mark.asyncio
    async def test_update_policy(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        policy = await service.create_policy(
            PolicyCreate(name="Original", allowed_tools=["read_file"], denied_tools=[])
        )
        updated = await service.update_policy(
            policy.id, PolicyUpdate(name="Updated", allowed_tools=["search_web"])
        )
        assert updated is not None
        assert updated.name == "Updated"
        assert json.loads(updated.allowed_tools) == ["search_web"]

    @pytest.mark.asyncio
    async def test_update_policy_not_found(self, session: AsyncSession):
        service = PolicyService(session)
        assert await service.update_policy("nonexistent", PolicyUpdate(name="X")) is None

    @pytest.mark.asyncio
    async def test_delete_policy(self, session: AsyncSession):
        service = PolicyService(session)
        policy = await service.create_policy(
            PolicyCreate(name="ToDelete", allowed_tools=[], denied_tools=[])
        )
        assert await service.delete_policy(policy.id) == True
        assert await service.get_policy(policy.id) is None

    @pytest.mark.asyncio
    async def test_delete_policy_not_found(self, session: AsyncSession):
        service = PolicyService(session)
        assert await service.delete_policy("nonexistent") == False

    @pytest.mark.asyncio
    async def test_get_policy_for_agent_by_agent_id(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        await service.create_policy(
            PolicyCreate(
                name="AgentPolicy",
                allowed_tools=["search_web"],
                denied_tools=[],
                agent_id=sample_agent.id,
            )
        )
        policy = await service.get_policy_for_agent(sample_agent)
        assert policy is not None
        assert policy.name == "AgentPolicy"

    @pytest.mark.asyncio
    async def test_get_policy_for_agent_by_role(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        await service.create_policy(
            PolicyCreate(
                name="RolePolicy",
                allowed_tools=["read_file"],
                denied_tools=[],
                role="research",
            )
        )
        policy = await service.get_policy_for_agent(sample_agent)
        assert policy is not None
        assert policy.name == "RolePolicy"

    @pytest.mark.asyncio
    async def test_get_policy_for_agent_prefers_agent_id(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        await service.create_policy(
            PolicyCreate(name="RolePolicy", allowed_tools=[], denied_tools=[], role="research")
        )
        await service.create_policy(
            PolicyCreate(name="AgentPolicy", allowed_tools=[], denied_tools=[], agent_id=sample_agent.id)
        )
        policy = await service.get_policy_for_agent(sample_agent)
        assert policy.name == "AgentPolicy"

    @pytest.mark.asyncio
    async def test_check_tool_allowed_no_policy(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        allowed, reason = await service.check_tool_allowed(sample_agent, "search_web")
        assert allowed == True
        assert "No policy defined" in reason

    @pytest.mark.asyncio
    async def test_check_tool_denied(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        await service.create_policy(
            PolicyCreate(
                name="DenyPolicy",
                allowed_tools=[],
                denied_tools=["search_web"],
                agent_id=sample_agent.id,
            )
        )
        allowed, reason = await service.check_tool_allowed(sample_agent, "search_web")
        assert allowed == False
        assert "denied" in reason.lower()

    @pytest.mark.asyncio
    async def test_check_tool_not_in_allowed(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        await service.create_policy(
            PolicyCreate(
                name="StrictPolicy",
                allowed_tools=["read_file"],
                denied_tools=[],
                agent_id=sample_agent.id,
            )
        )
        allowed, reason = await service.check_tool_allowed(sample_agent, "search_web")
        assert allowed == False
        assert "not in allowed tools" in reason.lower()

    @pytest.mark.asyncio
    async def test_check_tool_expired_permission(self, session: AsyncSession, sample_agent: Agent):
        service = PolicyService(session)
        expired = datetime.now(timezone.utc) - timedelta(hours=1)
        await service.create_policy(
            PolicyCreate(
                name="ExpiredPolicy",
                allowed_tools=["search_web"],
                denied_tools=[],
                agent_id=sample_agent.id,
                permission_expiry=expired,
            )
        )
        allowed, reason = await service.check_tool_allowed(sample_agent, "search_web")
        assert allowed == False
        assert "expired" in reason.lower()
