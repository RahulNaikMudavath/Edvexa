from sqlalchemy import String, Text, JSON, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, generate_uuid, utc_now

class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(String(36), ForeignKey("webhook_events.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # State tracking: pending, running, completed, failed
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    trigger_event: Mapped[str] = mapped_column(String(100), default="manual")
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=True, index=True)
    
    # Retry tracking
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    next_retry_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Payloads & step-by-step logs
    input_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    output_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    step_logs: Mapped[list] = mapped_column(JSON, default=list) # records each action execution
    
    # Error tracking
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    error_details: Mapped[dict] = mapped_column(JSON, default=dict) # failed step, response code, stack
    
    # AI Failure Analysis
    ai_analysis: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    # Timing
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    event = relationship("WebhookEvent", back_populates="executions")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "workflow_name": self.workflow.name if self.workflow else None,
            "event_id": self.event_id,
            "status": self.status,
            "trigger_event": self.trigger_event,
            "idempotency_key": self.idempotency_key,
            "attempt_count": self.attempt_count,
            "max_retries": self.max_retries,
            "next_retry_at": self.next_retry_at.isoformat() if self.next_retry_at else None,
            "input_payload": self.input_payload,
            "output_payload": self.output_payload,
            "step_logs": self.step_logs or [],
            "error_message": self.error_message,
            "error_details": self.error_details or {},
            "ai_analysis": self.ai_analysis,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
