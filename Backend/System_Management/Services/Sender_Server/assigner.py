"""
Sender_Server/assigner.py
Power of Two Choices load balancer — selects the best peer node
and dispatches tasks via the 2-phase token admission protocol.
"""

import logging
import random
import time

import requests

from Services.Sender_Server.config import MAX_RETRIES, RETRY_DELAY_MIN, RETRY_DELAY_MAX, RESPONSE_PORT
from Services.Sender_Server.node_manager import get_two_nodes, get_load
from Services.Receiver_Server.runtime import runtime as receiver_runtime
from Services.load_score import get_runtime_score
from Services.Sender_Server.queue_manager import add_task
from Services.Sender_Server.runtime import runtime
from Services.Sender_Server.state import assigned_tasks, task_store, lock
from Services.Sender_Server.state import assigned_tasks,task_store,tasks,lock
import time


logger = logging.getLogger('sender.assigner')

SENDER_ID = runtime.node_id
SENDER_IP = runtime.ip   # set after network module updates runtime.ip


def _sender_ip() -> str:
    """Always read the latest IP from runtime (set by network.py)."""
    return runtime.ip or '127.0.0.1'

def _sender_port() -> int:
    """Always read the latest port from runtime (set by network.py)."""
    return runtime.port or 8000


def send_token_request(node: dict, task: dict) -> tuple[bool, str | None]:
    """Phase 1: ask remote node for an admission token."""
    ip, port = node['ip'], node['port']
    payload = {
        'task_id': task['task_id'],
    }
    try:
        res = requests.post(
            f'http://{ip}:{port}/api/task_token/',
            json=payload, timeout=2,
        )
        data = res.json()
        if data.get('status') == 'accept':
            return True, data.get('token')
    except Exception as e:
        logger.debug(f"Token request failed for {ip}:{port} — {e}")
    return False, None


def send_full_task(node: dict, task: dict, token: str) -> bool:
    """Phase 2: deliver the full task payload with token."""

    ip = node["ip"]
    port = node["port"]

    data = task["data"]

    payload = {
        "task_id": task["task_id"],
        'sender_id': runtime.node_id,
        'sender_ip': _sender_ip(),
        'sender_port': _sender_port(),
        "submission_id": task.get("submission_id", ""),
        "roll_number": task.get("roll_number", ""),
        "question_id": task.get("question_id", ""),
        "token": token,

        "language": data.get("language", "python"),
        "code": data.get("code", ""),

        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "constraints": data.get("constraints", ""),
        "examples": data.get("examples", []),

        "test_cases": data.get("test_cases", []),
        "hidden_test_cases": data.get("hidden_test_cases", []),

        "time_limit_ms": data.get("time_limit_ms", 2000),
        "memory_limit_mb": data.get("memory_limit_mb", 256),
        "max_score": data.get("max_score", 100),

        "callback_ip": _sender_ip(),
        "callback_port": _sender_port(),
        "sender_id": runtime.node_id,
    }

    try:
        res = requests.post(
            f"http://{ip}:{port}/api/accepted_task/",
            json=payload,
            timeout=8,
        )

        return 200 <= res.status_code < 300

    except Exception as e:
        logger.debug(
            f"Full task send failed for {ip}:{port} — {e}"
        )

        return False



def assign_task(task: dict) -> bool: 
    """
    Try to assign a task to the best available peer node.
    Returns True if successfully handed off, False if all retries exhausted.
    """
    tried: set = set()

    for attempt in range(MAX_RETRIES):
        candidates = get_two_nodes(exclude=tried)
        
        if not candidates:
            logger.info("No network nodes available, falling back to local self-evaluation mode")
            best = {
                "node_id": runtime.node_id,
                "ip": "127.0.0.1",
                "port": runtime.port or 8000,
            }
            # Skip Phase 1 admission token request when doing local self-evaluation
            # because we don't want to reject our own tasks in offline mode
            accepted, token = send_token_request(best, task)
            if not accepted or not token:
                logger.warning("Local self-evaluation token request rejected, retrying...")
                time.sleep(random.uniform(RETRY_DELAY_MIN, RETRY_DELAY_MAX))
                continue
            
            # Phase 2 — full task
            if send_full_task(best, task, token):
                with lock:
                    assigned_tasks[task["task_id"]] = best
                    task_store[task["task_id"]] = task
                    tasks[task["task_id"]]["status"] = "executing"
                    tasks[task["task_id"]]["assigned_node"] = best
                    tasks[task["task_id"]]["updated_at"] = time.time()
                logger.info(f"Task {task['task_id']} assigned locally (self-evaluation)")
                return True
                
            time.sleep(random.uniform(RETRY_DELAY_MIN, RETRY_DELAY_MAX))
            continue

        # Power of Two Choices: pick less-loaded node
        if len(candidates) == 1:
            remote_best = candidates[0]
            remote_score = get_load(remote_best)
        else:
            scores = [(c, get_load(c)) for c in candidates]
            remote_best, remote_score = max(scores, key=lambda x: x[1])

        local_score = get_runtime_score(receiver_runtime)

        if local_score >= remote_score:

            best = {
                "node_id": runtime.node_id,
                "ip": runtime.ip,
                "port": runtime.port,
            }

            logger.info(
                f"Choosing local node "
                f"(score={local_score}) "
                f"over remote "
                f"(score={remote_score})"
            )

        else:

            best = remote_best

            logger.info(
                f"Choosing remote node "
                f"{best['node_id']} "
                f"(score={remote_score})"
            )

        # Phase 1 — admission
        accepted, token = send_token_request(best, task)
        if not accepted or not token:
            tried.add(best['ip'])
            time.sleep(random.uniform(RETRY_DELAY_MIN, RETRY_DELAY_MAX))
            continue

        # Phase 2 — full task
        if send_full_task(best, task, token):
            with lock:
                assigned_tasks[task["task_id"]] = best
                task_store[task["task_id"]] = task

                tasks[task["task_id"]]["status"] = "executing"

                tasks[task["task_id"]]["assigned_node"] = {
                    "node_id": best["node_id"],
                    "ip": best["ip"],
                    "port": best["port"],
                }

                tasks[task["task_id"]]["updated_at"] = time.time()
            logger.info(f"Task {task['task_id']} assigned to {best['ip']}:{best['port']}")
            return True

        tried.add(best['ip'])
        time.sleep(random.uniform(RETRY_DELAY_MIN, RETRY_DELAY_MAX))

    # All retries exhausted — re-queue for later
    logger.warning(f"Task {task['task_id']} exhausted retries. Re-queuing.")
    task['retries'] = task.get('retries', 0) + 1
    add_task(task)
    return False