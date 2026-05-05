
import requests
import time
import random
from config import *
from node_manager import get_two_nodes, get_load
from state import assigned_tasks, task_store, lock
from queue_manager import add_task
from runtime import runtime

NODE_NAME = runtime.node_id
NODE_IP = runtime.ip

def send_token_request(node, task, SENDER_ID, SENDER_IP):
    ip, port = node["ip"], node["port"]

    payload = {
        "task_id": task["task_id"],
        "sender_id": SENDER_ID,
        "sender_ip": SENDER_IP,
        "response_port": RESPONSE_PORT,
        "size": len(str(task["data"]))  # rough estimate
    }

    try:
        res = requests.post(f"http://{ip}:{port}/request_token", json=payload, timeout=2)
        return res.json().get("status") == "accept"
    except:
        return False

def send_full_task(node, task, SENDER_ID, SENDER_IP):
    ip = node["ip"]
    port = node["port"]

    payload = {
        "task_id": task["task_id"],
        "code": task["data"]["code"],
        "test_cases": task["data"]["test_cases"],
        "sender_id": SENDER_ID,
        "sender_ip": SENDER_IP,
        "response_port": RESPONSE_PORT
    }

    try:
        res = requests.post(
            f"http://{ip}:{port}/accepted_task",
            json=payload,
            timeout=5
        )
        return res.status_code == 200
    except Exception:
        return False
    
def assign_task(task):
    tried_nodes = set()

    for _ in range(MAX_RETRIES):
        node1, node2 = get_two_nodes()

        candidates = [n for n in [node1, node2] if n["ip"] not in tried_nodes]

        if not candidates:
            continue

        best = min(candidates, key=lambda n: get_load(n))

        success = send_token_request(best, task, NODE_NAME, NODE_IP)

        if success:
            with lock:
                assigned_tasks[task["task_id"]] = best
            return True
        else:
            tried_nodes.add(best["ip"])

        time.sleep(random.uniform(RETRY_DELAY_MIN, RETRY_DELAY_MAX))

    add_task(task)
    return False