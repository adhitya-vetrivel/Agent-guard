import time
import json
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.base import get_session
from app.schemas.tool import ToolExecuteRequest, ToolExecuteResponse
from app.services.agent_service import AgentService
from app.services.policy_service import PolicyService
from app.services.behavior_service import BehaviorService
from app.services.risk_service import RiskService
from app.services.honeytools import is_honeytool, get_honeytool_response
from app.services.audit_service import AuditService
from app.models.audit_log import AuditAction
from app.models.tool_call import ToolCall
from app.models.agent import AgentStatus
from app.anomaly.detector import anomaly_detector
from app.websocket.manager import ws_manager
from app.security.auth import get_current_user
from app.models.user import User
from app.execution.sandbox import TOOL_EXECUTORS, validate_args as sandbox_validate_args

router = APIRouter(prefix="/api", tags=["Execution"])


@router.post("/execute-tool", response_model=ToolExecuteResponse)
async def execute_tool(
    request: ToolExecuteRequest,
    fastapi_request: FastAPIRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    start_time = time.time()
    agent_service = AgentService(session)
    policy_service = PolicyService(session)
    behavior_service = BehaviorService(session)
    risk_service = RiskService(session)
    audit_service = AuditService(session)

    agent = await agent_service.get_agent(request.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.status == AgentStatus.BLOCKED:
        raise HTTPException(status_code=403, detail="Agent is blocked")
    if agent.status == AgentStatus.QUARANTINED:
        raise HTTPException(status_code=403, detail="Agent is quarantined")

    tool_name = request.tool_name
    honeytool = is_honeytool(tool_name)

    policy_allowed, policy_reason = await policy_service.check_tool_allowed(agent, tool_name)

    if honeytool:
        risk_score, risk_reasons = await risk_service.calculate_risk(agent, tool_name, False, True)
    else:
        risk_score, risk_reasons = await risk_service.calculate_risk(agent, tool_name, policy_allowed, False)

    if not policy_allowed and not honeytool:
        decision = "DENIED"
        reason = policy_reason
    elif honeytool:
        decision = "BLOCKED"
        reason = f"HONEYTOOL TRIGGERED: {tool_name}"
    elif risk_score > 80:
        decision = "BLOCKED"
        reason = f"Risk score {risk_score:.1f} exceeds threshold"
    else:
        decision = "ALLOWED"
        reason = "Tool execution approved"

    actual_execution_time = 0.0
    result = None

    if decision == "ALLOWED" and tool_name in TOOL_EXECUTORS:
        args_valid, args_error = sandbox_validate_args(tool_name, request.tool_args)
        if not args_valid:
            decision = "DENIED"
            reason = args_error
        else:
            executor = TOOL_EXECUTORS[tool_name]
            exec_result = await executor(**request.tool_args)
            result = exec_result.output
            actual_execution_time = exec_result.execution_time_ms
            if not exec_result.success:
                decision = "FAILED"
                reason = exec_result.error or "Execution failed"

    if honeytool:
        ht_response = get_honeytool_response(tool_name)
        result = ht_response["fake_response"]

    execution_time = (time.time() - start_time) * 1000
    recorded_time = actual_execution_time if actual_execution_time > 0 else round(execution_time, 2)

    tool_call = ToolCall(
        agent_id=agent.id,
        agent_name=agent.name,
        tool_name=tool_name,
        tool_args=json.dumps(request.tool_args),
        decision=decision,
        risk_score=risk_score,
        reason=reason,
        ip_address=fastapi_request.client.host if fastapi_request.client else None,
        session_id=agent.session_id,
        execution_time_ms=recorded_time,
        is_honeytool=honeytool,
    )
    session.add(tool_call)

    await agent_service.set_risk_score(agent.id, risk_score)

    if risk_score > 30:
        severity_str = risk_service.get_severity(risk_score).value
        await risk_service.create_risk_event(
            agent=agent,
            score=risk_score,
            reason="; ".join(risk_reasons) if risk_reasons else f"Risk score updated to {risk_score:.1f}",
            tool_name=tool_name,
            triggered_containment=False,
        )

    containment_event = None
    if await risk_service.should_contain(risk_score) or honeytool:
        containment_event = await risk_service.contain_agent(agent)
        await ws_manager.broadcast("containment", {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "risk_score": risk_score,
            "reason": reason,
            "tool_name": tool_name,
        })

    behavior_profile = await behavior_service.build_behavior_profile(agent.id)
    features = anomaly_detector.extract_features(behavior_profile)
    anomaly_detector.add_sample(features)
    is_anomaly, anomaly_score = anomaly_detector.predict(features)

    audit_action = AuditAction.TOOL_EXECUTE if decision == "ALLOWED" else AuditAction.TOOL_DENIED
    if honeytool:
        audit_action = AuditAction.DECOY_TRIGGER
    elif containment_event:
        audit_action = AuditAction.CONTAINMENT

    await audit_service.log(
        action=audit_action,
        agent_id=agent.id,
        agent_name=agent.name,
        tool_name=tool_name,
        decision=decision,
        risk_score=risk_score,
        reason=reason,
        session_id=agent.session_id,
        details=json.dumps({
            "risk_reasons": risk_reasons,
            "anomaly_detected": is_anomaly,
            "anomaly_score": round(anomaly_score, 3),
            "containment": containment_event is not None,
        }),
        user_id=user.id,
    )

    await ws_manager.broadcast("tool_execution", {
        "agent_id": agent.id,
        "agent_name": agent.name,
        "tool_name": tool_name,
        "decision": decision,
        "risk_score": risk_score,
        "reason": reason,
        "is_honeytool": honeytool,
    })

    await ws_manager.broadcast("risk_update", {
        "agent_id": agent.id,
        "agent_name": agent.name,
        "risk_score": risk_score,
        "severity": risk_service.get_severity(risk_score).value,
    })

    await session.flush()

    return ToolExecuteResponse(
        id=tool_call.id,
        agent_id=agent.id,
        tool_name=tool_name,
        decision=decision,
        risk_score=risk_score,
        reason=reason,
        execution_time_ms=tool_call.execution_time_ms,
        is_honeytool=honeytool,
        result=result,
    )
