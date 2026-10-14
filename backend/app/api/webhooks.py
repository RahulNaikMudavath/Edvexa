import hashlib
import json
import logging
from flask import Blueprint, request, jsonify, current_app
from backend.app.models.integration import Integration
from backend.app.models.event import WebhookEvent
from backend.app.models.execution import WorkflowExecution
from backend.app.models.workflow import Workflow
from backend.app.security.hmac_validator import verify_hmac_signature
from backend.app.engine.evaluator import evaluate_trigger_filter
from backend.app.engine.queue import WorkflowQueue

logger = logging.getLogger(__name__)
webhooks_bp = Blueprint("webhooks", __name__, url_prefix="/api/v1/webhooks")

@webhooks_bp.route("/<identifier>", methods=["POST"])
def receive_webhook(identifier: str):
    """
    Public webhook receiver endpoint.
    Validates HMAC signature, enforces idempotency, logs event,
    and enqueues workflow executions asynchronously.
    """
    db_session = current_app.db_session
    engine = current_app.workflow_engine

    # 1. Lookup integration by slug or ID
    integration = db_session.query(Integration).filter(
        (Integration.slug == identifier) | (Integration.id == identifier)
    ).first()

    if not integration:
        return jsonify({
            "error": "Integration not found",
            "identifier": identifier
        }), 404

    if integration.status != "active":
        return jsonify({
            "error": "Integration is currently inactive/disabled",
            "integration_id": integration.id
        }), 403

    raw_body = request.get_data()
    headers_dict = dict(request.headers)

    # 2. Extract HMAC signature from common headers
    signature_header = (
        request.headers.get("X-Hub-Signature-256") or
        request.headers.get("X-Webhook-Signature") or
        request.headers.get("Stripe-Signature") or
        request.headers.get("X-Signature") or
        ""
    )

    # 3. Verify HMAC signature
    is_valid_sig, sig_reason = verify_hmac_signature(
        raw_body=raw_body,
        secret_key=integration.secret_key,
        signature_header=signature_header
    )

    if not is_valid_sig:
        logger.warning(f"Webhook rejected for {integration.name}: {sig_reason}")
        # Record rejected event in audit log
        try:
            payload_data = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            payload_data = {"raw": raw_body.decode("utf-8", errors="replace")}

        rejected_event = WebhookEvent(
            integration_id=integration.id,
            event_type="rejected.invalid_signature",
            payload=payload_data,
            headers=headers_dict,
            signature=signature_header,
            signature_valid=False,
            status="rejected"
        )
        db_session.add(rejected_event)
        db_session.commit()

        return jsonify({
            "error": "Invalid HMAC signature",
            "message": sig_reason
        }), 401

    # 4. Parse JSON payload
    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception as e:
        return jsonify({
            "error": "Malformed JSON payload",
            "details": str(e)
        }), 400

    # 5. Extract event type and idempotency key
    # Common event type patterns: event.type, type, event, action
    event_type = (
        payload.get("type") or
        payload.get("event") or
        payload.get("action") or
        request.headers.get("X-Event-Type") or
        "custom.event"
    )

    # Idempotency key from header or payload, fallback to SHA256 of raw body
    idempotency_key = (
        request.headers.get("X-Idempotency-Key") or
        request.headers.get("Idempotency-Key") or
        payload.get("idempotency_key") or
        payload.get("id") or
        hashlib.sha256(raw_body).hexdigest()
    )

    # 6. Idempotency Check: Prevent duplicate event processing
    existing_event = db_session.query(WebhookEvent).filter_by(
        integration_id=integration.id,
        idempotency_key=str(idempotency_key)
    ).first()

    if existing_event:
        logger.info(f"Duplicate event detected for integration {integration.id} with key {idempotency_key}")
        return jsonify({
            "status": "duplicate_ignored",
            "message": f"Event with idempotency key '{idempotency_key}' already processed.",
            "event_id": existing_event.id,
            "original_received_at": existing_event.received_at.isoformat()
        }), 200

    # 7. Persist incoming WebhookEvent
    webhook_event = WebhookEvent(
        integration_id=integration.id,
        event_type=event_type,
        idempotency_key=str(idempotency_key),
        payload=payload,
        headers=headers_dict,
        signature=signature_header,
        signature_valid=True,
        status="received"
    )
    integration.event_count += 1
    db_session.add(webhook_event)
    db_session.commit()

    # 8. Find matching active workflows
    workflows = db_session.query(Workflow).filter_by(
        integration_id=integration.id,
        status="active"
    ).all()

    triggered_executions = []

    for wf in workflows:
        # Check event type match (* matches any event)
        if wf.trigger_event_type != "*" and wf.trigger_event_type != event_type:
            continue

        # Evaluate filter conditions
        passes_filter, filter_reason = evaluate_trigger_filter(wf.trigger_filter, payload)
        if not passes_filter:
            logger.info(f"Workflow '{wf.name}' skipped: {filter_reason}")
            continue

        # Create execution record
        execution = WorkflowExecution(
            workflow_id=wf.id,
            event_id=webhook_event.id,
            status="pending",
            trigger_event=event_type,
            idempotency_key=str(idempotency_key),
            input_payload=payload
        )
        db_session.add(execution)
        db_session.commit()

        # Enqueue execution asynchronously! Fast 202 Accepted response.
        WorkflowQueue.enqueue(engine.run_execution, execution.id)

        triggered_executions.append({
            "execution_id": execution.id,
            "workflow_id": wf.id,
            "workflow_name": wf.name,
            "status": "pending"
        })

    webhook_event.status = "processed"
    db_session.commit()

    return jsonify({
        "status": "accepted",
        "message": f"Webhook received and {len(triggered_executions)} workflow(s) enqueued.",
        "event_id": webhook_event.id,
        "event_type": event_type,
        "idempotency_key": idempotency_key,
        "executions": triggered_executions
    }), 202
