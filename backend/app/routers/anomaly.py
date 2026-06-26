from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.models.agent import Agent
from app.models.tool_call import ToolCall
from app.models.audit_log import AuditLog
from app.models.risk_event import RiskEvent, RiskSeverity
from app.services.behavior_service import BehaviorService
from app.anomaly.detector import anomaly_detector
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/anomaly", tags=["Anomaly"])


@router.get("/dashboard")
async def get_anomaly_dashboard(
    session: AsyncSession = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    result = await session.execute(select(Agent).where(Agent.is_demo == True))
    agents = result.scalars().all()

    behavior_service = BehaviorService(session)
    profiles = []
    for agent in agents:
        profile = await behavior_service.build_behavior_profile(agent.id)
        features = anomaly_detector.extract_features(profile)
        is_anomaly, anomaly_score = anomaly_detector.predict(features)
        profiles.append({
            "agent_id": agent.id,
            "agent_name": agent.name,
            "risk_score": agent.risk_score,
            "status": agent.status.value,
            "is_anomaly": is_anomaly,
            "anomaly_score": round(anomaly_score, 3),
            "tool_frequency_1h": profile.get("tool_frequency_1h", 0),
            "tool_frequency_24h": profile.get("tool_frequency_24h", 0),
            "denied_requests_24h": profile.get("denied_requests_24h", 0),
            "tool_diversity_24h": profile.get("tool_diversity_24h", 0),
            "failed_attempts_24h": profile.get("failed_attempts_24h", 0),
        })

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    events_result = await session.execute(
        select(RiskEvent).where(RiskEvent.created_at >= cutoff).order_by(RiskEvent.created_at.desc()).limit(50)
    )
    events = [
        {
            "id": e.id,
            "agent_name": e.agent_name,
            "severity": e.severity.value,
            "risk_score": e.risk_score,
            "reason": e.reason,
            "tool_name": e.tool_name,
            "created_at": e.created_at.isoformat(),
        }
        for e in events_result.scalars().all()
    ]

    total_calls_result = await session.execute(
        select(func.count(ToolCall.id))
    )
    total_calls = total_calls_result.scalar() or 0

    anomaly_count = sum(1 for p in profiles if p["is_anomaly"])

    return {
        "profiles": profiles,
        "events": events,
        "total_calls": total_calls,
        "anomaly_count": anomaly_count,
        "model_initialized": anomaly_detector.initialized,
        "samples_collected": len(anomaly_detector.feature_buffer),
    }


@router.get("/events")
async def get_anomaly_events(
    session: AsyncSession = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    result = await session.execute(
        select(AuditLog)
        .where(AuditLog.timestamp >= cutoff)
        .where(AuditLog.details.contains("anomaly"))
        .order_by(AuditLog.timestamp.desc())
        .limit(100)
    )
    logs = result.scalars().all()

    events = []
    for log in logs:
        details = {}
        if log.details:
            try:
                import json
                details = json.loads(log.details)
            except (json.JSONDecodeError, TypeError):
                pass
        events.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "agent_name": log.agent_name,
            "tool_name": log.tool_name,
            "decision": log.decision,
            "is_anomaly": details.get("is_anomaly", False),
            "anomaly_score": details.get("anomaly_score", 0),
            "reason": log.reason,
        })

    return events
