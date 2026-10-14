import json
import secrets
import re
from flask import Blueprint, request, jsonify, current_app
from backend.app.models.integration import Integration
from backend.app.models.event import WebhookEvent
from backend.app.models.execution import WorkflowExecution
from backend.app.models.workflow import Workflow
from backend.app.security.hmac_validator import compute_hmac_sha256
from backend.app.engine.queue import WorkflowQueue
from backend.app.engine.evaluator import evaluate_trigger_filter

integrations_bp = Blueprint("integrations", __name__, url_prefix="/api/v1/integrations")

def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", slug)

@integrations_bp.route("", methods=["GET"])
def list_integrations():
    db_session = current_app.db_session
    integrations = db_session.query(Integration).order_by(Integration.created_at.desc()).all()
    return jsonify([i.to_dict() for i in integrations])

@integrations_bp.route("", methods=["POST"])
def create_integration():
    db_session = current_app.db_session
    data = request.get_json() or {}

    name = data.get("name")
    if not name:
        return jsonify({"error": "Integration name is required"}), 400

    base_slug = data.get("slug") or slugify(name)
    # Ensure unique slug
    slug = base_slug
    counter = 1
    while db_session.query(Integration).filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    secret_key = data.get("secret_key") or secrets.token_hex(24)
    provider = data.get("provider", "custom")
    description = data.get("description", "")
    supported_events = data.get("supported_events", ["default.event"])

    integration = Integration(
        name=name,
        slug=slug,
        provider=provider,
        secret_key=secret_key,
        description=description,
        supported_events=supported_events,
        status=data.get("status", "active")
    )
    db_session.add(integration)
    db_session.commit()

    return jsonify(integration.to_dict()), 201

@integrations_bp.route("/<integration_id>", methods=["GET"])
def get_integration(integration_id: str):
    db_session = current_app.db_session
    integration = db_session.query(Integration).filter_by(id=integration_id).first()
    if not integration:
        return jsonify({"error": "Integration not found"}), 404
    return jsonify(integration.to_dict())

@integrations_bp.route("/<integration_id>", methods=["PUT"])
def update_integration(integration_id: str):
    db_session = current_app.db_session
    integration = db_session.query(Integration).filter_by(id=integration_id).first()
    if not integration:
        return jsonify({"error": "Integration not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        integration.name = data["name"]
    if "description" in data:
        integration.description = data["description"]
    if "status" in data:
        integration.status = data["status"]
    if "supported_events" in data:
        integration.supported_events = data["supported_events"]
    if "secret_key" in data and data["secret_key"]:
        integration.secret_key = data["secret_key"]

    db_session.commit()
    return jsonify(integration.to_dict())

@integrations_bp.route("/<integration_id>", methods=["DELETE"])
def delete_integration(integration_id: str):
    db_session = current_app.db_session
    integration = db_session.query(Integration).filter_by(id=integration_id).first()
    if not integration:
        return jsonify({"error": "Integration not found"}), 404

    db_session.delete(integration)
    db_session.commit()
    return jsonify({"message": "Integration deleted successfully"})

@integrations_bp.route("/<integration_id>/events", methods=["GET"])
def get_integration_events(integration_id: str):
    db_session = current_app.db_session
    limit = int(request.args.get("limit", 20))
    events = db_session.query(WebhookEvent).filter_by(
        integration_id=integration_id
    ).order_by(WebhookEvent.received_at.desc()).limit(limit).all()
    return jsonify([e.to_dict() for e in events])

@integrations_bp.route("/<integration_id>/simulate", methods=["POST"])
def simulate_webhook(integration_id: str):
    """
    Simulates an incoming webhook event.
    Calculates authentic HMAC-SHA256 signature and triggers workflow engine.
    """
    db_session = current_app.db_session
    engine = current_app.workflow_engine

    integration = db_session.query(Integration).filter_by(id=integration_id).first()
    if not integration:
        return jsonify({"error": "Integration not found"}), 404

    data = request.get_json() or {}
    event_type = data.get("event_type", "payment.succeeded")
    payload = data.get("payload", {
        "id": f"evt_sim_{secrets.token_hex(4)}",
        "type": event_type,
        "amount": 1500,
        "currency": "usd",
        "customer": {"id": "cus_123", "name": "Jane Doe", "email": "jane@example.com"}
    })
    
    test_invalid_sig = data.get("invalid_signature", False)
    payload_bytes = json.dumps(payload).encode("utf-8")
    
    if test_invalid_sig:
        signature = "sha256=invalid_signature_hex_code_12345"
    else:
        raw_hmac = compute_hmac_sha256(integration.secret_key, payload_bytes)
        signature = f"sha256={raw_hmac}"

    idempotency_key = data.get("idempotency_key") or f"sim_idemp_{secrets.token_hex(6)}"

    if test_invalid_sig:
        rejected_event = WebhookEvent(
            integration_id=integration.id,
            event_type="rejected.invalid_signature",
            idempotency_key=idempotency_key,
            payload=payload,
            headers={"X-Webhook-Signature": signature},
            signature=signature,
            signature_valid=False,
            status="rejected"
        )
        db_session.add(rejected_event)
        db_session.commit()
        return jsonify({
            "status": "rejected",
            "message": "Simulated invalid HMAC signature was rejected as expected.",
            "event_id": rejected_event.id
        }), 401

    # Check idempotency
    existing_event = db_session.query(WebhookEvent).filter_by(
        integration_id=integration.id,
        idempotency_key=idempotency_key
    ).first()

    if existing_event:
        return jsonify({
            "status": "duplicate_ignored",
            "message": f"Duplicate event ignored with idempotency key '{idempotency_key}'",
            "event_id": existing_event.id
        }), 200

    webhook_event = WebhookEvent(
        integration_id=integration.id,
        event_type=event_type,
        idempotency_key=idempotency_key,
        payload=payload,
        headers={"X-Webhook-Signature": signature, "Content-Type": "application/json"},
        signature=signature,
        signature_valid=True,
        status="received"
    )
    integration.event_count += 1
    db_session.add(webhook_event)
    db_session.commit()

    # Trigger matching workflows
    workflows = db_session.query(Workflow).filter_by(
        integration_id=integration.id,
        status="active"
    ).all()

    triggered = []
    for wf in workflows:
        if wf.trigger_event_type != "*" and wf.trigger_event_type != event_type:
            continue
        passes, _ = evaluate_trigger_filter(wf.trigger_filter, payload)
        if not passes:
            continue

        execution = WorkflowExecution(
            workflow_id=wf.id,
            event_id=webhook_event.id,
            status="pending",
            trigger_event=event_type,
            idempotency_key=idempotency_key,
            input_payload=payload
        )
        db_session.add(execution)
        db_session.commit()

        # Enqueue execution asynchronously
        WorkflowQueue.enqueue(engine.run_execution, execution.id)
        triggered.append({
            "execution_id": execution.id,
            "workflow_id": wf.id,
            "workflow_name": wf.name
        })

    webhook_event.status = "processed"
    db_session.commit()

    return jsonify({
        "status": "simulated",
        "message": f"Simulated webhook event dispatched successfully. {len(triggered)} workflow(s) enqueued.",
        "event_id": webhook_event.id,
        "signature": signature,
        "idempotency_key": idempotency_key,
        "triggered_executions": triggered
    }), 202
