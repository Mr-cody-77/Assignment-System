"""
Receiver_Server/runtime.py
Thread-safe shared state for the standalone Receiver/Worker node.
"""

import os
import socket
import threading
import time
import uuid


def _get_local_ip() -> str:
    """Offline-safe LAN IP detection."""
    # First, try to connect to the Central DB if its IP is configured in environment
    db_ip = os.environ.get("DATABASE_SERVER_IP")
    db_port = os.environ.get("DATABASE_SERVER_PORT")
    if db_ip and db_port:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.3)
            s.connect((db_ip, int(db_port)))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith('127.'):
                return ip
        except OSError:
            pass

    for target in ('8.8.8.8', '192.168.1.1', '192.168.0.1', '10.0.0.1', '172.16.0.1'):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.3)
            s.connect((target, 80))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith('127.'):
                return ip
        except OSError:
            continue
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if not ip.startswith('127.'):
            return ip
    except OSError:
        pass
    return '127.0.0.1'


from Services.node_identity import get_persistent_node_id


class RuntimeState:
    """Mutable execution state shared across all receiver threads."""

    def __init__(self):
        self.node_id: str = get_persistent_node_id()
        self.hostname: str = socket.gethostname()
        self.ip: str = _get_local_ip()
        self.port = int(
            os.environ.get(
                "NODE_PORT",
                8000,
            )
        )

        # Resource usage (updated every 2 s by system_monitor)
        self.cpu_usage: float = 0.0
        self.memory_usage: float = 0.0
        self.io_wait: float = 0.0

        # Worker counters
        self.workers_limit: int = 5
        self.active_workers: int = 0
        self.inflight_tasks: int = 0
        self.completed_tasks: int = 0

        # Admission tokens: {task_id → token}
        self.task_tokens={}

        # Centralized database server
        db_ip = os.environ.get("DATABASE_SERVER_IP")
        db_port = os.environ.get("DATABASE_SERVER_PORT")
        if db_ip and db_port:
            self.database_server = {
                "ip": db_ip,
                "port": int(db_port),
                "last_seen": time.time(),
            }
        else:
            self.database_server = None

        self.lock = threading.RLock()



    # ── Token management ──────────────────────────────────────
    def register_task_token(self,task_id:str,token:str)->None:
        with self.lock:
            self.task_tokens[task_id]={
                "token":token,
                "created_at":time.time(),
            }

    def validate_task_token(self,task_id:str,token:str,ttl:float=60.0)->bool:
        with self.lock:
            entry=self.task_tokens.get(task_id)
            if not entry:
                return False
            if entry["token"]!=token:
                return False
            if time.time()-entry["created_at"]>ttl:
                self.task_tokens.pop(task_id,None)
                return False
            self.task_tokens.pop(task_id,None)
            return True

    # ── Worker counters ───────────────────────────────────────

    def worker_start(self) -> None:
        with self.lock:
            self.active_workers += 1

    def worker_done(self) -> None:
        with self.lock:
            self.active_workers = max(0, self.active_workers - 1)
            self.completed_tasks += 1

    def accept_inflight(self) -> None:
        with self.lock:
            self.inflight_tasks += 1

    def complete_inflight(self) -> None:
        with self.lock:
            self.inflight_tasks = max(0, self.inflight_tasks - 1)


runtime = RuntimeState()