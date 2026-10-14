from flask import Blueprint, jsonify, current_app
from backend.app.models.execution import WorkflowExecution
from backend.app.ai.analyzer import AiFailureAnalyzer

ai_bp = Blueprint("ai", __name__, url_prefix="/api/v1/ai")

@ai_bp.route("/executions/<execution_id>/analyze", methods=["POST"])
def analyze_execution_failure(execution_id: str):
    db_session = current_app.db_session
    execution = db_session.query(WorkflowExecution).filter_by(id=execution_id).first()

    if not execution:
        return jsonify({"error": "Execution not found"}), 404

    analyzer = AiFailureAnalyzer()
    workflow_info = execution.workflow.to_dict() if execution.workflow else {}

    ai_result = analyzer.analyze(
        error_message=execution.error_message or "Manual trigger analysis",
        error_details=execution.error_details or {},
        step_logs=execution.step_logs or [],
        workflow_info=workflow_info,
        input_payload=execution.input_payload or {}
    )

    execution.ai_analysis = ai_result
    db_session.commit()

    return jsonify({
        "execution_id": execution.id,
        "ai_analysis": ai_result
    })
