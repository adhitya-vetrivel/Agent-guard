import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.operator_activity import OperatorActivity, OperatorRisk
from app.services.operator_service import OperatorSecurityService


@pytest.mark.asyncio
async def test_log_activity_increases_risk_score(session: AsyncSession):
    op_service = OperatorSecurityService(session)
    user_id = "test-operator-id"
    user_email = "operator@agentguard.io"
    user_role = "operator"
    
    # 1. Log a routine containment action
    act1 = await op_service.log_activity(
        user_id=user_id,
        user_email=user_email,
        user_role=user_role,
        action="containment_action",
        details="Quarantined a suspicious agent",
    )
    assert act1.risk_delta == 15.0
    
    # Check that OperatorRisk profile was created
    profile_stmt = select(OperatorRisk).where(OperatorRisk.user_id == user_id)
    profile_res = await session.execute(profile_stmt)
    profile = profile_res.scalar_one()
    assert profile.risk_score == 15.0
    assert profile.anomaly_level == "LOW"
    assert profile.containment_actions == 1
    
    # 2. Log login failure
    act2 = await op_service.log_activity(
        user_id=user_id,
        user_email=user_email,
        user_role=user_role,
        action="login_failure",
        details="Login failure",
        is_login_failure=True,
    )
    assert act2.risk_delta == 20.0
    
    # Check risk score updated
    assert profile.risk_score == 35.0
    assert profile.anomaly_level == "MEDIUM"
    assert profile.login_failures == 1
