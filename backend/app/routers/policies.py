from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import get_session
from app.schemas.policy import PolicyCreate, PolicyUpdate, PolicyResponse
from app.services.policy_service import PolicyService
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction
from app.security.auth import get_admin_user
from app.models.user import User
import json

router = APIRouter(prefix="/api/policies", tags=["Policies"])


@router.post("", response_model=PolicyResponse)
async def create_policy(
    data: PolicyCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = PolicyService(session)
    policy = await service.create_policy(data)
    audit = AuditService(session)
    await audit.log(
        action=AuditAction.POLICY_CREATE,
        user_id=user.id,
        details=f"Policy '{policy.name}' created",
    )
    return _policy_to_response(policy)


@router.get("", response_model=list[PolicyResponse])
async def list_policies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = PolicyService(session)
    policies = await service.get_policies(skip, limit)
    return [_policy_to_response(p) for p in policies]


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    policy_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = PolicyService(session)
    policy = await service.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return _policy_to_response(policy)


@router.put("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: str,
    data: PolicyUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = PolicyService(session)
    policy = await service.update_policy(policy_id, data)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    audit = AuditService(session)
    await audit.log(
        action=AuditAction.POLICY_UPDATE,
        user_id=user.id,
        details=f"Policy '{policy.name}' updated",
    )
    return _policy_to_response(policy)


@router.delete("/{policy_id}")
async def delete_policy(
    policy_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = PolicyService(session)
    deleted = await service.delete_policy(policy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Policy not found")
    audit = AuditService(session)
    await audit.log(
        action=AuditAction.POLICY_DELETE,
        user_id=user.id,
        details=f"Policy {policy_id} deleted",
    )
    return {"message": "Policy deleted"}


def _policy_to_response(policy) -> PolicyResponse:
    return PolicyResponse(
        id=policy.id,
        name=policy.name,
        description=policy.description,
        allowed_tools=json.loads(policy.allowed_tools) if isinstance(policy.allowed_tools, str) else policy.allowed_tools,
        denied_tools=json.loads(policy.denied_tools) if isinstance(policy.denied_tools, str) else policy.denied_tools,
        agent_id=policy.agent_id,
        role=policy.role,
        task_scope=policy.task_scope,
        permission_expiry=policy.permission_expiry,
        is_active=policy.is_active,
        created_at=policy.created_at,
        updated_at=policy.updated_at,
    )
