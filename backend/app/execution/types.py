from pydantic import BaseModel
from typing import Any, Optional


class ToolExecutionResult(BaseModel):
    success: bool
    output: Any = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0
