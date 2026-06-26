import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base


class TrustEdge(Base):
    __tablename__ = "trust_edges"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.id"), nullable=False, index=True)
    child_agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.id"), nullable=False, index=True)
    relationship: Mapped[str] = mapped_column(String(50), nullable=False)
    delegated_permissions: Mapped[str] = mapped_column(Text, default="[]")
    trust_inheritance: Mapped[bool] = mapped_column(Boolean, default=True)
    trust_level: Mapped[float] = mapped_column(Float, default=1.0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
