from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    allowed_tools: list[str] = Field(default_factory=list)
    denied_tools: list[str] = Field(default_factory=list)
    agent_id: Optional[str] = None
    role: Optional[str] = None
    task_scope: Optional[str] = None
    permission_expiry: Optional[datetime] = None


class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    allowed_tools: Optional[list[str]] = None
    denied_tools: Optional[list[str]] = None
    agent_id: Optional[str] = None
    role: Optional[str] = None
    task_scope: Optional[str] = None
    permission_expiry: Optional[datetime] = None
    is_active: Optional[bool] = None


class PolicyResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    allowed_tools: list[str]
    denied_tools: list[str]
    agent_id: Optional[str] = None
    role: Optional[str] = None
    task_scope: Optional[str] = None
    permission_expiry: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
