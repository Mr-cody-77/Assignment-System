from queue_manager import get_task, add_task
from assigner import assign_task
from state import task_store

def worker():
    while True:
        task = get_task()

        success = assign_task(task)

        if not success:
            task["retries"] += 1
            add_task(task)