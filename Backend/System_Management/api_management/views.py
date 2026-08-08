import threading

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import uuid

# ── PLAGIARISM DETECTION — isolated import (new, additive only) ───────────────
from api_management.services.plagiarism_pipeline import trigger_plagiarism_pipeline
# ─────────────────────────────────────────────────────────────────────────────

from api_management.services.task_dispatch_service import submit_task
from Services.Sender_Server.state import tasks, lock
from Services.Receiver_Server.load_checker import can_accept_next_task
from Services.load_score import get_runtime_score
from Services.Receiver_Server.result_handler import handle_result
from api_management.services.handle_local_run import execute_code_locally

from api_management.services.node_info import handle_node_info


from Services.Receiver_Server.worker_manager import (
    handle_accepted_task,
)
import time

import urllib.request
import json
from api_management.models import CachedQuestion
from Services.Sender_Server.runtime import runtime

# Global variable to track the last heartbeat
last_heartbeat = time.time()

class HeartbeatView(APIView):
    def post(self, request):
        global last_heartbeat
        last_heartbeat = time.time()
        return Response({"status": "ok"}, status=status.HTTP_200_OK)

class CacheQuestionsView(APIView):
    def post(self, request):
        question_ids = request.data.get("question_ids", [])
        auth_header = request.headers.get("Authorization")
        
        if not runtime.database_server:
            return Response({"error": "No database server connected"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
        db = runtime.database_server
        cached_count = 0
        
        for qid in question_ids:
            url = f"http://{db['ip']}:{db['port']}/api/questions/{qid}/"
            try:
                req = urllib.request.Request(url)
                if auth_header:
                    req.add_header("Authorization", auth_header)
                with urllib.request.urlopen(req, timeout=5) as response:
                    q_data = json.loads(response.read().decode())
                    
                    # Update or create the cached question
                    CachedQuestion.objects.update_or_create(
                        question_id=str(qid),
                        defaults={
                            "test_cases": q_data.get("test_cases", []),
                            "hidden_test_cases": q_data.get("hidden_test_cases", [])
                        }
                    )
                    cached_count += 1
            except Exception as e:
                print(f"Failed to cache question {qid}: {e}")
                
        return Response({"status": "success", "cached_count": cached_count}, status=status.HTTP_200_OK)

class TaskSubmissionView(APIView):
    def post(self, request):
        data = request.data

        try:
            result = submit_task(
                roll_number=data["roll_number"],
                question=data["question"],
                language=data["language"],
                solution=data["solution"],
                token=data.get("token"),
            )

            # ── PLAGIARISM DETECTION — async background job (new, isolated) ──
            # Fires AFTER submit_task() returns. The existing distributed
            # pipeline is completely unaffected. daemon=True ensures this
            # thread never blocks node shutdown.
            try:
                question_obj = data.get("question", {})
                q_id = (
                    question_obj.get("id", "")
                    if isinstance(question_obj, dict)
                    else str(question_obj)
                )
                threading.Thread(
                    target=trigger_plagiarism_pipeline,
                    args=(
                        data["roll_number"],
                        str(q_id),
                        data["language"],
                        data["solution"],
                    ),
                    daemon=True,
                ).start()
            except Exception:
                # Never let plagiarism logic affect the main response
                pass
            # ─────────────────────────────────────────────────────────────────

            return Response(
                result,
                status=status.HTTP_202_ACCEPTED,
            )

        except Exception as e:
            return Response(
                {
                    "error": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class TaskStatusView(APIView):
    def get(self, request):

        with lock:

            result = list(
                tasks.values()
            )

        return Response(result)
    

""" Reciever Side Functions """

from Services.Receiver_Server.runtime import runtime
from Services.Receiver_Server.load_checker import get_predicted_score

class LoadView(APIView):

    def get(self, request):

        return Response(
            {
                "node_id": runtime.node_id,
                "hostname": runtime.hostname,
                "ip": runtime.ip,
                "port": runtime.port,

                "cpu_usage": runtime.cpu_usage,
                "memory_usage": runtime.memory_usage,
                "io_wait": runtime.io_wait,

                "active_workers": runtime.active_workers,
                "inflight_tasks": runtime.inflight_tasks,
                "completed_tasks": runtime.completed_tasks,
                "workers_limit": runtime.workers_limit,

                "current_load_score": get_runtime_score(runtime),
            },
            status=status.HTTP_200_OK,
        )
    
class TaskTokenView(APIView):
    def post(self, request):
        try:
            task_id = request.data["task_id"]
        except KeyError:
            return Response(
                {"error": "task_id missing"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if this node can accept one more task
        if not can_accept_next_task():
            return Response(
                {"status": "reject"},
                status=status.HTTP_200_OK
            )

        # Generate a single-use task acceptance token
        token = str(uuid.uuid4())
        runtime.register_task_token(task_id, token)

        return Response(
            {"status": "accept", "token": token},
            status=status.HTTP_200_OK
        )
    
class AcceptedTaskView(APIView):

    def post(self, request):

        task_id = request.data.get(
            "task_id",
            ""
        )

        token = request.data.get(
            "token",
            ""
        )

        if not runtime.validate_task_token(
            task_id,
            token,
        ):

            return Response(
                {
                    "status": "reject",
                    "reason": "invalid_token",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        payload = dict(request.data)

        payload["authorization"] = request.headers.get(
            "Authorization",
            ""
        )

        ok, reason = handle_accepted_task(
            payload
        )

        if not ok:

            return Response(
                {
                    "status": "reject",
                    "reason": reason,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": "accepted",
            },
            status=status.HTTP_200_OK,
        )
  
class TaskResultView(APIView):
    def post(self, request):
        print("TaskresultView have been called")
        payload = dict(request.data)

        authorization = payload.get("authorization", "")


        success = handle_result(payload, authorization)

        # 2. <-- ADD THIS BLOCK: Update the local Node memory
        task_id = payload.get("task_id")
        if task_id:
            with lock:
                if task_id in tasks:
                    # Overwrite 'executing' with 'accepted', 'wrong_answer', etc.
                    tasks[task_id]["status"] = payload.get("status", "completed")
                    # Save the payload so React can display the Dropdown details
                    tasks[task_id]["result"] = payload 

        # 3. Return response to worker
        if success:
            return Response(
                {"success": True},
                status=status.HTTP_200_OK,
            )

        return Response(
            {"success": False},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
class NodeInfoView(APIView):

    def get(self, request):

        try:

            info = handle_node_info()

            return Response(
                info,
                status=status.HTTP_200_OK,
            )

        except Exception as e:

            return Response(
                {
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        

class LocalRunView(APIView):
    def post(self, request):
        try:
            # Extract data sent from the React frontend (code, language, test_cases)
            payload = request.data
            
            # 2. Call your dedicated local run service
            # It should ideally return a dictionary containing the results per test case, 
            # total passed, and any overarching errors (like Syntax Error)
            result_data = execute_code_locally(payload)
            
            return Response(
                result_data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status
            )

class StopSystemView(APIView):
    def post(self, request):
        import threading
        import time
        import subprocess
        import platform
        import os

        def kill_later():
            time.sleep(1.0)
            # Find Assignment-System root (views.py -> api_management -> System_Management -> Backend -> Assignment-System)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            
            if platform.system() == 'Windows':
                subprocess.run("taskkill /F /IM node.exe /T", shell=True)
                subprocess.run("taskkill /F /IM python.exe /T", shell=True)
            else:
                subprocess.run("pkill -f node", shell=True)
                subprocess.run("pkill -f python", shell=True)

        threading.Thread(target=kill_later, daemon=True).start()
        return Response({"status": "stopping"}, status=status.HTTP_200_OK)
