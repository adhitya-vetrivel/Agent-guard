from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AgentRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., max_length=255)
    capabilities: list[str] = Field(default_factory=list)
    public_key: Optional[str] = None


class AgentResponse(BaseModel):
    id: str
    name: str
    role: str
    capabilities: list[str]
    risk_score: float
    status: str
    last_seen: Optional[datetime] = None
    session_id: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentDetail(AgentResponse):
    jwt_identity: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class RiskAdjustment(BaseModel):
    level: str
    restriction: str
    score_range: str


class EffectivePermissionsResponse(BaseModel):
    agent_id: str
    agent_name: str
    current_risk_score: float
    current_status: str
    base_permissions: list[str]
    base_denied: list[str]
    risk_adjustments: list[RiskAdjustment]
    effective_restrictions: list[str]
    effective_permissions: list[str]
