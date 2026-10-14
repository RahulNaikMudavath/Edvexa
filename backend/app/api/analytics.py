from flask import Blueprint, jsonify, current_app
from sqlalchemy import func
from backend.app.models.integration import Integration
from backend.app.models.workflow import Workflow
from backend.app.models.execution import WorkflowExecution
from backend.app.models.event import WebhookEvent

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/v1/analytics")

@analytics_bp.route("/overview", methods=["GET"])
def get_analytics_overview():
    db_session = current_app.db_session

    total_integrations = db_session.query(func.count(Integration.id)).scalar() or 0
    active_integrations = db_session.query(func.count(Integration.id)).filter_by(status="active").scalar() or 0
    
    total_workflows = db_session.query(func.count(Workflow.id)).scalar() or 0
    active_workflows = db_session.query(func.count(Workflow.id)).filter_by(status="active").scalar() or 0
    
    total_events = db_session.query(func.count(WebhookEvent.id)).scalar() or 0
    
    total_executions = db_session.query(func.count(WorkflowExecution.id)).scalar() or 0
    completed_executions = db_session.query(func.count(WorkflowExecution.id)).filter_by(status="completed").scalar() or 0
    failed_executions = db_session.query(func.count(WorkflowExecution.id)).filter_by(status="failed").scalar() or 0
    running_executions = db_session.query(func.count(WorkflowExecution.id)).filter_by(status="running").scalar() or 0
    pending_executions = db_session.query(func.count(WorkflowExecution.id)).filter_by(status="pending").scalar() or 0

    success_rate = round((completed_executions / total_executions * 100), 1) if total_executions > 0 else 100.0

    # Calculate average duration for completed executions
    avg_duration = db_session.query(func.avg(WorkflowExecution.duration_ms)).filter_by(status="completed").scalar() or 0

    # Total retry attempts across executions
    total_retries = db_session.query(func.sum(WorkflowExecution.attempt_count - 1)).filter(WorkflowExecution.attempt_count > 1).scalar() or 0

    # Recent failure analyses
    recent_failures = db_session.query(WorkflowExecution).filter(
        WorkflowExecution.status == "failed",
        WorkflowExecution.ai_analysis.isnot(None)
    ).order_by(WorkflowExecution.completed_at.desc()).limit(5).all()

    failure_highlights = [
        {
            "execution_id": f.id,
            "workflow_name": f.workflow.name if f.workflow else "Unknown",
            "failed_at": f.completed_at.isoformat() if f.completed_at else None,
            "error_message": f.error_message,
            "ai_summary": f.ai_analysis.get("summary") if f.ai_analysis else None,
            "root_cause": f.ai_analysis.get("root_cause") if f.ai_analysis else None,
            "suggested_action": f.ai_analysis.get("suggested_action") if f.ai_analysis else None
        }
        for f in recent_failures
    ]

    return jsonify({
        "integrations": {
            "total": total_integrations,
            "active": active_integrations
        },
        "workflows": {
            "total": total_workflows,
            "active": active_workflows
        },
        "events": {
            "total": total_events
        },
        "executions": {
            "total": total_executions,
            "completed": completed_executions,
            "failed": failed_executions,
            "running": running_executions,
            "pending": pending_executions,
            "success_rate": success_rate,
            "avg_duration_ms": int(avg_duration),
            "total_retries": int(total_retries)
        },
        "recent_failure_highlights": failure_highlights
    })
