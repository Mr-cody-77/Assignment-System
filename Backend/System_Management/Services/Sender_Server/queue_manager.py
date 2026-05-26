"""
Sender_Server/queue_manager.py
Thread-safe task queue for the Sender dispatcher.
"""

import queue
import threading

_queue: queue.Queue = queue.Queue(maxsize=500)
_queued_ids: set = set()
_lock = threading.Lock()


def add_task(task: dict) -> bool:
    """Add a task dict to the queue. Returns False if full."""
    task_id = task.get('task_id', id(task))
    with _lock:
        if task_id in _queued_ids:
            return True
        try:
            _queue.put_nowait(task)
            _queued_ids.add(task_id)
            return True
        except queue.Full:
            return False


def get_task() -> dict:
    """Block until a task is available and return it."""
    task = _queue.get()
    task_id = task.get('task_id', id(task))
    with _lock:
        _queued_ids.discard(task_id)
    return task


def task_done():
    _queue.task_done()


def queue_size() -> int:
    return _queue.qsize()


# Legacy alias used by older Sender code
task_queue = _queue