import random
import requests
from runtime import runtime
from state import assigned_tasks, task_store, lock
from queue_manager import add_task


def get_two_nodes():
    nodes = runtime.nodes 
    if len(nodes) < 2:
        return list(nodes.values())
    return random.sample(list(nodes.values()), 2)

def on_node_removed(node_name):
    tasks_to_reassign = []

    with lock:
        for task_id, node in list(assigned_tasks.items()):
            if node["name"] == node_name:
                tasks_to_reassign.append(task_id)

        for task_id in tasks_to_reassign:
            assigned_tasks.pop(task_id, None)

            task = task_store.get(task_id)
            if task:
                task["retries"] += 1
                add_task(task)

def get_load(node):
    ip, port = node['ip'], node['port']
    try:
        res = requests.get(f"http://{ip}:{port}/load", timeout=1)
        return res.json().get("load", 1.0)
    except:
        return 1.0