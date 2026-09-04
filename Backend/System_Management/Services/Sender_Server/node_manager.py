"""
Sender_Server/node_manager.py
"""

import logging
import random
import time



import requests

from Services.Sender_Server.queue_manager import add_task
from Services.Sender_Server.runtime import runtime
from Services.Receiver_Server.runtime import runtime as receiver_runtime
from Services.load_score import compute_score_from_metrics
from Services.Sender_Server.state import assigned_tasks, task_store, lock



logger = logging.getLogger("sender.node_manager")

LOAD_TIMEOUT = 1.5


def get_two_nodes(exclude: set | None = None) -> list[dict]:
    """
    Return up to two random remote nodes.
    Used by assigner.py for Power of Two Choices.
    """

    exclude = exclude or set()

    with runtime.lock:

        candidates = []
        seen_machines = set()

        for node in runtime.nodes.values():
            n_id = node.get("node_id")
            n_ip = node.get("ip")
            n_port = int(node.get("port", 0))
            n_host = node.get("hostname")

            # Exclude local machine (both sender and receiver runtimes)
            if n_id in (runtime.node_id, receiver_runtime.node_id):
                continue
            if n_ip in ("127.0.0.1", "localhost", runtime.ip, receiver_runtime.ip) and n_port in (int(runtime.port), int(receiver_runtime.port)):
                continue
            if n_host and n_host == runtime.hostname and n_port == int(runtime.port):
                continue
            if n_ip in exclude:
                continue

            # Deduplicate by machine (hostname:port or ip:port)
            machine_key = f"{n_host or n_ip}:{n_port}"
            if machine_key in seen_machines:
                continue
            seen_machines.add(machine_key)

            candidates.append(node)

    if not candidates:
        return []

    if len(candidates) == 1:
        return [candidates[0]]

    return random.sample(
        candidates,
        min(2, len(candidates))
    )



def get_load(node: dict) -> float:

    ip=node.get("ip")
    port=node.get("port")

    try:

        res=requests.get(
            f"http://{ip}:{port}/api/get-load/",
            timeout=LOAD_TIMEOUT,
        )

        data=res.json()

        good_score=float(
            data.get(
                "current_load_score",
                0.0,
            )
        )

        with runtime.lock:
            node_entry=runtime.nodes.get(
                node.get("node_id")
            )

            if node_entry:
                node_entry["load"]=good_score
                node_entry["metrics"]=data
                node_entry["last_seen"]=time.time()

        return good_score

    except Exception as e:

        logger.debug(
            f"Load query failed for {ip}:{port} - {e}"
        )

        return 0.0

def get_self_load() -> float:

    return compute_score_from_metrics({
        "cpu_usage": receiver_runtime.cpu_usage,
        "memory_usage": receiver_runtime.memory_usage,
        "io_wait": receiver_runtime.io_wait,
        "active_workers": receiver_runtime.active_workers,
        "inflight_tasks": receiver_runtime.inflight_tasks,
        "workers_limit": receiver_runtime.workers_limit,
    })

def get_database_server():
    return runtime.database_server


def database_available() -> bool:
    return runtime.database_server is not None


def on_node_removed(node_id: str):
    """
    Re-queue tasks assigned to a node
    that left the network.
    """

    tasks_to_reassign = []

    with lock:

        for task_id, assigned_node in list(
            assigned_tasks.items()
        ):

            if (
                assigned_node.get("node_id") == node_id
                or assigned_node.get("ip") == node_id
            ):
                tasks_to_reassign.append(task_id)

        for task_id in tasks_to_reassign:

            assigned_tasks.pop(task_id, None)

            task = task_store.get(task_id)

            if task:

                task["retries"] = (
                    task.get("retries", 0) + 1
                )

                add_task(task)

                logger.info(
                    f"Re-queued task {task_id} "
                    f"after node {node_id} left"
                )