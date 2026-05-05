import threading
from config import *
from queue_manager import add_task
from task_model import create_task
from state import task_store
from response_server import start_response_server
from worker import worker

def start_workers():
    for _ in range(MAX_WORKERS):
        t = threading.Thread(target=worker, daemon=True)
        t.start()


def simulate_client_request():
    sample_task_data = {
        "code": "int main(){return 0;}",
        "test_cases": []
    }

    task = create_task(sample_task_data)

    task_store[task["task_id"]] = task
    add_task(task)


if __name__ == "__main__":
    # start response server
    threading.Thread(
        target=start_response_server,
        args=(RESPONSE_PORT,),
        daemon=True
    ).start()

    # start workers
    start_workers()

    # simulate incoming tasks
    while True:
        simulate_client_request()