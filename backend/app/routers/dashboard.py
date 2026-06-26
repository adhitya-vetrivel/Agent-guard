from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import get_session
from app.schemas.dashboard import DashboardResponse, DashboardStats
from app.services.agent_service import AgentService
from app.services.audit_service import AuditService
from app.services.behavior_service import BehaviorService
from app.models.tool_call import ToolCall
from app.models.risk_event import RiskEvent
from app.models.agent import Agent
from app.models.audit_log import AuditLog
from sqlalchemy import select, func
from app.security.auth import get_current_user
from app.models.user import User
import json

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    agent_service = AgentService(session)
    audit_service = AuditService(session)

    stats_data = await agent_service.get_agent_stats()
    stats = DashboardStats(**stats_data)

    risk_over_time = await audit_service.get_risk_over_time()
    tool_usage = await audit_service.get_tool_usage()
    agent_activity = await audit_service.get_agent_activity()

    recent_calls_result = await session.execute(
        select(ToolCall).order_by(ToolCall.created_at.desc()).limit(10)
    )
    recent_tool_calls = [
        {
            "id": tc.id,
            "agent_name": tc.agent_name,
            "tool_name": tc.tool_name,
            "decision": tc.decision,
            "risk_score": tc.risk_score,
            "created_at": tc.created_at.isoformat() if tc.created_at else None,
            "is_honeytool": tc.is_honeytool,
        }
        for tc in recent_calls_result.scalars().all()
    ]

    recent_events_result = await session.execute(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20)
    )
    recent_events = [
        {
            "id": e.id,
            "action": e.action.value if hasattr(e.action, 'value') else str(e.action),
            "agent_name": e.agent_name,
            "tool_name": e.tool_name,
            "decision": e.decision,
            "risk_score": e.risk_score,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in recent_events_result.scalars().all()
    ]

    return DashboardResponse(
        stats=stats,
        recent_events=recent_events,
        risk_over_time=risk_over_time,
        tool_usage=tool_usage,
        agent_activity=agent_activity,
        recent_tool_calls=recent_tool_calls,
    )
