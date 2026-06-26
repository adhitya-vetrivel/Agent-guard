from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import get_session
from app.schemas.agent import AgentRegister, AgentResponse, AgentDetail, AgentUpdate
from app.schemas.audit import AuditLogResponse
from app.services.agent_service import AgentService
from app.services.behavior_service import BehaviorService
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction
from app.security.auth import get_current_user, get_admin_user
from app.models.user import User
import json

router = APIRouter(prefix="/api/agents", tags=["Agents"])


@router.post("/register", response_model=AgentDetail)
async def register_agent(
    data: AgentRegister,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = AgentService(session)
    agent = await service.create_agent(data)
    audit = AuditService(session)
    await audit.log(
        action=AuditAction.AGENT_REGISTER,
        agent_id=agent.id,
        agent_name=agent.name,
        user_id=user.id,
        details=f"Agent {agent.name} registered with role {agent.role}",
    )
    return _agent_to_detail(agent)


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = AgentService(session)
    agents = await service.get_agents(skip, limit)
    return [_agent_to_response(a) for a in agents]


@router.get("/{agent_id}", response_model=AgentDetail)
async def get_agent(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = AgentService(session)
    agent = await service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_detail(agent)


@router.patch("/{agent_id}")
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = AgentService(session)
    agent = await service.update_agent(agent_id, data)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_detail(agent)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = AgentService(session)
    deleted = await service.delete_agent(agent_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")
    audit = AuditService(session)
    await audit.log(
        action=AuditAction.AGENT_DELETE,
        agent_id=agent_id,
        user_id=user.id,
        details=f"Agent {agent_id} deleted",
    )
    return {"message": "Agent deleted"}


@router.post("/{agent_id}/unquarantine")
async def unquarantine_agent(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = AgentService(session)
    agent = await service.unquarantine_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    audit = AuditService(session)
    await audit.log(
        action=AuditAction.AGENT_UNQUARANTINE,
        agent_id=agent_id,
        agent_name=agent.name,
        user_id=user.id,
        details=f"Agent {agent.name} unquarantined by admin",
    )
    return _agent_to_detail(agent)


@router.post("/{agent_id}/block")
async def block_agent(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    service = AgentService(session)
    agent = await service.block_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    audit = AuditService(session)
    await audit.log(
        action=AuditAction.AGENT_BLOCK,
        agent_id=agent_id,
        agent_name=agent.name,
        user_id=user.id,
        details=f"Agent {agent.name} blocked by admin",
    )
    return _agent_to_detail(agent)


@router.get("/{agent_id}/behavior")
async def get_agent_behavior(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = AgentService(session)
    agent = await service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    behavior = BehaviorService(session)
    profile = await behavior.build_behavior_profile(agent_id)
    return profile


@router.get("/{agent_id}/audit", response_model=list[AuditLogResponse])
async def get_agent_audit(
    agent_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    audit = AuditService(session)
    logs = await audit.get_logs(skip=skip, limit=limit, agent_id=agent_id)
    return [
        AuditLogResponse.model_validate(log) for log in logs
    ]


def _agent_to_response(agent) -> AgentResponse:
    return AgentResponse(
        id=agent.id,
        name=agent.name,
        role=agent.role,
        capabilities=json.loads(agent.capabilities) if isinstance(agent.capabilities, str) else agent.capabilities,
        risk_score=agent.risk_score,
        status=agent.status.value,
        last_seen=agent.last_seen,
        session_id=agent.session_id,
        is_demo=agent.is_demo,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


def _agent_to_detail(agent) -> AgentDetail:
    return AgentDetail(
        id=agent.id,
        name=agent.name,
        role=agent.role,
        capabilities=json.loads(agent.capabilities) if isinstance(agent.capabilities, str) else agent.capabilities,
        risk_score=agent.risk_score,
        status=agent.status.value,
        last_seen=agent.last_seen,
        session_id=agent.session_id,
        is_demo=agent.is_demo,
        jwt_identity=agent.jwt_identity,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )
