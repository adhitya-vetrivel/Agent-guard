import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
import enum


class AuditAction(str, enum.Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    TOOL_EXECUTE = "TOOL_EXECUTE"
    TOOL_DENIED = "TOOL_DENIED"
    AGENT_REGISTER = "AGENT_REGISTER"
    AGENT_BLOCK = "AGENT_BLOCK"
    AGENT_UNQUARANTINE = "AGENT_UNQUARANTINE"
    AGENT_DELETE = "AGENT_DELETE"
    CONTAINMENT = "CONTAINMENT"
    POLICY_CREATE = "POLICY_CREATE"
    POLICY_UPDATE = "POLICY_UPDATE"
    POLICY_DELETE = "POLICY_DELETE"
    RISK_CHANGE = "RISK_CHANGE"
    RISK_ESCALATION = "RISK_ESCALATION"
    DECOY_TRIGGER = "DECOY_TRIGGER"
    SETTINGS_UPDATE = "SETTINGS_UPDATE"
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    ROLE_CHANGED = "ROLE_CHANGED"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    action: Mapped[AuditAction] = mapped_column(SAEnum(AuditAction), nullable=False, index=True)
    agent_id: Mapped[str | None] = mapped_column(String(255), ForeignKey("agents.id"), nullable=True, index=True)
    agent_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tool_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    decision: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(255), ForeignKey("users.id"), nullable=True)

    agent: Mapped[Optional["Agent"]] = relationship("Agent", back_populates="audit_logs")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")
