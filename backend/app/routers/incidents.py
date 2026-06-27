import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.services.risk_explanation_service import IncidentService
from typing import Optional

router = APIRouter(prefix="/api/incidents", tags=["Incidents"])


@router.get("")
async def list_incidents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    export: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = IncidentService(session)
    incidents = await service.get_incidents(
        skip=skip, limit=limit,
        severity=severity, status=status, agent_id=agent_id,
    )
    result = []
    for inc in incidents:
        result.append({
            "id": inc.id,
            "agent_id": inc.agent_id,
            "agent_name": inc.agent_name,
            "agent_role": inc.agent_role,
            "severity": inc.severity.value if hasattr(inc.severity, 'value') else str(inc.severity),
            "status": inc.status.value if hasattr(inc.status, 'value') else str(inc.status),
            "trigger_reason": inc.trigger_reason,
            "trigger_type": inc.trigger_type,
            "timeline": json.loads(inc.timeline) if inc.timeline else [],
            "risk_breakdown": json.loads(inc.risk_breakdown) if inc.risk_breakdown else {},
            "actions_taken": json.loads(inc.actions_taken) if inc.actions_taken else [],
            "containment_status": inc.containment_status,
            "tools_invoked": json.loads(inc.tools_invoked) if inc.tools_invoked else [],
            "recommended_actions": json.loads(inc.recommended_actions) if inc.recommended_actions else [],
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
        })

    if export == "json":
        from app.services.operator_service import OperatorSecurityService
        op_service = OperatorSecurityService(session)
        await op_service.log_activity(
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            action="export_action",
            details="Operator exported incidents list as JSON"
        )
        return Response(content=json.dumps(result, indent=2), media_type="application/json",
                        headers={"Content-Disposition": "attachment; filename=incidents.json"})
    if export == "csv":
        from app.services.operator_service import OperatorSecurityService
        op_service = OperatorSecurityService(session)
        await op_service.log_activity(
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            action="export_action",
            details="Operator exported incidents list as CSV"
        )
        import csv, io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "agent_name", "severity", "status", "trigger_type", "trigger_reason", "created_at"])
        for r in result:
            writer.writerow([r["id"], r["agent_name"], r["severity"], r["status"], r["trigger_type"], r["trigger_reason"], r["created_at"]])
        return Response(content=output.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=incidents.csv"})

    return result


@router.get("/{incident_id}")
async def get_incident(
    incident_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = IncidentService(session)
    inc = await service.get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {
        "id": inc.id,
        "agent_id": inc.agent_id,
        "agent_name": inc.agent_name,
        "agent_role": inc.agent_role,
        "severity": inc.severity.value if hasattr(inc.severity, 'value') else str(inc.severity),
        "status": inc.status.value if hasattr(inc.status, 'value') else str(inc.status),
        "trigger_reason": inc.trigger_reason,
        "trigger_type": inc.trigger_type,
        "timeline": json.loads(inc.timeline) if inc.timeline else [],
        "risk_breakdown": json.loads(inc.risk_breakdown) if inc.risk_breakdown else {},
        "actions_taken": json.loads(inc.actions_taken) if inc.actions_taken else [],
        "containment_status": inc.containment_status,
        "tools_invoked": json.loads(inc.tools_invoked) if inc.tools_invoked else [],
        "recommended_actions": json.loads(inc.recommended_actions) if inc.recommended_actions else [],
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
    }


@router.post("/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    from app.models.incident_report import IncidentReport, IncidentStatus
    from sqlalchemy import select
    from datetime import datetime, timezone
    result = await session.execute(select(IncidentReport).where(IncidentReport.id == incident_id))
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    inc.status = IncidentStatus.RESOLVED
    inc.resolved_at = datetime.now(timezone.utc)
    await session.commit()
    
    # Audit log resolution
    from app.services.operator_service import OperatorSecurityService
    op_service = OperatorSecurityService(session)
    await op_service.log_activity(
        user_id=user.id,
        user_email=user.email,
        user_role=user.role.value,
        action="resolve_incident",
        details=f"Operator resolved incident {incident_id}"
    )
    
    return {"status": "ok", "message": "Incident resolved."}
