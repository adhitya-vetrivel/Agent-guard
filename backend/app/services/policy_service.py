from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.policy import Policy
from app.models.agent import Agent
from app.schemas.policy import PolicyCreate, PolicyUpdate
import json


class PolicyService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_policy(self, data: PolicyCreate) -> Policy:
        policy = Policy(
            name=data.name,
            description=data.description,
            allowed_tools=json.dumps(data.allowed_tools),
            denied_tools=json.dumps(data.denied_tools),
            agent_id=data.agent_id,
            role=data.role,
            task_scope=data.task_scope,
            permission_expiry=data.permission_expiry,
        )
        self.session.add(policy)
        await self.session.flush()
        return policy

    async def get_policy(self, policy_id: str) -> Policy | None:
        result = await self.session.execute(select(Policy).where(Policy.id == policy_id))
        return result.scalar_one_or_none()

    async def get_policies(self, skip: int = 0, limit: int = 100) -> list[Policy]:
        result = await self.session.execute(
            select(Policy).offset(skip).limit(limit).order_by(Policy.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_policy(self, policy_id: str, data: PolicyUpdate) -> Policy | None:
        policy = await self.get_policy(policy_id)
        if not policy:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if "allowed_tools" in update_data and isinstance(update_data["allowed_tools"], list):
            update_data["allowed_tools"] = json.dumps(update_data["allowed_tools"])
        if "denied_tools" in update_data and isinstance(update_data["denied_tools"], list):
            update_data["denied_tools"] = json.dumps(update_data["denied_tools"])
        for key, value in update_data.items():
            setattr(policy, key, value)
        policy.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return policy

    async def delete_policy(self, policy_id: str) -> bool:
        policy = await self.get_policy(policy_id)
        if not policy:
            return False
        await self.session.delete(policy)
        await self.session.flush()
        return True

    async def get_policy_for_agent(self, agent: Agent) -> Policy | None:
        result = await self.session.execute(
            select(Policy).where(
                (Policy.agent_id == agent.id) | (Policy.role == agent.role)
            ).where(Policy.is_active == True)
        )
        policies = list(result.scalars().all())
        agent_policy = next((p for p in policies if p.agent_id == agent.id), None)
        if agent_policy:
            return agent_policy
        role_policy = next((p for p in policies if p.role == agent.role), None)
        return role_policy

    async def check_tool_allowed(self, agent: Agent, tool_name: str) -> tuple[bool, str]:
        policy = await self.get_policy_for_agent(agent)
        if not policy:
            return True, "No policy defined, allowing by default"
        denied = json.loads(policy.denied_tools)
        if tool_name in denied:
            return False, f"Tool '{tool_name}' is denied by policy '{policy.name}'"
        allowed = json.loads(policy.allowed_tools)
        if allowed and tool_name not in allowed:
            return False, f"Tool '{tool_name}' is not in allowed tools for policy '{policy.name}'"
        if policy.permission_expiry and datetime.now(timezone.utc) > policy.permission_expiry:
            return False, "Permission has expired"
        return True, "Tool is allowed"
