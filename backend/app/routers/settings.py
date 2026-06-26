from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any
from app.security.auth import get_admin_user
from app.models.user import User
from app.config.settings import settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])

_runtime_settings: dict[str, Any] = {
    "containment_threshold": settings.DEFAULT_RISK_THRESHOLD,
    "demo_mode": settings.DEMO_MODE,
    "rate_limit_per_minute": settings.RATE_LIMIT_PER_MINUTE,
    "app_name": settings.APP_NAME,
    "anomaly_contamination": 0.1,
    "decoy_tool_penalty": 100,
    "denied_call_penalty": 15,
    "rapid_burst_penalty": 10,
    "privilege_escalation_penalty": 35,
    "active_palette": "cyberpunk",
    "available_palettes": [
        {"id": "cyberpunk", "name": "Cyberpunk", "primary": "142 100% 50%"},
        {"id": "neon", "name": "Neon", "primary": "180 100% 50%"},
        {"id": "sunset", "name": "Sunset", "primary": "15 100% 50%"},
        {"id": "royal", "name": "Royal", "primary": "260 100% 50%"},
        {"id": "ruby", "name": "Ruby", "primary": "340 100% 50%"},
        {"id": "ocean", "name": "Ocean", "primary": "200 100% 50%"},
        {"id": "amber", "name": "Amber", "primary": "45 100% 50%"},
        {"id": "violet", "name": "Violet", "primary": "280 100% 50%"},
    ],
}


class SettingsUpdate(BaseModel):
    containment_threshold: int | None = None
    demo_mode: bool | None = None
    rate_limit_per_minute: int | None = None
    anomaly_contamination: float | None = None
    decoy_tool_penalty: int | None = None
    denied_call_penalty: int | None = None
    active_palette: str | None = None


@router.get("")
async def get_settings(
    _user: User = Depends(get_admin_user),
):
    return _runtime_settings


@router.put("")
async def update_settings(
    data: SettingsUpdate,
    _user: User = Depends(get_admin_user),
):
    updates = data.model_dump(exclude_none=True)
    if "containment_threshold" in updates and not (1 <= updates["containment_threshold"] <= 100):
        raise HTTPException(status_code=400, detail="Threshold must be 1-100")
    _runtime_settings.update(updates)
    return _runtime_settings
