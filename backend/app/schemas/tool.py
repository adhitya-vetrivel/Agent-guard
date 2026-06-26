from pydantic import BaseModel, Field
from typing import Optional, Any


class ToolExecuteRequest(BaseModel):
    agent_id: str
    tool_name: str = Field(..., max_length=255)
    tool_args: dict[str, Any] = Field(default_factory=dict)


class ToolExecuteResponse(BaseModel):
    id: str
    agent_id: str
    tool_name: str
    decision: str
    risk_score: float
    reason: Optional[str] = None
    execution_time_ms: Optional[float] = None
    is_honeytool: bool = False
    result: Optional[Any] = None
