import secrets
from sqlalchemy import String, Text, JSON, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, generate_uuid, utc_now

class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), default="custom") # stripe, github, shopify, slack, custom
    secret_key: Mapped[str] = mapped_column(String(128), default=lambda: secrets.token_hex(24), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active") # active, inactive
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    supported_events: Mapped[list] = mapped_column(JSON, default=list) # e.g. ["payment.succeeded", "payment.failed"]
    event_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    workflows = relationship("Workflow", back_populates="integration", cascade="all, delete-orphan")
    events = relationship("WebhookEvent", back_populates="integration", cascade="all, delete-orphan")

    def to_dict(self, include_secret: bool = True) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "provider": self.provider,
            "status": self.status,
            "description": self.description,
            "supported_events": self.supported_events or [],
            "event_count": self.event_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "webhook_path": f"/api/v1/webhooks/{self.slug}",
        }
        if include_secret:
            data["secret_key"] = self.secret_key
        return data
