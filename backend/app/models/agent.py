import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
import enum


class AgentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"
    QUARANTINED = "QUARANTINED"


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    capabilities: Mapped[str] = mapped_column(Text, default="[]")
    public_key: Mapped[str] = mapped_column(Text, nullable=True)
    jwt_identity: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[AgentStatus] = mapped_column(SAEnum(AgentStatus), default=AgentStatus.ACTIVE, nullable=False)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    tool_calls: Mapped[list["ToolCall"]] = relationship("ToolCall", back_populates="agent")
    risk_events: Mapped[list["RiskEvent"]] = relationship("RiskEvent", back_populates="agent")
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="agent")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="agent")
    policies: Mapped[list["Policy"]] = relationship("Policy", back_populates="agent")
