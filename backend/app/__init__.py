import logging
from flask import Flask
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from backend.app.config import Config
from backend.app.models.base import Base
from backend.app.engine.executor import WorkflowEngine
from backend.app.seeds import seed_database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("edvexa")

def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # SQLAlchemy Database Engine & Scoped Session
    engine = create_engine(
        app.config["SQLALCHEMY_DATABASE_URI"],
        connect_args={"check_same_thread": False} if "sqlite" in app.config["SQLALCHEMY_DATABASE_URI"] else {},
        echo=False
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Session = scoped_session(session_factory)

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Seed default data
    seed_session = Session()
    try:
        seed_database(seed_session)
    finally:
        seed_session.close()

    # Initialize Workflow Engine
    workflow_engine = WorkflowEngine(session_factory=session_factory)

    # Attach to app context
    app.db_engine = engine
    app.session_factory = session_factory
    app.db_session = Session
    app.workflow_engine = workflow_engine

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        Session.remove()

    # Register blueprints
    from backend.app.api.integrations import integrations_bp
    from backend.app.api.webhooks import webhooks_bp
    from backend.app.api.workflows import workflows_bp
    from backend.app.api.executions import executions_bp
    from backend.app.api.analytics import analytics_bp
    from backend.app.api.ai_analyzer import ai_bp

    app.register_blueprint(integrations_bp)
    app.register_blueprint(webhooks_bp)
    app.register_blueprint(workflows_bp)
    app.register_blueprint(executions_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(ai_bp)

    @app.route("/health", methods=["GET"])
    def health_check():
        return {
            "status": "healthy",
            "service": "edvexa-api-integration-platform",
            "version": "1.0.0"
        }, 200

    return app
