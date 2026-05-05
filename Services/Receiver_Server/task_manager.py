import threading
import uuid
import requests

from queue_manager import task_queue
from load_checker import system_load_checker
from worker_manager import register_accepted_task


NUM_TASK_MANAGERS = 5     # fixed worker threads
TASK_POLL_TIMEOUT = 1       


def send_reject(task):
    """
    Send reject response back to sender node.
    """
    try:
        url = f"http://{task['sender_ip']}:{task['response_port']}/assign_response"
        payload = {
            "task_id": task["task_id"],
            "status": "reject"
        }
        requests.post(url, json=payload, timeout=2)
    except Exception:
        pass  

def send_accept(task, token):
    try:
        url = f"http://{task['sender_ip']}:{task['response_port']}/assign_response"
        payload = {
            "task_id": task["task_id"],
            "status": "accept",
            "token": token
        }
        requests.post(url, json=payload, timeout=2)
    except Exception:
        pass

def process_task(task):

    if system_load_checker():
        token = str(uuid.uuid4())
        register_accepted_task(task["task_id"], token)
        send_accept(task, token)
    else:
        send_reject(task)


def task_manager_worker():
    while True:
        try:
            task = task_queue.get(timeout=TASK_POLL_TIMEOUT)
            process_task(task)
            task_queue.task_done()

        except Exception:
            continue


def start_task_manager():
    for _ in range(NUM_TASK_MANAGERS):
        thread = threading.Thread(target=task_manager_worker, daemon=True)
        thread.start()