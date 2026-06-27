from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, Text, DateTime, Integer
from app.database.base import Base


class OperatorActivity(Base):
    __tablename__ = "operator_activities"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)
    user_email = Column(String, nullable=True)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    risk_delta = Column(Float, default=0.0)
    ip_address = Column(String, nullable=True)
    is_anomalous = Column(Boolean, default=False)
    anomaly_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class OperatorRisk(Base):
    __tablename__ = "operator_risks"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)
    user_email = Column(String, nullable=True)
    risk_score = Column(Float, default=0.0)
    anomaly_level = Column(String, default="LOW")
    login_failures = Column(Integer, default=0)
    policy_edits = Column(Integer, default=0)
    containment_actions = Column(Integer, default=0)
    role_changes = Column(Integer, default=0)
    settings_changes = Column(Integer, default=0)
    user_creations = Column(Integer, default=0)
    export_actions = Column(Integer, default=0)
    after_hours_access = Column(Integer, default=0)
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
