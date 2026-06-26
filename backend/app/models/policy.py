import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_tools: Mapped[str] = mapped_column(Text, default="[]")
    denied_tools: Mapped[str] = mapped_column(Text, default="[]")
    agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.id"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(255), nullable=True)
    task_scope: Mapped[str] = mapped_column(Text, nullable=True)
    permission_expiry: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    agent: Mapped[Optional["Agent"]] = relationship("Agent", back_populates="policies")
