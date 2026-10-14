from flask import Blueprint, request, jsonify, current_app
from backend.app.models.execution import WorkflowExecution
from backend.app.models.workflow import Workflow
from backend.app.engine.queue import WorkflowQueue

executions_bp = Blueprint("executions", __name__, url_prefix="/api/v1/executions")

@executions_bp.route("", methods=["GET"])
def list_executions():
    db_session = current_app.db_session
    workflow_id = request.args.get("workflow_id")
    status = request.args.get("status")
    limit = int(request.args.get("limit", 50))

    query = db_session.query(WorkflowExecution)
    if workflow_id:
        query = query.filter_by(workflow_id=workflow_id)
    if status and status != "all":
        query = query.filter_by(status=status)

    executions = query.order_by(WorkflowExecution.created_at.desc()).limit(limit).all()
    return jsonify([e.to_dict() for e in executions])

@executions_bp.route("/<execution_id>", methods=["GET"])
def get_execution(execution_id: str):
    db_session = current_app.db_session
    execution = db_session.query(WorkflowExecution).filter_by(id=execution_id).first()
    if not execution:
        return jsonify({"error": "Execution not found"}), 404
    return jsonify(execution.to_dict())

@executions_bp.route("/<execution_id>/retry", methods=["POST"])
def retry_execution(execution_id: str):
    """
    Reruns/retries a failed or completed execution.
    Can optionally accept updated input payload or config overrides.
    """
    db_session = current_app.db_session
    engine = current_app.workflow_engine

    original = db_session.query(WorkflowExecution).filter_by(id=execution_id).first()
    if not original:
        return jsonify({"error": "Execution not found"}), 404

    data = request.get_json() or {}
    new_input = data.get("input_payload", original.input_payload)

    # Spawn a new execution record to keep audit trail clean
    retry_exec = WorkflowExecution(
        workflow_id=original.workflow_id,
        event_id=original.event_id,
        status="pending",
        trigger_event=f"retry:{original.trigger_event}",
        idempotency_key=f"retry_{original.idempotency_key or original.id}",
        input_payload=new_input,
        attempt_count=1
    )
    db_session.add(retry_exec)
    db_session.commit()

    # Enqueue execution asynchronously
    WorkflowQueue.enqueue(engine.run_execution, retry_exec.id)

    return jsonify({
        "status": "enqueued",
        "new_execution_id": retry_exec.id,
        "original_execution_id": original.id,
        "message": "Retry execution scheduled successfully."
    }), 202
