from queue import Queue, Full, Empty


MAX_QUEUE_SIZE = 1000  

task_queue = Queue(maxsize=MAX_QUEUE_SIZE)



def add_task(task):
    try:
        task_queue.put(task, block=False)
        return True
    except Full:
        return False



def get_task(timeout=1):
    try:
        return task_queue.get(timeout=timeout)
    except Empty:
        return None
    
def task_done():
    task_queue.task_done()


def get_queue_size():
    return task_queue.qsize()


def is_empty():
    return task_queue.empty()


def is_full():
    return task_queue.full()