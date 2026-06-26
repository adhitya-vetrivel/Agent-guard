from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.services.trust_graph import TrustGraphService

router = APIRouter(prefix="/api/trust-graph", tags=["Trust Graph"])


class CreateEdgeRequest(BaseModel):
    parent_agent_id: str
    child_agent_id: str
    relationship: str = "delegates"
    delegated_permissions: Optional[list[str]] = None
    trust_inheritance: bool = True
    trust_level: float = 1.0
    ttl_hours: Optional[int] = None


@router.get("")
async def get_trust_graph(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = TrustGraphService(session)
    return await service.get_full_graph()


@router.get("/children/{agent_id}")
async def get_children(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = TrustGraphService(session)
    return await service.get_children(agent_id)


@router.get("/parents/{agent_id}")
async def get_parents(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = TrustGraphService(session)
    return await service.get_parents(agent_id)


@router.post("/edges")
async def create_edge(
    request: CreateEdgeRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = TrustGraphService(session)
    edge = await service.create_edge(
        parent_agent_id=request.parent_agent_id,
        child_agent_id=request.child_agent_id,
        relationship=request.relationship,
        delegated_permissions=request.delegated_permissions,
        trust_inheritance=request.trust_inheritance,
        trust_level=request.trust_level,
        ttl_hours=request.ttl_hours,
    )
    return {"id": edge.id, "status": "created"}


@router.delete("/edges/{edge_id}")
async def delete_edge(
    edge_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = TrustGraphService(session)
    ok = await service.deactivate_edge(edge_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"status": "deleted"}
