"""
api_management/heartbeat_daemon.py

Periodically reports local node telemetry to the Centralized Database Server.
Ensures the Central Database maintains an authoritative registry of active cluster nodes.
"""

import json
import logging
import threading
import time
import urllib.request

logger = logging.getLogger("heartbeat.daemon")

def _send_heartbeat_loop():
    time.sleep(5)  # Wait for runtime and discovery initialization

    from Services.Receiver_Server.runtime import runtime as receiver_runtime
    from Services.Receiver_Server.load_checker import get_predicted_score
    from Services.Sender_Server.runtime import runtime as sender_runtime

    while True:
        try:
            db = sender_runtime.database_server or receiver_runtime.database_server
            if db and db.get("ip") and db.get("port"):
                db_ip = db["ip"]
                db_port = db["port"]
                url = f"http://{db_ip}:{db_port}/api/nodes/heartbeat/"

                payload = {
                    "node_id": receiver_runtime.node_id,
                    "hostname": receiver_runtime.hostname,
                    "ip": receiver_runtime.ip,
                    "port": receiver_runtime.port,
                    "cpu_usage": receiver_runtime.cpu_usage,
                    "memory_usage": receiver_runtime.memory_usage,
                    "io_wait": receiver_runtime.io_wait,
                    "active_workers": receiver_runtime.active_workers,
                    "inflight_tasks": receiver_runtime.inflight_tasks,
                    "completed_tasks": receiver_runtime.completed_tasks,
                    "workers_limit": receiver_runtime.workers_limit,
                    "current_load_score": get_predicted_score(),
                }

                data_bytes = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=data_bytes,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )

                with urllib.request.urlopen(req, timeout=4) as resp:
                    if 200 <= resp.status < 300:
                        logger.debug("Cluster heartbeat sent successfully.")
        except Exception as e:
            logger.debug(f"Heartbeat dispatch skipped: {e}")

        time.sleep(10)


def start_heartbeat_daemon():
    t = threading.Thread(
        target=_send_heartbeat_loop,
        daemon=True,
        name="cluster-node-heartbeat",
    )
    t.start()
