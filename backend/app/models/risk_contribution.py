import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base


class RiskContribution(Base):
    __tablename__ = "risk_contributions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.id"), nullable=False, index=True)
    tool_call_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contributor: Mapped[str] = mapped_column(String(100), nullable=False)
    score_delta: Mapped[float] = mapped_column(Float, nullable=False)
    running_total: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
