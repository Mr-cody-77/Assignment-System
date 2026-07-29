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
