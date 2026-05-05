from queue import Queue

task_queue = Queue()

def add_task(task):
    task_queue.put(task)

def get_task():
    return task_queue.get()