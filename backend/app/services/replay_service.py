import asyncio
import json
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tool_call import ToolCall
from app.models.risk_event import RiskEvent
from app.models.audit_log import AuditLog
from app.models.agent import Agent


class ReplayService:
    def __init__(self):
        self.active_replays: dict[str, dict] = {}

    async def build_sequence(self, session: AsyncSession, incident_id: str | None = None, agent_id: str | None = None, limit: int = 100) -> list[dict]:
        sequence = []
        tool_calls = await session.execute(
            select(ToolCall).order_by(ToolCall.created_at.asc()).limit(limit)
        )
        for tc in tool_calls.scalars().all():
            sequence.append({
                "type": "tool_call",
                "timestamp": tc.created_at.isoformat() if tc.created_at else "",
                "agent_id": tc.agent_id,
                "agent_name": tc.agent_name,
                "tool_name": tc.tool_name,
                "decision": tc.decision,
                "risk_score": tc.risk_score,
                "is_honeytool": tc.is_honeytool,
                "reason": tc.reason,
            })

        risk_events = await session.execute(
            select(RiskEvent).order_by(RiskEvent.created_at.asc()).limit(limit)
        )
        for re in risk_events.scalars().all():
            sequence.append({
                "type": "risk_event",
                "timestamp": re.created_at.isoformat() if re.created_at else "",
                "agent_id": re.agent_id,
                "agent_name": re.agent_name,
                "severity": re.severity.value if hasattr(re.severity, 'value') else str(re.severity),
                "risk_score": re.risk_score,
                "reason": re.reason,
                "tool_name": re.tool_name,
                "triggered_containment": re.triggered_containment,
            })

        audits = await session.execute(
            select(AuditLog).order_by(AuditLog.timestamp.asc()).limit(limit)
        )
        for al in audits.scalars().all():
            sequence.append({
                "type": "audit",
                "timestamp": al.timestamp.isoformat() if al.timestamp else "",
                "action": al.action.value if hasattr(al.action, 'value') else str(al.action),
                "agent_id": al.agent_id,
                "agent_name": al.agent_name,
                "tool_name": al.tool_name,
                "decision": al.decision,
                "risk_score": al.risk_score,
                "reason": al.reason,
            })

        sequence.sort(key=lambda x: x.get("timestamp", ""))
        return sequence[:limit]

    def manage_replay(self, replay_id: str, action: str, speed: float = 1.0):
        if action == "start":
            self.active_replays[replay_id] = {
                "status": "playing", "current_index": 0, "speed": speed,
                "started_at": datetime.utcnow().isoformat(),
            }
        elif action == "pause" and replay_id in self.active_replays:
            self.active_replays[replay_id]["status"] = "paused"
        elif action == "stop" and replay_id in self.active_replays:
            self.active_replays[replay_id]["status"] = "stopped"
        elif action == "resume" and replay_id in self.active_replays:
            self.active_replays[replay_id]["status"] = "playing"
        elif action == "step" and replay_id in self.active_replays:
            r = self.active_replays[replay_id]
            r["current_index"] = min(r["current_index"] + 1, r.get("total_events", 0) - 1)
        elif action == "step_back" and replay_id in self.active_replays:
            r = self.active_replays[replay_id]
            r["current_index"] = max(r["current_index"] - 1, 0)
        elif action.startswith("seek") and replay_id in self.active_replays:
            parts = action.split(":")
            if len(parts) == 2:
                self.active_replays[replay_id]["current_index"] = int(parts[1])
        return self.active_replays.get(replay_id)

    def get_replay_state(self, replay_id: str):
        return self.active_replays.get(replay_id)


replay_service = ReplayService()
