from sqlalchemy import String, Text, JSON, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, generate_uuid, utc_now

class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    integration_id: Mapped[str] = mapped_column(String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), default="unknown", nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=True, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    headers: Mapped[dict] = mapped_column(JSON, default=dict)
    signature: Mapped[str] = mapped_column(String(256), default="")
    signature_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(30), default="received") # received, processed, rejected, duplicate
    received_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    integration = relationship("Integration", back_populates="events")
    executions = relationship("WorkflowExecution", back_populates="event", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "integration_id": self.integration_id,
            "integration_name": self.integration.name if self.integration else None,
            "event_type": self.event_type,
            "idempotency_key": self.idempotency_key,
            "payload": self.payload,
            "headers": self.headers,
            "signature": self.signature,
            "signature_valid": self.signature_valid,
            "status": self.status,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "execution_count": len(self.executions) if self.executions else 0
        }
