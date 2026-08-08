import logging
import time
import json
import urllib.request

from Services.Sender_Server.queue_manager import add_task
from Services.Sender_Server.task_model import create_task
from Services.Sender_Server.state import tasks, lock
from Services.Sender_Server.runtime import runtime  # <-- Added to get Database IP
from api_management.models import CachedQuestion

logger = logging.getLogger("task.dispatch")


def submit_task(
    roll_number,
    question,
    language,
    solution,
    token=None,
):
    task = create_task(
        roll_number=roll_number,
        question=question,
        language=language,
        solution=solution,
    )
    
    # Store token in task so the worker can use it to push results back
    task["token"] = token

    # --- MODIFIED HERE: Fetch test cases from Centralized DB ---
    question_id = task.get("question_id") or (question.get("id") if isinstance(question, dict) else question)
    
    if runtime.database_server:
        db = runtime.database_server
        url = f"http://{db['ip']}:{db['port']}/api/questions/{question_id}/"
        
        try:
            req = urllib.request.Request(url)
            if token:
                req.add_header("Authorization", f"Bearer {token}")
            with urllib.request.urlopen(req, timeout=5) as response:
                q_data = json.loads(response.read().decode())
                # Inject the fetched test cases into the task payload
                task["test_cases"] = q_data.get("test_cases", [])
                task["hidden_test_cases"] = q_data.get("hidden_test_cases", [])
        except Exception as e:
            logger.warning(f"Failed to fetch test cases from Central DB for Q{question_id}, falling back to local cache: {e}")
            try:
                cached_q = CachedQuestion.objects.get(question_id=str(question_id))
                task["test_cases"] = cached_q.test_cases
                task["hidden_test_cases"] = cached_q.hidden_test_cases
                logger.info(f"Successfully loaded {len(cached_q.hidden_test_cases)} hidden test cases from offline cache.")
            except CachedQuestion.DoesNotExist:
                logger.error(f"No offline cache found for Q{question_id}. Evaluation will proceed with empty test cases.")

    # Fallback to empty lists if the fetch failed so the worker doesn't crash
    if "test_cases" not in task:
        task["test_cases"] = []
    if "hidden_test_cases" not in task:
        task["hidden_test_cases"] = []
    # -----------------------------------------------------------

    with lock:
        tasks[task["task_id"]] = {
            "task_id": task["task_id"],
            "question_id": task["question_id"],
            "roll_number": task["roll_number"],
            "status": "queued",
            "assigned_node": None,
            "created_at": time.time(),
            "updated_at": time.time(),
            "result": None,
        }

    success = add_task(task)

    if not success:
        with lock:
            tasks.pop(
                task["task_id"],
                None,
            )

        return {
            "status": "queue_full",
        }

    logger.info(
        f"Task queued {task['task_id']} with {len(task.get('test_cases', []))} test cases"
    )

    return {
        "task_id": task["task_id"],
        "status": "queued",
    }