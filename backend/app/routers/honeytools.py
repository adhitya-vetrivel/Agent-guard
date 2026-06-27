from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.models.tool_call import ToolCall
from app.models.risk_event import RiskEvent
from app.services.honeytools import (
    get_all_honeytools, get_honeytools_by_type, honeytool_tracker,
    HONEYTOOL_DEFINITIONS,
)
from typing import Optional

router = APIRouter(prefix="/api/honeytools", tags=["HoneyTools"])


@router.get("")
async def list_honeytools(user: User = Depends(get_current_user)):
    return {
        "honeytools": get_all_honeytools(),
        "by_type": get_honeytools_by_type(),
        "stats": honeytool_tracker.get_stats(),
    }


@router.get("/triggers")
async def get_honeytool_triggers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Get honeytool triggers from the database
    honeytool_names = list(HONEYTOOL_DEFINITIONS.keys())

    # Get tool calls that were honeytools
    result = await session.execute(
        select(ToolCall)
        .where(ToolCall.is_honeytool == True)
        .order_by(ToolCall.created_at.desc())
        .offset(skip).limit(limit)
    )
    triggers = result.scalars().all()

    # Get containment events
    containment_result = await session.execute(
        select(RiskEvent)
        .where(RiskEvent.triggered_containment == True)
        .order_by(RiskEvent.created_at.desc())
        .limit(limit)
    )
    containment_events = containment_result.scalars().all()

    return {
        "triggers": [
            {
                "id": t.id,
                "tool_name": t.tool_name,
                "agent_id": t.agent_id,
                "agent_name": t.agent_name,
                "decision": t.decision,
                "risk_score": t.risk_score,
                "reason": t.reason,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in triggers
        ],
        "containment_events": [
            {
                "id": e.id,
                "agent_id": e.agent_id,
                "agent_name": e.agent_name,
                "severity": e.severity.value if hasattr(e.severity, 'value') else str(e.severity),
                "risk_score": e.risk_score,
                "reason": e.reason,
                "tool_name": e.tool_name,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in containment_events
        ],
        "in_memory_stats": honeytool_tracker.get_stats(),
    }


@router.post("/{tool_name}/toggle")
async def toggle_honeytool(
    tool_name: str,
    user: User = Depends(get_current_user),
):
    from app.services.honeytools import honeytool_state
    if tool_name not in honeytool_state:
        raise HTTPException(status_code=404, detail=f"Honeytool '{tool_name}' not found")
    current = honeytool_state[tool_name]["enabled"]
    honeytool_state[tool_name]["enabled"] = not current
    return {"name": tool_name, "enabled": honeytool_state[tool_name]["enabled"]}


@router.post("/{tool_name}/config")
async def update_honeytool_config(
    tool_name: str,
    config: dict,
    user: User = Depends(get_current_user),
):
    from app.services.honeytools import honeytool_state
    if tool_name not in honeytool_state:
        raise HTTPException(status_code=404, detail=f"Honeytool '{tool_name}' not found")
    if "severity_override" in config:
        honeytool_state[tool_name]["severity_override"] = config["severity_override"]
    if "containment_override" in config:
        honeytool_state[tool_name]["containment_override"] = config["containment_override"]
    return {"name": tool_name, "config": honeytool_state[tool_name]}


@router.get("/state")
async def get_honeytool_state(
    user: User = Depends(get_current_user),
):
    from app.services.honeytools import honeytool_state, HONEYTOOL_DEFINITIONS
    return {
        tool: {
            **honeytool_state[tool],
            "definition": HONEYTOOL_DEFINITIONS.get(tool),
        }
        for tool in honeytool_state
    }


@router.get("/{tool_name}")
async def get_honeytool_detail(
    tool_name: str,
    user: User = Depends(get_current_user),
):
    defn = HONEYTOOL_DEFINITIONS.get(tool_name)
    if not defn:
        raise HTTPException(status_code=404, detail=f"Honeytool '{tool_name}' not found")
    return {
        "name": tool_name,
        **defn,
        "trigger_count": honeytool_tracker.trigger_counts.get(tool_name, 0),
    }
