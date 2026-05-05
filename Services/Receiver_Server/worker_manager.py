import threading
from concurrent.futures import ThreadPoolExecutor
from runtime import runtime
from worker import execute_task



accepted_tasks = {}
accepted_lock = threading.Lock()


active_pool = ThreadPoolExecutor(max_workers=runtime.workers_limit)

def register_accepted_task(task_id, token):
    with accepted_lock:
        accepted_tasks[task_id] = token


def validate_task(task_id, token):
    with accepted_lock:
        if task_id not in accepted_tasks:
            return False

        if accepted_tasks[task_id] != token:
            return False

        del accepted_tasks[task_id]
        return True


def handle_accepted_task(task):

    task_id = task.get("task_id")
    token = task.get("token")

    if not validate_task(task_id, token):
        return False, "Invalid or mismatched task_id/token"

    with runtime.lock:
        runtime.inflight_tasks -= 1
        runtime.active_workers += 1

    active_pool.submit(active_worker, task)

    return True, "Task accepted for execution"


def active_worker(task):
    try:
        execute_task(task)

    finally:
        with runtime.lock:
            runtime.active_workers -= 1