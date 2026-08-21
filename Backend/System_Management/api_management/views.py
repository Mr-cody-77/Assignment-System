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
from api_management.models import CachedQuestion, CachedTest
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
                            "data": q_data,
                            "test_cases": q_data.get("test_cases", []),
                            "hidden_test_cases": q_data.get("hidden_test_cases", [])
                        }
                    )
                    cached_count += 1
            except Exception as e:
                print(f"Failed to cache question {qid}: {e}")
                
        return Response({"status": "success", "cached_count": cached_count}, status=status.HTTP_200_OK)

class ProxyQuestionsListView(APIView):
    def get(self, request):
        auth_header = request.headers.get("Authorization")
        
        # 1. Try fetching from the Central Database
        if runtime.database_server:
            db = runtime.database_server
            url = f"http://{db['ip']}:{db['port']}/api/questions/"
            try:
                req = urllib.request.Request(url)
                if auth_header:
                    req.add_header("Authorization", auth_header)
                with urllib.request.urlopen(req, timeout=5) as response:
                    questions_data = json.loads(response.read().decode())
                    
                    # Opportunistically cache all returned questions
                    for q_data in questions_data:
                        q_id = str(q_data.get("id"))
                        CachedQuestion.objects.update_or_create(
                            question_id=q_id,
                            defaults={
                                "data": q_data,
                                "test_cases": q_data.get("test_cases", []),
                                "hidden_test_cases": q_data.get("hidden_test_cases", [])
                            }
                        )
                    return Response(questions_data, status=status.HTTP_200_OK)
            except Exception as e:
                print(f"Failed to fetch questions list from central DB, falling back to local cache: {e}")
                pass
                
        # 2. Fallback to offline SQLite cache
        try:
            cached_qs = CachedQuestion.objects.all()
            results = []
            for cached_q in cached_qs:
                if cached_q.data:
                    results.append(cached_q.data)
            
            print(f"Serving {len(results)} offline questions")
            return Response(results, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Offline mode active, but error fetching from cache: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ProxyQuestionView(APIView):
    def get(self, request, pk):
        auth_header = request.headers.get("Authorization")
        
        # 1. Try fetching from the Central Database
        if runtime.database_server:
            db = runtime.database_server
            url = f"http://{db['ip']}:{db['port']}/api/questions/{pk}/"
            try:
                req = urllib.request.Request(url)
                if auth_header:
                    req.add_header("Authorization", auth_header)
                with urllib.request.urlopen(req, timeout=5) as response:
                    q_data = json.loads(response.read().decode())
                    
                    # Opportunistically cache it
                    CachedQuestion.objects.update_or_create(
                        question_id=str(pk),
                        defaults={
                            "data": q_data,
                            "test_cases": q_data.get("test_cases", []),
                            "hidden_test_cases": q_data.get("hidden_test_cases", [])
                        }
                    )
                    return Response(q_data, status=status.HTTP_200_OK)
            except Exception as e:
                print(f"Failed to fetch question from central DB, falling back to local cache: {e}")
                pass
                
        # 2. Fallback to offline SQLite cache
        try:
            cached_q = CachedQuestion.objects.get(question_id=str(pk))
            if cached_q.data:
                print(f"Serving offline question data for Q{pk}")
                return Response(cached_q.data, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Offline mode active, but question content not fully cached."}, status=status.HTTP_404_NOT_FOUND)
        except CachedQuestion.DoesNotExist:
            return Response({"error": "Offline mode active, but question was not found in cache."}, status=status.HTTP_404_NOT_FOUND)

class ProxyTestView(APIView):
    def get(self, request, pk):
        auth_header = request.headers.get("Authorization")
        
        # 1. Try fetching from the Central Database
        if runtime.database_server:
            db = runtime.database_server
            url = f"http://{db['ip']}:{db['port']}/api/tests/{pk}/"
            try:
                req = urllib.request.Request(url)
                if auth_header:
                    req.add_header("Authorization", auth_header)
                with urllib.request.urlopen(req, timeout=5) as response:
                    test_data = json.loads(response.read().decode())
                    
                    # Opportunistically cache it
                    CachedTest.objects.update_or_create(
                        test_id=str(pk),
                        defaults={
                            "data": test_data,
                        }
                    )
                    return Response(test_data, status=status.HTTP_200_OK)
            except Exception as e:
                print(f"Failed to fetch test from central DB, falling back to local cache: {e}")
                pass
                
        # 2. Fallback to offline SQLite cache
        try:
            cached_test = CachedTest.objects.get(test_id=str(pk))
            return Response(cached_test.data, status=status.HTTP_200_OK)
        except CachedTest.DoesNotExist:
            return Response({"error": "Offline mode active, but test was not found in cache."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"Offline mode active, but error fetching from cache: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
                email=data.get("email"),
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

from Services.Receiver_Server.runtime import runtime as receiver_runtime
from Services.Receiver_Server.load_checker import get_predicted_score

class LoadView(APIView):
    def get(self, request):
        try:
            return Response({
                "status": "success",
                "node_id": receiver_runtime.node_id,
                "hostname": receiver_runtime.hostname,
                "ip": receiver_runtime.ip,
                "port": receiver_runtime.port,
                
                "cpu_usage": receiver_runtime.cpu_usage,
                "memory_usage": receiver_runtime.memory_usage,
                "io_wait": receiver_runtime.io_wait,
                
                "active_workers": receiver_runtime.active_workers,
                "inflight_tasks": receiver_runtime.inflight_tasks,
                "completed_tasks": receiver_runtime.completed_tasks,
                "workers_limit": receiver_runtime.workers_limit,
                
                "current_load_score": get_predicted_score(receiver_runtime),
            },
            status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
        receiver_runtime.register_task_token(task_id, token)

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

        if not receiver_runtime.validate_task_token(
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
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class StopServersView(APIView):
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
                venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
            else:
                venv_python = os.path.join(base_dir, ".venv", "bin", "python")
                
            stop_script = os.path.join(base_dir, "stop_servers.py")
            
            if os.path.exists(venv_python) and os.path.exists(stop_script):
                subprocess.run([venv_python, stop_script])

        threading.Thread(target=kill_later, daemon=True).start()
        return Response({"status": "stopping"}, status=status.HTTP_200_OK)



class ProxySubmitTestView(APIView):
    """
    Proxies test submissions to Central DB.
    If Central DB is offline, queues the submission locally.
    """
    def post(self, request):
        test_id = request.data.get('test_id')
        authorization = request.headers.get('Authorization', '')
        roll_number = request.data.get('roll_number', '')
        
        db = runtime.database_server
        if not db:
            from api_management.models import PendingTestSubmission
            PendingTestSubmission.objects.create(
                test_id=str(test_id) if test_id else '',
                roll_number=roll_number,
                authorization=authorization
            )
            return Response({'success': True, 'message': 'Test submitted offline. Will sync on reconnect.'}, status=200)
            
        url = f"http://{db['ip']}:{db['port']}/api/tests/submit/"
        try:
            req = urllib.request.Request(url, data=json.dumps(request.data).encode(), method='POST')
            req.add_header('Content-Type', 'application/json')
            if authorization:
                req.add_header('Authorization', authorization)
                
            with urllib.request.urlopen(req, timeout=5) as response:
                return Response(json.loads(response.read().decode()), status=response.status)
        except urllib.error.HTTPError as e:
            if e.code == 404 or e.code >= 500:
                # Might be hitting wrong server or Central DB is down
                from api_management.models import PendingTestSubmission
                PendingTestSubmission.objects.create(
                    test_id=str(test_id) if test_id else '',
                    roll_number=roll_number,
                    authorization=authorization
                )
                return Response({'success': True, 'message': f'Test submitted offline (Server error {e.code}). Will sync on reconnect.'}, status=200)
            
            try:
                return Response(json.loads(e.read().decode()), status=e.code)
            except:
                return Response({'error': str(e)}, status=e.code)
        except Exception as e:
            # Re-queue on network error
            from api_management.models import PendingTestSubmission
            PendingTestSubmission.objects.create(
                test_id=str(test_id) if test_id else '',
                roll_number=roll_number,
                authorization=authorization
            )
            return Response({'success': True, 'message': 'Test submitted offline (network error).'}, status=200)

