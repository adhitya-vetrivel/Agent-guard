import json
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operator_activity import OperatorActivity, OperatorRisk
from app.models.incident_report import IncidentReport, IncidentSeverity, IncidentStatus
from app.websocket.manager import ws_manager


class OperatorSecurityService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log_activity(
        self,
        user_id: str,
        user_email: str,
        user_role: str,
        action: str,
        details: str = "",
        ip_address: str = "127.0.0.1",
        is_login_failure: bool = False,
    ) -> OperatorActivity:
        # 1. Determine risk delta based on the action
        risk_delta = 0.0
        now = datetime.now(timezone.utc)
        is_after_hours = now.hour < 8 or now.hour >= 18

        # Track the specific counters
        login_fail_inc = 0
        policy_edit_inc = 0
        containment_inc = 0
        role_change_inc = 0
        settings_inc = 0
        user_create_inc = 0
        export_inc = 0
        after_hours_inc = 0

        if is_login_failure:
            risk_delta += 20.0
            login_fail_inc = 1
        elif action == "policy_edit":
            risk_delta += 30.0
            policy_edit_inc = 1
        elif action == "containment_action":
            risk_delta += 15.0
            containment_inc = 1
        elif action == "role_change":
            risk_delta += 25.0
            role_change_inc = 1
        elif action == "settings_change":
            risk_delta += 15.0
            settings_inc = 1
        elif action == "user_creation":
            risk_delta += 20.0
            user_create_inc = 1
        elif action == "export_action":
            risk_delta += 25.0
            export_inc = 1

        if is_after_hours and not is_login_failure:
            risk_delta += 25.0
            after_hours_inc = 1

        # 2. Check for anomalies
        is_anomalous = False
        anomaly_reason = ""

        # Fetch or create OperatorRisk profile
        profile_stmt = select(OperatorRisk).where(OperatorRisk.user_id == user_id)
        profile_res = await self.session.execute(profile_stmt)
        profile = profile_res.scalar_one_or_none()

        if not profile:
            profile = OperatorRisk(
                id=str(uuid.uuid4()),
                user_id=user_id,
                user_email=user_email,
                risk_score=0.0,
                anomaly_level="LOW",
                login_failures=0,
                policy_edits=0,
                containment_actions=0,
                role_changes=0,
                settings_changes=0,
                user_creations=0,
                export_actions=0,
                after_hours_access=0,
            )
            self.session.add(profile)
            await self.session.flush()

        # Update profile stats
        profile.login_failures += login_fail_inc
        profile.policy_edits += policy_edit_inc
        profile.containment_actions += containment_inc
        profile.role_changes += role_change_inc
        profile.settings_changes += settings_inc
        profile.user_creations += user_create_inc
        profile.export_actions += export_inc
        profile.after_hours_access += after_hours_inc
        profile.risk_score = min(profile.risk_score + risk_delta, 100.0)

        # Anomaly rules
        if is_after_hours and action in ["policy_edit", "containment_action"]:
            is_anomalous = True
            anomaly_reason = f"After-hours {action.replace('_', ' ')} detected at {now.strftime('%H:%M')} UTC."
        elif profile.login_failures >= 3:
            is_anomalous = True
            anomaly_reason = f"Excessive failed login attempts ({profile.login_failures})."
        elif profile.export_actions >= 3:
            is_anomalous = True
            anomaly_reason = f"Unusual volume of data exports ({profile.export_actions} exports)."
        elif profile.policy_edits >= 5:
            is_anomalous = True
            anomaly_reason = f"High frequency of policy edits ({profile.policy_edits} edits)."

        # Determine anomaly level
        if profile.risk_score < 30:
            profile.anomaly_level = "LOW"
        elif profile.risk_score < 60:
            profile.anomaly_level = "MEDIUM"
        elif profile.risk_score < 85:
            profile.anomaly_level = "HIGH"
        else:
            profile.anomaly_level = "CRITICAL"

        profile.last_updated = now

        # Create activity log
        activity = OperatorActivity(
            id=str(uuid.uuid4()),
            user_id=user_id,
            user_email=user_email,
            action=action,
            details=details,
            risk_delta=risk_delta,
            ip_address=ip_address,
            is_anomalous=is_anomalous,
            anomaly_reason=anomaly_reason if is_anomalous else None,
            created_at=now,
        )
        self.session.add(activity)
        await self.session.flush()

        # 3. Create incident report if anomalous
        if is_anomalous:
            incident = IncidentReport(
                id=f"INC-{now.year}-{100 + random_inc_id()}" if "random" in globals() else f"INC-{now.year}-{str(uuid.uuid4())[:6].upper()}",
                agent_id=None,
                agent_name=user_email,
                agent_role=user_role,
                severity=IncidentSeverity.CRITICAL if profile.anomaly_level == "CRITICAL" else IncidentSeverity.HIGH,
                status=IncidentStatus.OPEN,
                trigger_type="operator_anomaly",
                trigger_reason=f"Operator Anomaly: {anomaly_reason}",
                timeline=json.dumps([{
                    "timestamp": now.isoformat(),
                    "action": action,
                    "details": details,
                    "risk_delta": risk_delta,
                    "explanation": f"Operator performed '{action}' resulting in +{risk_delta} risk contribution."
                }]),
                risk_breakdown=json.dumps({
                    "base_risk": profile.risk_score,
                    "anomaly_level": profile.anomaly_level,
                    "risk_delta": risk_delta,
                    "reason": anomaly_reason
                }),
                actions_taken=json.dumps(["Security alert triggered", "Administrator notification sent"]),
                containment_status="none",
                tools_invoked=json.dumps([action]),
                recommended_actions=json.dumps([
                    "Temporarily suspend operator credentials",
                    "Conduct peer-review of all modifications made",
                    "Verify authenticity of IP address location"
                ]),
                created_at=now,
            )
            self.session.add(incident)
            await self.session.flush()

            # Broadcast WebSocket operator_alert
            await ws_manager.broadcast("operator_alert", {
                "activity_id": activity.id,
                "user_email": user_email,
                "action": action,
                "risk_score": profile.risk_score,
                "anomaly_level": profile.anomaly_level,
                "reason": anomaly_reason,
                "incident_id": incident.id,
                "created_at": now.isoformat()
            })

            # Broadcast WebSocket explanation_generated
            await ws_manager.broadcast("explanation_generated", {
                "type": "operator_anomaly",
                "decision": "INCIDENT_CREATED",
                "reason": f"{user_email} performed {action.replace('_', ' ')}: {anomaly_reason}",
                "evidence": details,
                "rule_triggered": "Operator anomaly threshold exceeded",
                "risk_contribution": risk_delta,
                "timestamp": now.isoformat()
            })

        return activity

def random_inc_id() -> int:
    import random
    return random.randint(100, 999)
