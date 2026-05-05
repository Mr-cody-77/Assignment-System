import uuid

def create_task(data):
    return {
        "task_id": str(uuid.uuid4()),
        "data": data,
        "retries": 0
    }