from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class DashboardStats(BaseModel):
    total_agents: int
    active_agents: int
    blocked_agents: int
    quarantined_agents: int
    total_tool_calls: int
    threats_detected: int
    risk_events_today: int
    average_risk_score: float


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_events: list[Any]
    risk_over_time: list[Any]
    tool_usage: list[Any]
    agent_activity: list[Any]
    recent_tool_calls: list[Any]
