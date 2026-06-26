from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.models.agent import Agent
from app.models.tool_call import ToolCall
from app.models.risk_event import RiskEvent
from app.services.behavior_service import BehaviorService
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/compare", tags=["Compare"])


@router.get("/agents")
async def compare_agents(
    ids: str = Query(..., description="Comma-separated agent IDs"),
    session: AsyncSession = Depends(get_session),
    _user: User = Depends(get_current_user),
):
    agent_ids = [id.strip() for id in ids.split(",") if id.strip()]
    if len(agent_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 agent IDs required")
    if len(agent_ids) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 agents can be compared")

    result = await session.execute(select(Agent).where(Agent.id.in_(agent_ids)))
    agents = result.scalars().all()

    if len(agents) != len(agent_ids):
        raise HTTPException(status_code=404, detail="One or more agents not found")

    behavior_service = BehaviorService(session)
    comparisons = []
    cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    for agent in agents:
        profile = await behavior_service.build_behavior_profile(agent.id)

        calls_result = await session.execute(
            select(ToolCall)
            .where(ToolCall.agent_id == agent.id)
            .where(ToolCall.created_at >= cutoff_24h)
            .order_by(ToolCall.created_at.desc())
            .limit(20)
        )
        recent_calls = [
            {
                "tool_name": tc.tool_name,
                "decision": tc.decision,
                "risk_score": tc.risk_score,
                "created_at": tc.created_at.isoformat(),
            }
            for tc in calls_result.scalars().all()
        ]

        risk_result = await session.execute(
            select(RiskEvent)
            .where(RiskEvent.agent_id == agent.id)
            .where(RiskEvent.created_at >= cutoff_24h)
            .order_by(RiskEvent.created_at.desc())
        )
        risk_events = [
            {
                "severity": re.severity.value,
                "risk_score": re.risk_score,
                "reason": re.reason,
                "created_at": re.created_at.isoformat(),
            }
            for re in risk_result.scalars().all()
        ]

        comparisons.append({
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "status": agent.status.value,
            "risk_score": agent.risk_score,
            "capabilities": agent.capabilities,
            "last_seen": agent.last_seen.isoformat() if agent.last_seen else None,
            "behavior": {
                "tool_frequency_1h": profile.get("tool_frequency_1h", 0),
                "tool_frequency_24h": profile.get("tool_frequency_24h", 0),
                "denied_requests_24h": profile.get("denied_requests_24h", 0),
                "tool_diversity_24h": profile.get("tool_diversity_24h", 0),
                "failed_attempts_24h": profile.get("failed_attempts_24h", 0),
            },
            "recent_calls": recent_calls,
            "risk_events": risk_events,
        })

    return comparisons
