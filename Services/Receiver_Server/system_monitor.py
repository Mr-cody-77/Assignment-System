import time
import threading
import psutil
from runtime import runtime


CPU_INTERVAL = 0.5 #seconds 



def system_monitor():

    psutil.cpu_percent(interval=None)

    while True:

        cpu = psutil.cpu_percent(interval=CPU_INTERVAL)          # %
        memory = psutil.virtual_memory().percent                 # %
        cpu_times = psutil.cpu_times_percent(interval=None)      # %
        io_wait = getattr(cpu_times, "iowait", 0.0)              # % (only on Linux)

        with runtime.lock:
            runtime.cpu_usage = cpu / 100.0
            runtime.memory_usage = memory / 100.0
            runtime.io_wait = io_wait / 100.0
