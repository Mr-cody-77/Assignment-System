"""
System monitor — polls CPU, memory, and I/O metrics using psutil.
Updates the shared runtime state on a regular interval.
"""

import time
import logging
import threading

logger = logging.getLogger(__name__)

POLL_INTERVAL = 2.0  # seconds


def system_monitor():
    """
    Background daemon thread: continuously polls system metrics
    and updates the shared runtime object.
    """
    try:
        import psutil
    except ImportError:
        logger.warning("psutil not installed; system monitor disabled.")
        return

    from Services.Receiver_Server.runtime import runtime

    logger.info(f"System monitor started on {runtime.hostname} ({runtime.ip})")

    while True:
        try:
            cpu = psutil.cpu_percent(interval=POLL_INTERVAL) / 100.0
            mem = psutil.virtual_memory().percent / 100.0

            # I/O wait — best effort
            io_wait = 0.0
            try:
                cpu_times = psutil.cpu_times_percent(interval=0)
                io_wait = getattr(cpu_times, 'iowait', 0.0) / 100.0
            except Exception:
                pass

            with runtime.lock:
                runtime.cpu_usage = round(cpu, 4)
                runtime.memory_usage = round(mem, 4)
                runtime.io_wait = round(io_wait, 4)

        except Exception as e:
            logger.error(f"System monitor error: {e}")
            time.sleep(POLL_INTERVAL)
