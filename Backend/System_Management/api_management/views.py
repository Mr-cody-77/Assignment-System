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

# ── Exam Lockdown Endpoints ─────────────────────────────────────────────────
import json
import urllib.request
import urllib.error
from lockdown import enable_lockdown, disable_lockdown, xor_decrypt, is_locked
from Services.Sender_Server.runtime import runtime as sender_runtime


class LockdownLockView(APIView):
    """Student triggers port lockdown at exam start."""

    def post(self, request):
        # 1. Fetch active exam config from Centralized Database
        db = sender_runtime.database_server
        if not db:
            return Response(
                {"error": "Database server not discovered"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        config_url = f"http://{db['ip']}:{db['port']}/api/tests/start/"

        try:
            # Forward the student's auth token to the Central DB
            auth_header = request.headers.get("Authorization", "")
            req = urllib.request.Request(
                config_url,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": auth_header,
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                config = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            error_msg = ""
            try:
                body = e.read().decode()
                json_body = json.loads(body)
                error_msg = json_body.get('error', f"Failed to fetch exam config: {e.code} {body}")
            except Exception:
                error_msg = f"Failed to fetch exam config: {e.code}"
            
            return Response(
                {"error": error_msg},
                status=e.code if e.code in [403, 404] else status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to fetch exam config: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        duration = config.get("duration_minutes", 60)
        encrypted_password = config.get("admin_password", "")

        # 2. Decrypt password in-memory (never stored on disk)
        try:
            admin_password = xor_decrypt(encrypted_password)
        except Exception:
            return Response(
                {"error": "Failed to decrypt admin password"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 3. Apply firewall lockdown
        db_ip = db.get("ip", "")
        db_port = db.get("port", 8000)
        result = enable_lockdown(db_ip=db_ip, db_port=db_port, admin_password=admin_password)

        if not result.get("success"):
            return Response(
                {"error": result.get("error", "Lockdown failed")},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "duration_minutes": duration,
                "message": "Internet lockdown enabled",
            },
            status=status.HTTP_200_OK,
        )


class LockdownUnlockView(APIView):
    """Unlocks ports when exam ends (timer expiry or student clicks End Test)."""

    def post(self, request):
        # 1. Fetch active exam config from Centralized Database to validate
        db = sender_runtime.database_server
        if not db:
            return Response(
                {"error": "Database server not discovered"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        config_url = f"http://{db['ip']}:{db['port']}/api/tests/active/"

        try:
            auth_header = request.headers.get("Authorization", "")
            req = urllib.request.Request(
                config_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": auth_header,
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                config = json.loads(resp.read().decode())
        except Exception as e:
            return Response(
                {"error": f"Failed to verify exam config: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            admin_password = xor_decrypt(config.get("admin_password", ""))
        except Exception:
            admin_password = None

        # 2. Disable the lockdown
        result = disable_lockdown(admin_password=admin_password)

        if not result.get("success"):
            return Response(
                {"error": result.get("error", "Unlock failed")},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "message": "Internet lockdown disabled",
            },
            status=status.HTTP_200_OK,
        )


class LockdownStatusView(APIView):
    """Check if lockdown is currently active."""

    def get(self, request):
        return Response(
            {"locked": is_locked()},
            status=status.HTTP_200_OK,
        )