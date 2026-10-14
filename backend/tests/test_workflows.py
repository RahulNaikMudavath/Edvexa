import time
from backend.app.engine.evaluator import evaluate_trigger_filter, get_nested_value
from backend.app.engine.actions import ActionExecutor, interpolate_template
from backend.app.models.execution import WorkflowExecution

def test_nested_value_extraction():
    data = {"order": {"customer": {"id": 123, "name": "Alice"}, "items": [{"sku": "A1"}, {"sku": "B2"}]}}
    assert get_nested_value(data, "order.customer.name") == "Alice"
    assert get_nested_value(data, "order.items.0.sku") == "A1"
    assert get_nested_value(data, "order.non_existent") is None

def test_evaluate_trigger_filter():
    payload = {"data": {"amount": 1500, "currency": "usd"}, "status": "active"}
    
    # Matching filter
    passed, reason = evaluate_trigger_filter({"field": "data.amount", "operator": ">=", "value": 1000}, payload)
    assert passed is True

    # Failing filter
    passed, reason = evaluate_trigger_filter({"field": "data.amount", "operator": "<", "value": 500}, payload)
    assert passed is False

    # String equality
    passed, _ = evaluate_trigger_filter({"field": "status", "operator": "==", "value": "active"}, payload)
    assert passed is True

def test_action_transform():
    context = {"id": "ord_123", "amount": 2500, "customer": {"name": "Bob"}}
    config = {
        "mappings": {"user": "customer.name"},
        "math_operations": [{"field": "dollars", "source": "amount", "operation": "divide", "operand": 100}],
        "template_output": {"summary": "Charge of ${{dollars}} for {{customer.name}}"}
    }
    result = ActionExecutor.execute_transform(config, context)
    assert result["user"] == "Bob"
    assert result["dollars"] == 25.0
    assert result["summary"] == "Charge of $25.0 for Bob"

def test_action_mock_api_call():
    context = {"user_id": 42}
    config = {
        "url": "mock://api.test.internal/users/{{user_id}}",
        "method": "POST",
        "body": {"status": "verified"}
    }
    result = ActionExecutor.execute_api_call(config, context)
    assert result["status_code"] == 200
    assert result["mock"] is True

def test_end_to_end_workflow_execution(test_app, sample_workflow, db_session):
    engine = test_app.workflow_engine

    execution = WorkflowExecution(
        workflow_id=sample_workflow.id,
        status="pending",
        trigger_event="payment.succeeded",
        input_payload={"id": "ch_7788", "amount": 20000}
    )
    db_session.add(execution)
    db_session.commit()

    # Run execution directly through engine
    engine.run_execution(execution.id)

    # Refresh execution from database
    db_session.expire_all()
    updated_exec = db_session.query(WorkflowExecution).filter_by(id=execution.id).first()
    assert updated_exec.status == "completed"
    assert len(updated_exec.step_logs) == 2
    assert updated_exec.output_payload["amount_usd"] == 200.0
