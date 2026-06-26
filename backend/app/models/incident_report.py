import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, DateTime, Enum as SAEnum, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base
import enum


class IncidentSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    CONTAINED = "CONTAINED"
    RESOLVED = "RESOLVED"


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str | None] = mapped_column(String(255), ForeignKey("agents.id"), nullable=True, index=True)
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    severity: Mapped[IncidentSeverity] = mapped_column(SAEnum(IncidentSeverity), nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(SAEnum(IncidentStatus), default=IncidentStatus.OPEN)
    trigger_reason: Mapped[str] = mapped_column(Text, nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(100), nullable=False)
    timeline: Mapped[str] = mapped_column(Text, default="[]")
    risk_breakdown: Mapped[str] = mapped_column(Text, default="[]")
    actions_taken: Mapped[str] = mapped_column(Text, default="[]")
    containment_status: Mapped[str] = mapped_column(String(50), default="none")
    tools_invoked: Mapped[str] = mapped_column(Text, default="[]")
    recommended_actions: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
