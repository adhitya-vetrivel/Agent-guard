from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, cast, String
from app.models.audit_log import AuditLog, AuditAction
from app.models.tool_call import ToolCall
from typing import Optional


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        action: AuditAction,
        agent_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        tool_name: Optional[str] = None,
        decision: Optional[str] = None,
        risk_score: Optional[float] = None,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        session_id: Optional[str] = None,
        details: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> AuditLog:
        log_entry = AuditLog(
            action=action,
            agent_id=agent_id,
            agent_name=agent_name,
            tool_name=tool_name,
            decision=decision,
            risk_score=risk_score,
            reason=reason,
            ip_address=ip_address,
            session_id=session_id,
            details=details,
            user_id=user_id,
        )
        self.session.add(log_entry)
        await self.session.flush()
        return log_entry

    async def get_logs(
        self, skip: int = 0, limit: int = 100,
        action: Optional[str] = None,
        agent_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[AuditLog]:
        from app.services.demo_service import is_demo_mode_active
        from app.models.agent import Agent
        is_demo = await is_demo_mode_active(self.session)
        
        query = select(AuditLog).join(Agent, AuditLog.agent_id == Agent.id, isouter=True).where(
            or_(Agent.is_demo == is_demo, AuditLog.agent_id == None)
        )
        if action:
            query = query.where(AuditLog.action == action)
        if agent_id:
            query = query.where(AuditLog.agent_id == agent_id)
        if search:
            query = query.where(
                or_(
                    AuditLog.agent_name.ilike(f"%{search}%"),
                    AuditLog.tool_name.ilike(f"%{search}%"),
                    AuditLog.reason.ilike(f"%{search}%"),
                    AuditLog.action.ilike(f"%{search}%"),
                )
            )
        query = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_risk_over_time(self, hours: int = 24) -> list[dict]:
        from app.models.risk_event import RiskEvent
        from app.models.tool_call import ToolCall
        from app.models.agent import Agent
        from app.services.demo_service import is_demo_mode_active
        is_demo = await is_demo_mode_active(self.session)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

        # Try risk events first
        result = await self.session.execute(
            select(RiskEvent)
            .join(Agent, RiskEvent.agent_id == Agent.id)
            .where(RiskEvent.created_at >= cutoff, Agent.is_demo == is_demo)
            .order_by(RiskEvent.created_at.asc())
        )
        events = result.scalars().all()
        source_data: list[tuple[datetime, float]] = [(e.created_at, e.risk_score) for e in events]

        # Fallback to tool_calls if no risk events
        if not source_data:
            tc_result = await self.session.execute(
                select(ToolCall.created_at, ToolCall.risk_score)
                .join(Agent, ToolCall.agent_id == Agent.id)
                .where(ToolCall.created_at >= cutoff, Agent.is_demo == is_demo)
                .order_by(ToolCall.created_at.asc())
            )
            rows = tc_result.all()
            source_data = [(row[0], row[1]) for row in rows if row[0]]

        buckets: dict[str, list[float]] = {}
        for ts, score in source_data:
            key = ts.strftime("%H:00")
            if key not in buckets:
                buckets[key] = []
            buckets[key].append(score)

        result_list = [
            {"time": k, "avg_score": round(sum(v) / len(v), 1), "max_score": max(v), "count": len(v)}
            for k, v in sorted(buckets.items())
        ]

        return result_list

    async def get_tool_usage(self, hours: int = 24) -> list[dict]:
        from app.models.agent import Agent
        from app.services.demo_service import is_demo_mode_active
        is_demo = await is_demo_mode_active(self.session)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(ToolCall.tool_name, func.count(ToolCall.id).label("count"))
            .join(Agent, ToolCall.agent_id == Agent.id)
            .where(ToolCall.created_at >= cutoff, Agent.is_demo == is_demo)
            .group_by(ToolCall.tool_name)
            .order_by(func.count(ToolCall.id).desc())
            .limit(20)
        )
        return [{"tool": row[0], "count": row[1]} for row in result.all()]

    async def get_agent_activity(self, hours: int = 24) -> list[dict]:
        from app.models.agent import Agent
        from app.services.demo_service import is_demo_mode_active
        is_demo = await is_demo_mode_active(self.session)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(ToolCall.agent_name, func.count(ToolCall.id).label("count"))
            .join(Agent, ToolCall.agent_id == Agent.id)
            .where(ToolCall.created_at >= cutoff, Agent.is_demo == is_demo)
            .group_by(ToolCall.agent_name)
            .order_by(func.count(ToolCall.id).desc())
            .limit(20)
        )
        return [{"agent": row[0] or "unknown", "count": row[1]} for row in result.all()]
