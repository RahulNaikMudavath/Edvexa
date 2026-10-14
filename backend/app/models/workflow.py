from sqlalchemy import String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, generate_uuid, utc_now

class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active") # active, paused
    
    # Trigger definition
    integration_id: Mapped[str] = mapped_column(String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False)
    trigger_event_type: Mapped[str] = mapped_column(String(100), default="*", nullable=False) # * or specific event
    trigger_filter: Mapped[dict] = mapped_column(JSON, default=dict) # e.g. {"field": "amount", "operator": ">=", "value": 100}
    
    # Action pipeline
    actions: Mapped[list] = mapped_column(JSON, default=list) # ordered list of action steps
    
    # Retry & Idempotency config
    retry_config: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "max_retries": 3,
        "initial_delay": 1.0,
        "backoff_factor": 2.0
    })
    
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    integration = relationship("Integration", back_populates="workflows")
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "integration_id": self.integration_id,
            "integration_name": self.integration.name if self.integration else None,
            "trigger_event_type": self.trigger_event_type,
            "trigger_filter": self.trigger_filter or {},
            "actions": self.actions or [],
            "retry_config": self.retry_config or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
