from flask import Blueprint, request, jsonify, current_app
from backend.app.models.workflow import Workflow
from backend.app.models.integration import Integration
from backend.app.models.execution import WorkflowExecution
from backend.app.engine.queue import WorkflowQueue

workflows_bp = Blueprint("workflows", __name__, url_prefix="/api/v1/workflows")

@workflows_bp.route("", methods=["GET"])
def list_workflows():
    db_session = current_app.db_session
    integration_id = request.args.get("integration_id")
    query = db_session.query(Workflow)
    if integration_id:
        query = query.filter_by(integration_id=integration_id)
    workflows = query.order_by(Workflow.created_at.desc()).all()
    return jsonify([w.to_dict() for w in workflows])

@workflows_bp.route("", methods=["POST"])
def create_workflow():
    db_session = current_app.db_session
    data = request.get_json() or {}

    name = data.get("name")
    integration_id = data.get("integration_id")

    if not name or not integration_id:
        return jsonify({"error": "name and integration_id are required"}), 400

    integration = db_session.query(Integration).filter_by(id=integration_id).first()
    if not integration:
        return jsonify({"error": "Integration not found"}), 404

    workflow = Workflow(
        name=name,
        description=data.get("description", ""),
        status=data.get("status", "active"),
        integration_id=integration_id,
        trigger_event_type=data.get("trigger_event_type", "*"),
        trigger_filter=data.get("trigger_filter", {}),
        actions=data.get("actions", []),
        retry_config=data.get("retry_config", {
            "max_retries": 3,
            "initial_delay": 1.0,
            "backoff_factor": 2.0
        })
    )
    db_session.add(workflow)
    db_session.commit()

    return jsonify(workflow.to_dict()), 201

@workflows_bp.route("/<workflow_id>", methods=["GET"])
def get_workflow(workflow_id: str):
    db_session = current_app.db_session
    workflow = db_session.query(Workflow).filter_by(id=workflow_id).first()
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404
    return jsonify(workflow.to_dict())

@workflows_bp.route("/<workflow_id>", methods=["PUT"])
def update_workflow(workflow_id: str):
    db_session = current_app.db_session
    workflow = db_session.query(Workflow).filter_by(id=workflow_id).first()
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        workflow.name = data["name"]
    if "description" in data:
        workflow.description = data["description"]
    if "status" in data:
        workflow.status = data["status"]
    if "trigger_event_type" in data:
        workflow.trigger_event_type = data["trigger_event_type"]
    if "trigger_filter" in data:
        workflow.trigger_filter = data["trigger_filter"]
    if "actions" in data:
        workflow.actions = data["actions"]
    if "retry_config" in data:
        workflow.retry_config = data["retry_config"]

    db_session.commit()
    return jsonify(workflow.to_dict())

@workflows_bp.route("/<workflow_id>", methods=["DELETE"])
def delete_workflow(workflow_id: str):
    db_session = current_app.db_session
    workflow = db_session.query(Workflow).filter_by(id=workflow_id).first()
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404

    db_session.delete(workflow)
    db_session.commit()
    return jsonify({"message": "Workflow deleted successfully"})

@workflows_bp.route("/<workflow_id>/run", methods=["POST"])
def manual_run_workflow(workflow_id: str):
    """Triggers manual execution of a workflow with custom test payload."""
    db_session = current_app.db_session
    engine = current_app.workflow_engine

    workflow = db_session.query(Workflow).filter_by(id=workflow_id).first()
    if not workflow:
        return jsonify({"error": "Workflow not found"}), 404

    data = request.get_json() or {}
    payload = data.get("payload", {
        "id": "manual_test_evt",
        "type": workflow.trigger_event_type if workflow.trigger_event_type != "*" else "test.event",
        "data": {"amount": 500, "customer": "Test User"}
    })

    execution = WorkflowExecution(
        workflow_id=workflow.id,
        event_id=None,
        status="pending",
        trigger_event="manual.trigger",
        input_payload=payload
    )
    db_session.add(execution)
    db_session.commit()

    # Enqueue execution asynchronously
    WorkflowQueue.enqueue(engine.run_execution, execution.id)

    return jsonify({
        "status": "enqueued",
        "execution_id": execution.id,
        "workflow_id": workflow.id,
        "message": "Manual execution enqueued successfully."
    }), 202
