import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List

from backend.app.models.base import utc_now
from backend.app.models.execution import WorkflowExecution
from backend.app.models.workflow import Workflow
from backend.app.engine.actions import ActionExecutor, ActionExecutionError
from backend.app.ai.analyzer import AiFailureAnalyzer

logger = logging.getLogger(__name__)

class WorkflowEngine:
    """
    Core Workflow Engine.
    Executes multi-step action chains, records step logs, handles retries with backoff,
    and invokes AI failure analysis when an execution encounters errors.
    """

    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.ai_analyzer = AiFailureAnalyzer()

    def run_execution(self, execution_id: str) -> None:
        """Entry point executed by worker thread or job queue."""
        session = self.session_factory()
        try:
            execution = session.query(WorkflowExecution).filter_by(id=execution_id).first()
            if not execution:
                logger.error(f"Execution {execution_id} not found")
                return

            workflow = session.query(Workflow).filter_by(id=execution.workflow_id).first()
            if not workflow:
                logger.error(f"Workflow {execution.workflow_id} not found")
                execution.status = "failed"
                execution.error_message = "Parent workflow definition no longer exists"
                session.commit()
                return

            self._execute_pipeline(session, execution, workflow)

        except Exception as e:
            logger.exception(f"Unhandled error in workflow execution {execution_id}: {e}")
            try:
                execution.status = "failed"
                execution.error_message = f"Unhandled system error: {str(e)}"
                session.commit()
            except Exception:
                session.rollback()
        finally:
            session.close()

    def _execute_pipeline(self, session, execution: WorkflowExecution, workflow: Workflow) -> None:
        """Executes the action pipeline with retry tracking and backoff."""
        execution.status = "running"
        execution.started_at = utc_now()
        session.commit()

        start_time = time.time()
        context = dict(execution.input_payload or {})
        # Enrich context with event metadata
        context["_meta"] = {
            "execution_id": execution.id,
            "workflow_id": workflow.id,
            "workflow_name": workflow.name,
            "trigger_event": execution.trigger_event,
            "attempt": execution.attempt_count
        }

        actions = workflow.actions or []
        retry_config = workflow.retry_config or {}
        max_retries = retry_config.get("max_retries", 3)
        initial_delay = retry_config.get("initial_delay", 1.0)
        backoff_factor = retry_config.get("backoff_factor", 2.0)
        execution.max_retries = max_retries

        step_logs: List[Dict[str, Any]] = list(execution.step_logs or [])
        current_step_idx = 0

        while execution.attempt_count <= max_retries:
            failed = False
            failure_exception = None

            for idx, action in enumerate(actions):
                step_id = action.get("id", f"step_{idx+1}")
                step_name = action.get("name", f"Step {idx+1}")
                action_type = action.get("type", "transform")
                action_config = action.get("config", {})

                step_start = time.time()
                step_record = {
                    "step_id": step_id,
                    "step_name": step_name,
                    "step_type": action_type,
                    "attempt": execution.attempt_count,
                    "started_at": utc_now().isoformat(),
                    "input": dict(context),
                    "status": "running"
                }

                try:
                    # Execute corresponding action
                    if action_type == "transform":
                        step_output = ActionExecutor.execute_transform(action_config, context)
                        context.update(step_output)
                    elif action_type == "api_call":
                        step_output = ActionExecutor.execute_api_call(action_config, context, step_id=step_id)
                        context[f"{step_id}_response"] = step_output
                    elif action_type == "notification":
                        step_output = ActionExecutor.execute_notification(action_config, context, step_id=step_id)
                        context[f"{step_id}_notification"] = step_output
                    else:
                        step_output = {"message": f"Custom step type '{action_type}' processed"}

                    step_record["status"] = "completed"
                    step_record["output"] = step_output
                    step_record["duration_ms"] = int((time.time() - step_start) * 1000)
                    step_record["completed_at"] = utc_now().isoformat()
                    step_record["error"] = None
                    step_logs.append(step_record)

                except ActionExecutionError as aee:
                    step_record["status"] = "failed"
                    step_record["duration_ms"] = int((time.time() - step_start) * 1000)
                    step_record["completed_at"] = utc_now().isoformat()
                    step_record["error"] = {
                        "message": aee.message,
                        "details": aee.details
                    }
                    step_logs.append(step_record)
                    failed = True
                    failure_exception = aee
                    break

                except Exception as ex:
                    step_record["status"] = "failed"
                    step_record["duration_ms"] = int((time.time() - step_start) * 1000)
                    step_record["completed_at"] = utc_now().isoformat()
                    step_record["error"] = {
                        "message": str(ex),
                        "details": {"type": ex.__class__.__name__}
                    }
                    step_logs.append(step_record)
                    failed = True
                    failure_exception = ex
                    break

            if not failed:
                # All steps succeeded!
                execution.status = "completed"
                execution.completed_at = utc_now()
                execution.duration_ms = int((time.time() - start_time) * 1000)
                execution.output_payload = context
                execution.step_logs = step_logs
                execution.error_message = None
                execution.error_details = {}
                session.commit()
                logger.info(f"Execution {execution.id} completed successfully")
                return

            # Failed on this attempt: Check if retry allowed
            if execution.attempt_count < max_retries:
                delay = initial_delay * (backoff_factor ** (execution.attempt_count - 1))
                logger.warning(
                    f"Execution {execution.id} failed on attempt {execution.attempt_count}/{max_retries}. "
                    f"Retrying in {delay:.2f}s with exponential backoff..."
                )
                execution.attempt_count += 1
                execution.step_logs = step_logs
                session.commit()
                time.sleep(delay) # backoff pause before next attempt
            else:
                # Max retries exhausted
                break

        # If reached here, execution failed completely
        execution.status = "failed"
        execution.completed_at = utc_now()
        execution.duration_ms = int((time.time() - start_time) * 1000)
        execution.step_logs = step_logs

        if failure_exception:
            if isinstance(failure_exception, ActionExecutionError):
                execution.error_message = failure_exception.message
                execution.error_details = failure_exception.details
            else:
                execution.error_message = str(failure_exception)
                execution.error_details = {"type": failure_exception.__class__.__name__}

        # Trigger AI Failure Analysis
        try:
            workflow_dict = workflow.to_dict()
            ai_result = self.ai_analyzer.analyze(
                error_message=execution.error_message or "Unknown failure",
                error_details=execution.error_details or {},
                step_logs=step_logs,
                workflow_info=workflow_dict,
                input_payload=execution.input_payload or {}
            )
            execution.ai_analysis = ai_result
        except Exception as ai_err:
            logger.warning(f"Failed to generate AI failure analysis: {ai_err}")

        session.commit()
        logger.info(f"Execution {execution.id} recorded as failed with AI analysis attached.")
