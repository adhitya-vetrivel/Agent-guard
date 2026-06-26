from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RiskEventResponse(BaseModel):
    id: str
    agent_id: str
    agent_name: Optional[str] = None
    severity: str
    risk_score: float
    reason: str
    tool_name: Optional[str] = None
    triggered_containment: bool
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
