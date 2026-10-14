import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "edvexa-super-secret-key-2026")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'edvexa.db')}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Asynchronous worker config
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    USE_REDIS = os.getenv("USE_REDIS", "false").lower() in ("true", "1", "yes")
    MAX_WORKER_THREADS = int(os.getenv("MAX_WORKER_THREADS", "8"))
    
    # Retry and execution limits
    DEFAULT_MAX_RETRIES = int(os.getenv("DEFAULT_MAX_RETRIES", "3"))
    DEFAULT_INITIAL_DELAY = float(os.getenv("DEFAULT_INITIAL_DELAY", "2.0"))
    DEFAULT_BACKOFF_FACTOR = float(os.getenv("DEFAULT_BACKOFF_FACTOR", "2.0"))
    
    # AI Analyzer config
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    AI_PROVIDER = os.getenv("AI_PROVIDER", "auto") # auto, gemini, openai, mock
    
    # Webhook signature header defaults
    WEBHOOK_SIGNATURE_HEADER = os.getenv("WEBHOOK_SIGNATURE_HEADER", "X-Webhook-Signature")
