from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.services.risk_explanation_service import RiskExplanationService

router = APIRouter(prefix="/api/risk", tags=["Risk"])


@router.get("/{agent_id}/explanation")
async def get_risk_explanation(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = RiskExplanationService(session)
    explanation = await service.get_explanation(agent_id)
    if "error" in explanation:
        raise HTTPException(status_code=404, detail=explanation["error"])
    return explanation
