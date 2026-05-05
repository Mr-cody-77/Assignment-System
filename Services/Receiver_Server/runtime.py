import threading
import time

class Runtime:
    def __init__(self):
        self.cpu_usage = 0.0
        self.memory_usage = 0.0
        self.io_wait = 0.0

        self.active_workers = 0
        self.inflight_tasks = 0

        self.workers_limit = 5

        self.lock = threading.Lock()

runtime = Runtime()