import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.replay_event import ReplayEvent
from app.models.incident_report import IncidentReport, IncidentSeverity, IncidentStatus
from app.routers.replay import generate_replay_events


@pytest.mark.asyncio
async def test_generate_replay_events_for_scenario(session: AsyncSession):
    # Test generating events for scenario_demo_attack
    events = await generate_replay_events(session, "scenario_demo_attack")
    assert len(events) > 0
    assert events[0].event_type == "auth"
    assert events[0].session_id == "scenario_demo_attack"

    # Check that events were saved in database
    result = await session.execute(
        select(ReplayEvent).where(ReplayEvent.session_id == "scenario_demo_attack")
    )
    saved_events = list(result.scalars().all())
    assert len(saved_events) == len(events)


@pytest.mark.asyncio
async def test_generate_replay_events_for_incident(session: AsyncSession):
    # Seed an incident report
    incident_id = f"INC-2026-{str(uuid.uuid4())[:4].upper()}"
    incident = IncidentReport(
        id=incident_id,
        agent_id="test-agent-id",
        agent_name="ResearchAgent",
        agent_role="research",
        severity=IncidentSeverity.CRITICAL,
        status=IncidentStatus.CONTAINED,
        trigger_reason="Test HoneyTool trigger",
        trigger_type="honeytool",
        created_at=datetime.now(timezone.utc),
    )
    session.add(incident)
    await session.flush()
    
    # Generate events
    events = await generate_replay_events(session, incident_id)
    assert len(events) >= 3  # Auth, Honeytool/Toolcall, Containment, Quarantine
    assert events[0].event_type == "auth"
    assert events[-1].event_type == "quarantine"
    assert events[-1].node_color == "red"
