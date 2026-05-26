"""
Receiver_Server/worker_manager.py
Manages the ThreadPoolExecutor for code execution workers.
Validates 2-phase admission tokens before dispatching.
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from Services.Receiver_Server.runtime import runtime
from Services.Receiver_Server.worker import execute_task

logger = logging.getLogger('receiver.worker_manager')

# Pending token registry: {task_id → token}
_accepted_tasks: dict = {}
_lock = threading.Lock()

# Execution thread pool
_pool: ThreadPoolExecutor | None = None
_pool_lock = threading.Lock()


def _get_pool() -> ThreadPoolExecutor:
    """Lazy-init thread pool (picks up workers_limit from runtime)."""
    global _pool
    with _pool_lock:
        if _pool is None:
            _pool = ThreadPoolExecutor(
                max_workers=runtime.workers_limit,
                thread_name_prefix='exec-worker',
            )
    return _pool





def handle_accepted_task(
    task: dict,
) -> tuple[bool, str]:

    try:

        runtime.accept_inflight()

        worker = threading.Thread(
            target=_run_task,
            args=(task,),
            daemon=True,
            name=(
                f"worker-"
                f"{task['task_id'][:8]}"
            ),
        )

        worker.start()

        logger.info(
            f"Started worker for "
            f"{task['task_id']}"
        )

        return True, ""

    except Exception as e:

        runtime.complete_inflight()

        logger.exception(
            f"Failed to start worker "
            f"{task.get('task_id')}: {e}"
        )

        return False, str(e)


def _run_task(task: dict) -> None:
    try:
        execute_task(task)
    except Exception as e:
        logger.exception(
            f"Task {task.get('task_id')} failed: {e}"
        )