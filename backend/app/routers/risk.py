from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import get_session
from app.schemas.risk import RiskEventResponse
from app.services.risk_service import RiskService
from app.models.risk_event import RiskEvent
from sqlalchemy import select
from app.security.auth import get_current_user, get_admin_user
from app.models.user import User
from typing import Optional

router = APIRouter(prefix="/api/risk-events", tags=["Risk Events"])


@router.get("", response_model=list[RiskEventResponse])
async def list_risk_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    severity: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    query = select(RiskEvent).order_by(RiskEvent.created_at.desc())
    if severity:
        query = query.where(RiskEvent.severity == severity)
    if agent_id:
        query = query.where(RiskEvent.agent_id == agent_id)
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    events = result.scalars().all()
    return [RiskEventResponse.model_validate(e) for e in events]


@router.delete("/clear")
async def clear_risk_events(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    from sqlalchemy import delete
    await session.execute(delete(RiskEvent))
    return {"message": "All risk events cleared"}
