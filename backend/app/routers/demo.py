from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from datetime import datetime, timezone

from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.models.demo_environment import DemoEnvironment
from app.models.agent import Agent
from app.models.tool_call import ToolCall
from app.models.audit_log import AuditLog
from app.models.risk_event import RiskEvent
from app.models.incident_report import IncidentReport
from app.models.risk_contribution import RiskContribution
from app.services.demo_service import seed_demo_data
from app.services.scenario_service import scenario_runner, SCENARIO_DEFINITIONS
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/api/demo", tags=["Demo Environment"])


@router.get("/state")
async def get_demo_state(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    result = await session.execute(select(DemoEnvironment))
    env = result.scalar_one_or_none()
    if not env:
        # Create default
        env = DemoEnvironment(is_active=False, current_scenario=None, status="idle")
        session.add(env)
        await session.commit()
    
    # Get current scenario runner status
    runner_state = scenario_runner.get_state()
    
    return {
        "is_active": env.is_active,
        "current_scenario": env.current_scenario,
        "status": env.status,
        "runner": runner_state
    }


@router.post("/enter")
async def enter_demo_environment(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    result = await session.execute(select(DemoEnvironment))
    env = result.scalar_one_or_none()
    if not env:
        env = DemoEnvironment(is_active=True, current_scenario=None, status="idle")
        session.add(env)
    else:
        env.is_active = True
        env.updated_at = datetime.now(timezone.utc)
    
    await session.flush()
    
    # Clean and Seed fresh demo data deterministically
    env.status = "resetting"
    await session.commit()
    
    await reset_demo_data_helper(session)
    
    env.status = "idle"
    await session.commit()
    
    await ws_manager.broadcast("demo_environment_started", {
        "is_active": True,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "ok", "message": "Demo Environment active and seeded."}


@router.post("/exit")
async def exit_demo_environment(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    result = await session.execute(select(DemoEnvironment))
    env = result.scalar_one_or_none()
    if env:
        env.is_active = False
        env.updated_at = datetime.now(timezone.utc)
        await session.commit()
        
    await ws_manager.broadcast("demo_environment_reset", {
        "is_active": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "ok", "message": "Exited Demo Environment."}


@router.post("/reset")
async def reset_demo_environment(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    result = await session.execute(select(DemoEnvironment))
    env = result.scalar_one_or_none()
    if not env or not env.is_active:
        raise HTTPException(status_code=400, detail="Demo Environment is not active")
        
    env.status = "resetting"
    await session.flush()
    
    # Stop scenario runner if running
    await scenario_runner.reset_runner()
    
    # Clear and re-seed
    await reset_demo_data_helper(session)
    
    env.status = "idle"
    env.current_scenario = None
    env.updated_at = datetime.now(timezone.utc)
    await session.commit()
    
    await ws_manager.broadcast("demo_environment_reset", {
        "is_active": True,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "ok", "message": "Demo Environment reset completed successfully."}


@router.post("/scenario/launch")
async def launch_demo_scenario(
    scenario_key: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user)
):
    result = await session.execute(select(DemoEnvironment))
    env = result.scalar_one_or_none()
    if not env or not env.is_active:
        raise HTTPException(status_code=400, detail="Demo Environment must be active to launch scenarios")
        
    if scenario_key not in SCENARIO_DEFINITIONS:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_key}' not found")
        
    # Reset runner first
    await scenario_runner.reset_runner()
    
    # Run the scenario
    res = await scenario_runner.start(scenario_key)
    
    env.current_scenario = scenario_key
    env.updated_at = datetime.now(timezone.utc)
    await session.commit()
    
    return {"status": "started", "scenario_key": scenario_key, "detail": res}


async def reset_demo_data_helper(session: AsyncSession):
    # 1. Fetch all demo agents to delete cleanly
    agent_stmt = select(Agent.id).where(Agent.is_demo == True)
    agent_res = await session.execute(agent_stmt)
    demo_agent_ids = list(agent_res.scalars().all())
    
    if demo_agent_ids:
        # Delete related tables
        await session.execute(delete(ToolCall).where(ToolCall.agent_id.in_(demo_agent_ids)))
        await session.execute(delete(RiskEvent).where(RiskEvent.agent_id.in_(demo_agent_ids)))
        await session.execute(delete(IncidentReport).where(IncidentReport.agent_id.in_(demo_agent_ids)))
        await session.execute(delete(RiskContribution).where(RiskContribution.agent_id.in_(demo_agent_ids)))
        await session.execute(delete(AuditLog).where(AuditLog.agent_id.in_(demo_agent_ids)))
        await session.execute(delete(Agent).where(Agent.id.in_(demo_agent_ids)))
    
    # Also delete operator anomaly incidents that might have user email targets or null agent_ids in demo mode
    await session.execute(delete(IncidentReport).where(IncidentReport.trigger_type == "operator_anomaly"))
    
    await session.flush()
    
    # 2. Seed clean demo data
    await seed_demo_data()
