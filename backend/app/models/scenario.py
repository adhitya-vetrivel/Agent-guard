import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, DateTime, Enum as SAEnum, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base
import enum


class ScenarioType(str, enum.Enum):
    NORMAL_OPERATION = "NORMAL_OPERATION"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    RECON_BURST = "RECON_BURST"
    DEMO_ATTACK = "DEMO_ATTACK"


class ScenarioStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PAUSED = "PAUSED"
    STOPPED = "STOPPED"


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    scenario_type: Mapped[ScenarioType] = mapped_column(SAEnum(ScenarioType), nullable=False)
    status: Mapped[ScenarioStatus] = mapped_column(SAEnum(ScenarioStatus), default=ScenarioStatus.PENDING, nullable=False)
    steps: Mapped[str] = mapped_column(Text, default="[]")
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    severity: Mapped[str] = mapped_column(String(50), default="LOW")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
