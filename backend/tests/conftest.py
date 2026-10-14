import sys
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

# Ensure workspace root is in sys.path
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

from backend.app.config import Config
from backend.app.models.base import Base
from backend.app.models.integration import Integration
from backend.app.models.workflow import Workflow
from backend.app.engine.executor import WorkflowEngine

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    USE_REDIS = False
    AI_PROVIDER = "mock"

@pytest.fixture(scope="function")
def test_app():
    from backend.app import create_app
    app = create_app(TestConfig)
    return app

@pytest.fixture(scope="function")
def client(test_app):
    return test_app.test_client()

@pytest.fixture(scope="function")
def db_session(test_app):
    session = test_app.db_session()
    yield session
    session.close()

@pytest.fixture(scope="function")
def sample_integration(db_session):
    integration = Integration(
        name="Test Stripe Service",
        slug="test-stripe",
        provider="stripe",
        secret_key="test_secret_key_12345",
        status="active",
        supported_events=["payment.succeeded", "payment.failed"]
    )
    db_session.add(integration)
    db_session.commit()
    return integration

@pytest.fixture(scope="function")
def sample_workflow(db_session, sample_integration):
    wf = Workflow(
        name="Process Successful Payment",
        integration_id=sample_integration.id,
        trigger_event_type="payment.succeeded",
        trigger_filter={"field": "amount", "operator": ">=", "value": 50},
        actions=[
            {
                "id": "step_1",
                "name": "Transform Amount",
                "type": "transform",
                "config": {
                    "mappings": {"order_id": "id"},
                    "math_operations": [{"field": "amount_usd", "source": "amount", "operation": "divide", "operand": 100}]
                }
            },
            {
                "id": "step_2",
                "name": "Notify Admin",
                "type": "notification",
                "config": {
                    "channel": "slack",
                    "recipient": "#payments",
                    "message": "Payment {{order_id}} received: ${{amount_usd}}"
                }
            }
        ],
        retry_config={"max_retries": 3, "initial_delay": 0.1, "backoff_factor": 1.5}
    )
    db_session.add(wf)
    db_session.commit()
    return wf
