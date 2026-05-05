import threading

assigned_tasks = {}
task_store = {}

lock = threading.Lock()