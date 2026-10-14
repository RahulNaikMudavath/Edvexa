import logging
from concurrent.futures import ThreadPoolExecutor
from backend.app.config import Config

logger = logging.getLogger(__name__)

class WorkflowQueue:
    """
    Asynchronous execution queue.
    Supports pluggable Redis/RQ and built-in ThreadPoolExecutor.
    Guarantees non-blocking 202 responses for webhook callers.
    """
    _executor = None

    @classmethod
    def get_executor(cls):
        if cls._executor is None:
            cls._executor = ThreadPoolExecutor(
                max_workers=Config.MAX_WORKER_THREADS,
                thread_name_prefix="workflow-worker"
            )
        return cls._executor

    @classmethod
    def enqueue(cls, task_fn, *args, **kwargs):
        """Dispatches execution to background worker queue."""
        if Config.USE_REDIS:
            try:
                import redis
                from rq import Queue
                redis_conn = redis.from_url(Config.REDIS_URL)
                q = Queue("workflows", connection=redis_conn)
                job = q.enqueue(task_fn, *args, **kwargs)
                logger.info(f"Enqueued job {job.id} to Redis Queue")
                return job.id
            except Exception as e:
                logger.warning(f"Failed to enqueue to Redis ({e}); falling back to thread worker")

        # In-process asynchronous thread pool worker
        executor = cls.get_executor()
        future = executor.submit(task_fn, *args, **kwargs)
        return f"thread-{id(future)}"
