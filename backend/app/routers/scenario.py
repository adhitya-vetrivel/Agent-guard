from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.services.scenario_service import (
    scenario_runner,
    list_scenario_definitions,
    get_scenario_definition,
)

router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"])


class ScenarioStartRequest(BaseModel):
    scenario_key: str


class ScenarioResponse(BaseModel):
    status: str
    message: Optional[str] = None
    scenario_key: Optional[str] = None


@router.get("/definitions")
async def list_scenarios(user: User = Depends(get_current_user)):
    return list_scenario_definitions()


@router.get("/definitions/{scenario_key}")
async def get_scenario(scenario_key: str, user: User = Depends(get_current_user)):
    defn = get_scenario_definition(scenario_key)
    if not defn:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_key}' not found")
    return defn


@router.post("/start")
async def start_scenario(
    request: ScenarioStartRequest,
    user: User = Depends(get_current_user),
):
    return await scenario_runner.start(request.scenario_key)


@router.post("/pause")
async def pause_scenario(user: User = Depends(get_current_user)):
    return await scenario_runner.pause()


@router.post("/stop")
async def stop_scenario(user: User = Depends(get_current_user)):
    return await scenario_runner.stop()


@router.post("/reset")
async def reset_scenario(user: User = Depends(get_current_user)):
    return await scenario_runner.reset_runner()


@router.get("/state")
async def get_state(user: User = Depends(get_current_user)):
    return scenario_runner.get_state()
