from backend.app.models.workflow import Workflow
from backend.app.models.execution import WorkflowExecution

def test_workflow_retry_with_exponential_backoff(test_app, sample_integration, db_session):
    engine = test_app.workflow_engine

    # Create a workflow with a failing step
    failing_workflow = Workflow(
        name="Failing Step Workflow",
        integration_id=sample_integration.id,
        trigger_event_type="test.fail",
        actions=[
            {
                "id": "step_fail",
                "name": "Simulated Failing API",
                "type": "api_call",
                "config": {
                    "url": "https://api.external.com/fail",
                    "simulate_failure": True,
                    "simulated_status": 500,
                    "simulated_error": "Internal Database Error"
                }
            }
        ],
        retry_config={
            "max_retries": 3,
            "initial_delay": 0.05, # short delay for fast test execution
            "backoff_factor": 1.5
        }
    )
    db_session.add(failing_workflow)
    db_session.commit()

    execution = WorkflowExecution(
        workflow_id=failing_workflow.id,
        status="pending",
        trigger_event="test.fail",
        input_payload={"test": 123}
    )
    db_session.add(execution)
    db_session.commit()

    # Run execution through engine
    engine.run_execution(execution.id)

    db_session.expire_all()
    updated = db_session.query(WorkflowExecution).filter_by(id=execution.id).first()

    # Should have attempted all 3 retries and then marked as failed
    assert updated.status == "failed"
    assert updated.attempt_count == 3
    assert "Internal Database Error" in updated.error_message
    assert updated.ai_analysis is not None
    assert "500" in updated.error_message or "Internal" in updated.error_message
