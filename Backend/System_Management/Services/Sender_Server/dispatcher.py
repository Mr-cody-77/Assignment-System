import logging
import threading
import time

from Services.Sender_Server.assigner import assign_task
from Services.Sender_Server.config import (
    MAX_ASSIGNER_THREADS,
    DISPATCHER_SLEEP,
)
from Services.Sender_Server.queue_manager import (
    get_task,
)

logger = logging.getLogger(
    "sender.dispatcher"
)

active_assigners = 0

assigner_lock = threading.Lock()


def assigner_worker(task):

    global active_assigners

    try:

        assign_task(task)

    except Exception as e:

        logger.exception(
            f"Assigner failed: {e}"
        )

    finally:

        with assigner_lock:

            active_assigners -= 1


def start_dispatcher():

    global active_assigners

    logger.info(
        "Dispatcher started"
    )

    while True:

        with assigner_lock:

            if active_assigners >= MAX_ASSIGNER_THREADS:

                time.sleep(
                    DISPATCHER_SLEEP
                )

                continue

        task = get_task()

        with assigner_lock:

            active_assigners += 1

        threading.Thread(
            target=assigner_worker,
            args=(task,),
            daemon=True,
        ).start()