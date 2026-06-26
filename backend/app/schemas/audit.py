from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: str
    timestamp: datetime
    action: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    tool_name: Optional[str] = None
    decision: Optional[str] = None
    risk_score: Optional[float] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    session_id: Optional[str] = None
    details: Optional[str] = None
    user_id: Optional[str] = None

    class Config:
        from_attributes = True
