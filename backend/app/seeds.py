import logging
from backend.app.models.integration import Integration
from backend.app.models.workflow import Workflow

logger = logging.getLogger(__name__)

def seed_database(session):
    """Pre-populates the database with realistic sample integrations and workflows."""
    if session.query(Integration).first():
        logger.info("Database already seeded; skipping initial seeds.")
        return

    logger.info("Seeding database with default integrations and workflows...")

    # 1. Stripe Payments Integration
    stripe = Integration(
        name="Stripe Payments",
        slug="stripe-payments",
        provider="stripe",
        secret_key="whsec_stripe_demo_secret_key_998877",
        description="Production Stripe webhook integration for capturing successful and failed charges.",
        supported_events=["payment.succeeded", "payment.failed", "charge.refunded"],
        status="active"
    )
    session.add(stripe)
    session.flush()

    # 2. GitHub Webhooks Integration
    github = Integration(
        name="GitHub Repo Events",
        slug="github-events",
        provider="github",
        secret_key="ghsec_demo_signature_key_443322",
        description="Receives pull request, push, and release events from core GitHub repositories.",
        supported_events=["push", "pull_request", "issues", "release"],
        status="active"
    )
    session.add(github)
    session.flush()

    # 3. Shopify Orders Integration
    shopify = Integration(
        name="Shopify Storefront",
        slug="shopify-store",
        provider="shopify",
        secret_key="shsec_shopify_secret_token_112233",
        description="Captures ecommerce order events, customer registrations, and inventory updates.",
        supported_events=["order.created", "order.cancelled", "customer.created"],
        status="active"
    )
    session.add(shopify)
    session.flush()

    # 4. Custom CRM Integration
    custom_crm = Integration(
        name="Internal CRM & Leads",
        slug="custom-crm",
        provider="custom",
        secret_key="crm_custom_secret_key_556677",
        description="Custom webhooks dispatched by the marketing and sales lead generation tools.",
        supported_events=["lead.created", "user.signup"],
        status="active"
    )
    session.add(custom_crm)
    session.flush()

    # Workflows
    # Workflow 1: Stripe High-Value Payment Alert
    wf1 = Workflow(
        name="High-Value Stripe Payment Alert & CRM Sync",
        description="Triggers on payments of $100 or greater, transforms amount to dollars, updates CRM and alerts sales.",
        status="active",
        integration_id=stripe.id,
        trigger_event_type="payment.succeeded",
        trigger_filter={
            "field": "amount",
            "operator": ">=",
            "value": 10000 # 10000 cents = $100
        },
        actions=[
            {
                "id": "step_1_format",
                "name": "Extract & Format Payment Data",
                "type": "transform",
                "config": {
                    "mappings": {
                        "customer_name": "customer.name",
                        "customer_email": "customer.email",
                        "payment_id": "id"
                    },
                    "math_operations": [
                        {"field": "amount_dollars", "source": "amount", "operation": "divide", "operand": 100}
                    ],
                    "template_output": {
                        "alert_summary": "💰 High-value payment of ${{amount_dollars}} from {{customer.name}}!"
                    }
                }
            },
            {
                "id": "step_2_crm_sync",
                "name": "Sync with CRM Hub",
                "type": "api_call",
                "config": {
                    "url": "mock://api.crm.internal/v1/customers/vip-tag",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": {
                        "customer_email": "{{customer_email}}",
                        "tier": "VIP",
                        "last_payment_usd": "{{amount_dollars}}"
                    }
                }
            },
            {
                "id": "step_3_slack_notify",
                "name": "Send Slack Notification to #vip-sales",
                "type": "notification",
                "config": {
                    "channel": "slack",
                    "recipient": "#vip-sales",
                    "message": "🔥 Confirmed VIP Transaction: ${{amount_dollars}} from {{customer_name}} ({{customer_email}}) - Ref: {{payment_id}}"
                }
            }
        ],
        retry_config={"max_retries": 3, "initial_delay": 1.0, "backoff_factor": 2.0}
    )
    session.add(wf1)

    # Workflow 2: GitHub Security Review Automation
    wf2 = Workflow(
        name="GitHub Pull Request Security & Quality Check",
        description="Inspects newly opened PRs, calls code security verification API, and notifies dev team.",
        status="active",
        integration_id=github.id,
        trigger_event_type="pull_request",
        trigger_filter={
            "field": "action",
            "operator": "==",
            "value": "opened"
        },
        actions=[
            {
                "id": "step_1_extract",
                "name": "Extract Pull Request Details",
                "type": "transform",
                "config": {
                    "mappings": {
                        "pr_number": "pull_request.number",
                        "pr_title": "pull_request.title",
                        "pr_author": "pull_request.user.login"
                    }
                }
            },
            {
                "id": "step_2_security_scan",
                "name": "Run Static Analysis Scan",
                "type": "api_call",
                "config": {
                    "url": "mock://security-bot.ci.internal/scans/trigger",
                    "method": "POST",
                    "body": {"pr": "{{pr_number}}", "author": "{{pr_author}}"}
                }
            },
            {
                "id": "step_3_notify",
                "name": "Notify Dev Channel",
                "type": "notification",
                "config": {
                    "channel": "slack",
                    "recipient": "#dev-alerts",
                    "message": "📦 New PR #{{pr_number}}: '{{pr_title}}' by @{{pr_author}} is undergoing security analysis."
                }
            }
        ],
        retry_config={"max_retries": 2, "initial_delay": 1.0, "backoff_factor": 2.0}
    )
    session.add(wf2)

    # Workflow 3: Failure Analysis Demo Workflow (Intentional 401 Authentication Failure for demonstration)
    wf3 = Workflow(
        name="AI Failure Analysis Demo (401 Unauthorized Simulation)",
        description="Demonstrates how AI summarizes failures with root causes and log evidence when an external API rejects tokens.",
        status="active",
        integration_id=stripe.id,
        trigger_event_type="payment.failed",
        trigger_filter={},
        actions=[
            {
                "id": "step_1_format",
                "name": "Parse Failure Code",
                "type": "transform",
                "config": {
                    "mappings": {"fail_reason": "error.message", "charge_id": "id"}
                }
            },
            {
                "id": "step_2_external_billing_api",
                "name": "Call External Billing Recovery API",
                "type": "api_call",
                "config": {
                    "url": "https://api.external-billing.com/v2/disputes",
                    "method": "POST",
                    "headers": {"Authorization": "Bearer expired_mock_token_abc123"},
                    "simulate_failure": True,
                    "simulated_status": 401,
                    "simulated_error": "Invalid or expired Bearer token provided in Authorization header."
                }
            }
        ],
        retry_config={"max_retries": 2, "initial_delay": 0.5, "backoff_factor": 1.5}
    )
    session.add(wf3)

    session.commit()
    logger.info("Database seeding complete!")
