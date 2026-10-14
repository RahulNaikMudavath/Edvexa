from backend.app.api.integrations import integrations_bp
from backend.app.api.webhooks import webhooks_bp
from backend.app.api.workflows import workflows_bp
from backend.app.api.executions import executions_bp
from backend.app.api.analytics import analytics_bp
from backend.app.api.ai_analyzer import ai_bp

__all__ = [
    "integrations_bp",
    "webhooks_bp",
    "workflows_bp",
    "executions_bp",
    "analytics_bp",
    "ai_bp",
]
