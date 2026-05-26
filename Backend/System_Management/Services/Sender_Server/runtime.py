"""
Sender_Server/runtime.py

Shared runtime state for Sender Server.
Stores discovered execution nodes and database server information.
"""

import os
import socket
import threading
import uuid


class Runtime:
    """Thread-safe shared runtime for Sender Server."""

    def __init__(self):

        # Unique node identifier
        self.node_id = f"Node-{uuid.uuid4().hex[:8]}"

        # Filled by network.py
        self.ip = None

        # Local hostname
        self.hostname = socket.gethostname()

        # Sender server port
        print(
            "NODE_PORT ENV =",
            os.environ.get("NODE_PORT")
        )
        self.port = int(
            os.environ.get(
                "NODE_PORT",
                8000
            )
        )
        print(
            "RUNTIME PORT =",
            self.port
        )
        # Dispatcher settings
        self.workers_limit = 5
        self.active_workers = 0
        self.inflight_tasks = 0

        # Discovered execution nodes
        self.nodes = {}

        # Centralized database server
        self.database_server = None

        # Zeroconf references
        self.zc = None
        self.service_info = None

        # Synchronization lock
        self.lock = threading.Lock()


runtime = Runtime()