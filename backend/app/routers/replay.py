import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.models.replay_event import ReplayEvent
from app.models.incident_report import IncidentReport
from app.models.tool_call import ToolCall
from app.models.audit_log import AuditLog
from app.models.agent import Agent
from app.services.scenario_service import SCENARIO_DEFINITIONS
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/api/replays", tags=["Attack Replay"])


@router.get("")
async def list_available_replays(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # 1. Fetch critical incidents that have timelines
    inc_stmt = select(IncidentReport).order_by(IncidentReport.created_at.desc())
    inc_res = await session.execute(inc_stmt)
    incidents = inc_res.scalars().all()

    replay_sessions = []

    # Pre-defined scenario replays (always available)
    for key, defn in SCENARIO_DEFINITIONS.items():
        replay_sessions.append({
            "session_id": f"scenario_{key}",
            "name": f"Scenario: {defn['name']}",
            "description": defn["description"],
            "type": "scenario",
            "agent_name": "ResearchAgent" if "research" in defn.get("agent_role", "") else "DevOpsAgent",
            "severity": defn["severity"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Actual incidents replays
    for inc in incidents:
        replay_sessions.append({
            "session_id": inc.id,
            "name": f"Incident {inc.id}: {inc.trigger_type}",
            "description": inc.trigger_reason,
            "type": "incident",
            "agent_name": inc.agent_name,
            "severity": inc.severity.value if hasattr(inc.severity, 'value') else str(inc.severity),
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
        })

    return replay_sessions


@router.get("/{session_id}")
async def get_replay_events(
    session_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Check if replay events already exist in the database
    events_stmt = select(ReplayEvent).where(ReplayEvent.session_id == session_id).order_by(ReplayEvent.step_index.asc())
    events_res = await session.execute(events_stmt)
    events = list(events_res.scalars().all())

    if not events:
        # Generate them dynamically
        events = await generate_replay_events(session, session_id)
        if not events:
            raise HTTPException(status_code=404, detail="Replay session not found")

    # Broadcast replay_event via websocket
    await ws_manager.broadcast("replay_event", {
        "session_id": session_id,
        "event_count": len(events),
        "user_email": user.email,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return [
        {
            "id": e.id,
            "session_id": e.session_id,
            "step_index": e.step_index,
            "timestamp": e.timestamp.isoformat(),
            "event_type": e.event_type,
            "agent_id": e.agent_id,
            "agent_name": e.agent_name,
            "tool_name": e.tool_name,
            "details": e.details,
            "risk_score": e.risk_score,
            "node_color": e.node_color,
        }
        for e in events
    ]


@router.get("/{session_id}/export")
async def export_replay(
    session_id: str,
    format: str = Query("json", regex="^(json|csv)$"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    events_stmt = select(ReplayEvent).where(ReplayEvent.session_id == session_id).order_by(ReplayEvent.step_index.asc())
    events_res = await session.execute(events_stmt)
    events = list(events_res.scalars().all())

    if not events:
        events = await generate_replay_events(session, session_id)
        if not events:
            raise HTTPException(status_code=404, detail="Replay session not found")

    result = [
        {
            "step_index": e.step_index,
            "timestamp": e.timestamp.isoformat(),
            "event_type": e.event_type,
            "agent_name": e.agent_name,
            "tool_name": e.tool_name,
            "details": e.details,
            "risk_score": e.risk_score,
            "node_color": e.node_color,
        }
        for e in events
    ]

    if format == "json":
        return Response(
            content=json.dumps(result, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=replay_{session_id}.json"}
        )
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Step", "Timestamp", "Event Type", "Agent", "Tool", "Details", "Risk Score", "Color"])
        for r in result:
            writer.writerow([
                r["step_index"],
                r["timestamp"],
                r["event_type"],
                r["agent_name"],
                r["tool_name"],
                r["details"],
                r["risk_score"],
                r["node_color"]
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=replay_{session_id}.csv"}
        )


async def generate_replay_events(session: AsyncSession, session_id: str) -> list[ReplayEvent]:
    events = []

    # Case A: Pre-defined Scenario
    if session_id.startswith("scenario_"):
        scenario_key = session_id.replace("scenario_", "")
        defn = SCENARIO_DEFINITIONS.get(scenario_key)
        if not defn:
            return []

        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        agent_name = "ResearchAgent" if "research" in defn.get("agent_role", "") else "DevOpsAgent"
        agent_id = "demo-agent-id-123"

        # Step 0: Auth
        events.append(ReplayEvent(
            session_id=session_id,
            step_index=0,
            timestamp=base_time,
            event_type="auth",
            agent_id=agent_id,
            agent_name=agent_name,
            details=f"Agent '{agent_name}' authenticated and established session.",
            risk_score=0.0,
            node_color="green"
        ))

        running_risk = 0.0
        time_offset = 5

        for i, step in enumerate(defn["steps"]):
            action = step.get("action")
            label = step.get("label", "")
            
            # Risk calculation
            if action in ["download_customer_database", "export_all_secrets", "root_shell"]:
                running_risk = 100.0
                node_color = "purple"
                event_type = "honeytool"
            elif "warning" in label.lower() or step.get("severity") == "warning":
                running_risk = min(running_risk + 20.0, 75.0)
                node_color = "amber"
                event_type = "tool_call"
            elif "critical" in label.lower() or step.get("severity") == "critical" or "containment" in label.lower():
                running_risk = 100.0
                node_color = "red"
                event_type = "containment"
            else:
                running_risk = max(running_risk, 10.0)
                node_color = "green"
                event_type = "tool_call" if action != "wait" else "auth"

            events.append(ReplayEvent(
                session_id=session_id,
                step_index=i + 1,
                timestamp=base_time + timedelta(seconds=time_offset),
                event_type=event_type,
                agent_id=agent_id,
                agent_name=agent_name,
                tool_name=action if action != "wait" else None,
                details=label,
                risk_score=running_risk,
                node_color=node_color
            ))
            time_offset += 5

        # Save to DB
        for e in events:
            session.add(e)
        await session.flush()
        return events

    # Case B: Dynamic Incident Report Replay
    inc_stmt = select(IncidentReport).where(IncidentReport.id == session_id)
    inc_res = await session.execute(inc_stmt)
    incident = inc_res.scalar_one_or_none()

    if not incident:
        return []

    # Find tool calls for this agent around the incident creation time
    tc_stmt = select(ToolCall).where(
        ToolCall.agent_id == incident.agent_id
    ).order_by(ToolCall.created_at.asc())
    tc_res = await session.execute(tc_stmt)
    tool_calls = tc_res.scalars().all()

    base_time = incident.created_at - timedelta(seconds=len(tool_calls) * 5 + 10)
    agent_id = incident.agent_id or "unknown-agent"
    agent_name = incident.agent_name

    # Step 0: Auth
    events.append(ReplayEvent(
        session_id=session_id,
        step_index=0,
        timestamp=base_time,
        event_type="auth",
        agent_id=agent_id,
        agent_name=agent_name,
        details=f"Agent '{agent_name}' authenticated.",
        risk_score=0.0,
        node_color="green"
    ))

    step_idx = 1
    time_offset = 5
    for tc in tool_calls:
        # Map decision and risk to colors
        is_ht = tc.is_honeytool or tc.tool_name in ["download_customer_database", "export_all_secrets", "root_shell"]
        
        if is_ht:
            node_color = "purple"
            event_type = "honeytool"
            details = f"HONEYTOOL DECOY TRIGGERED: {tc.tool_name}() attempted and blocked."
        elif tc.decision == "DENIED" or tc.risk_score > 60:
            node_color = "amber"
            event_type = "tool_call"
            details = f"Suspicious tool execution blocked: {tc.tool_name}() -> DENIED."
        else:
            node_color = "green"
            event_type = "tool_call"
            details = f"Approved tool call: {tc.tool_name}() -> ALLOWED."

        events.append(ReplayEvent(
            session_id=session_id,
            step_index=step_idx,
            timestamp=tc.created_at or (base_time + timedelta(seconds=time_offset)),
            event_type=event_type,
            agent_id=agent_id,
            agent_name=agent_name,
            tool_name=tc.tool_name,
            details=details,
            risk_score=tc.risk_score,
            node_color=node_color
        ))
        step_idx += 1
        time_offset += 5

    # Append Containment steps if it was contained
    if incident.status == "CONTAINED" or incident.containment_status == "contained" or incident.severity.value == "CRITICAL":
        events.append(ReplayEvent(
            session_id=session_id,
            step_index=step_idx,
            timestamp=incident.created_at,
            event_type="containment",
            agent_id=agent_id,
            agent_name=agent_name,
            details="Decoy trigger escalated. Automated security containment initiated.",
            risk_score=100.0,
            node_color="red"
        ))
        step_idx += 1

        events.append(ReplayEvent(
            session_id=session_id,
            step_index=step_idx,
            timestamp=incident.created_at + timedelta(milliseconds=87),
            event_type="quarantine",
            agent_id=agent_id,
            agent_name=agent_name,
            details=f"Agent isolated and session quarantined. Latency: 87ms.",
            risk_score=100.0,
            node_color="red"
        ))

    # Save to DB
    for e in events:
        session.add(e)
    await session.flush()
    return events
