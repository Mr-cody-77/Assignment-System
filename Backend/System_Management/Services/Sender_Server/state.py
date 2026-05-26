"""
Sender_Server/state.py

Shared task state.
"""

import threading

# task_id -> status information
tasks = {}

# task_id -> assigned node
assigned_tasks = {}

# task_id -> full payload
task_store = {}

lock = threading.Lock()