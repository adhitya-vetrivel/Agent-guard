from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User, UserRole
from app.models.operator_activity import OperatorActivity, OperatorRisk
from app.services.operator_service import OperatorSecurityService

router = APIRouter(prefix="/api/operator", tags=["Operator Security"])


@router.get("/activities")
async def list_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(OperatorActivity)
        .order_by(OperatorActivity.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    activities = result.scalars().all()
    return [
        {
            "id": act.id,
            "user_id": act.user_id,
            "user_email": act.user_email,
            "action": act.action,
            "details": act.details,
            "risk_delta": act.risk_delta,
            "ip_address": act.ip_address,
            "is_anomalous": act.is_anomalous,
            "anomaly_reason": act.anomaly_reason,
            "created_at": act.created_at.isoformat(),
        }
        for act in activities
    ]


@router.get("/risks")
async def get_risks(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.execute(select(OperatorRisk).order_by(OperatorRisk.risk_score.desc()))
    risks = result.scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_email": r.user_email,
            "risk_score": r.risk_score,
            "anomaly_level": r.anomaly_level,
            "login_failures": r.login_failures,
            "policy_edits": r.policy_edits,
            "containment_actions": r.containment_actions,
            "role_changes": r.role_changes,
            "settings_changes": r.settings_changes,
            "user_creations": r.user_creations,
            "export_actions": r.export_actions,
            "after_hours_access": r.after_hours_access,
            "last_updated": r.last_updated.isoformat() if r.last_updated else None,
        }
        for r in risks
    ]


@router.post("/reset")
async def reset_operator_risks(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can reset operator monitoring data.")
    
    await session.execute(delete(OperatorActivity))
    await session.execute(delete(OperatorRisk))
    await session.commit()
    return {"status": "reset", "message": "Operator security logs and risk profiles cleared."}
