import base64
import os
import requests
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from .models import Test, Question, TestCase, HiddenTestCase, TestAttempt, TestSubmission, LockdownSchedule
from .serializers import TestSerializer, QuestionSerializer
from results.models import Result, SubmittedSolution, SolutionFingerprint, PlagiarismDetected, CodeSubmissionHistory

EXAM_CIPHER_KEY = "SystemSecureExamKey77!"

def xor_encrypt(plain_text, key=EXAM_CIPHER_KEY):
    encrypted = bytes(ord(c) ^ ord(key[i % len(key)]) for i, c in enumerate(plain_text))
    return base64.b64encode(encrypted).decode()

def clear_test_results(test):
    question_ids = [str(q.id) for q in test.questions.all()]
    if question_ids:
        Result.objects.filter(question_id__in=question_ids).delete()
        SubmittedSolution.objects.filter(question_id__in=question_ids).delete()
        SolutionFingerprint.objects.filter(question_id__in=question_ids).delete()
        PlagiarismDetected.objects.filter(question_id__in=question_ids).delete()
        CodeSubmissionHistory.objects.filter(question_id__in=question_ids).delete()
    TestAttempt.objects.filter(test=test).delete()
    TestSubmission.objects.filter(test=test).delete()

class CreateTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != "teacher":
            return Response({"error": "Only teachers can create tests"}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        
        # Deactivate previous if this one is live
        is_live = data.get("is_live", False)
        if is_live:
            Test.objects.update(is_live=False)

        test = Test.objects.create(
            name=data.get("name", "Unnamed Test"),
            duration_minutes=int(data.get("duration_minutes", 60)),
            is_live=is_live,
            created_by=request.user
        )

        for q_data in data.get("questions", []):
            question = Question.objects.create(
                test=test,
                marks=int(q_data.get("marks", 10)),
                title=q_data["title"],
                description=q_data["description"],
                input_format=q_data.get("input_format", ""),
                output_format=q_data.get("output_format", ""),
                examples=q_data.get("examples", []),
                constraints=q_data.get("constraints", "")
            )
            for tc in q_data.get("test_cases", []):
                TestCase.objects.create(question=question, input_data=tc["input"], expected_output=tc["output"])
            for tc in q_data.get("hidden_test_cases", []):
                HiddenTestCase.objects.create(question=question, input_data=tc["input"], expected_output=tc["output"])

        return Response({"message": "Test created", "test_id": test.id}, status=status.HTTP_201_CREATED)

class TestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'teacher':
            tests = Test.objects.all()
        else:
            tests = Test.objects.filter(is_live=True)
        return Response(TestSerializer(tests, many=True, context={'request': request}).data)

class TestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, test_id):
        try:
            test = Test.objects.get(id=test_id)
            if request.user.role == 'student':
                if not test.is_live:
                    return Response({"error": "Test not live"}, status=status.HTTP_403_FORBIDDEN)
                if TestSubmission.objects.filter(test=test, student=request.user).exists():
                    return Response(
                        {"error": "You have already submitted this test. Re-attempts are not allowed without teacher permission."}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
            return Response(TestSerializer(test, context={'request': request}).data)
        except Test.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
            
    def delete(self, request, test_id):
        if request.user.role != 'teacher':
             return Response(status=status.HTTP_403_FORBIDDEN)
        try:
             Test.objects.get(id=test_id).delete()
             return Response(status=status.HTTP_204_NO_CONTENT)
        except Test.DoesNotExist:
             return Response(status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, test_id):
        if request.user.role != 'teacher':
             return Response(status=status.HTTP_403_FORBIDDEN)
        try:
             test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
             return Response(status=status.HTTP_404_NOT_FOUND)
        
        data = request.data
        if "name" in data:
            test.name = data["name"]
        if "duration_minutes" in data:
            test.duration_minutes = int(data["duration_minutes"])
            
        test.save()
        # Reset test attempts and submissions if the test is modified
        clear_test_results(test)
        return Response(TestSerializer(test, context={'request': request}).data)

class TestToggleLiveView(APIView):
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, test_id):
        if request.user.role != 'teacher':
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            test = Test.objects.get(id=test_id)
            new_live = not test.is_live
            if new_live:
                 Test.objects.update(is_live=False) # Only one live at a time
            test.is_live = new_live
            test.save()
            return Response({"is_live": test.is_live})
        except Test.DoesNotExist:
             return Response(status=status.HTTP_404_NOT_FOUND)

class ActiveTestConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        test = Test.objects.filter(is_live=True).first()
        if not test:
            return Response({'error': 'No active test'}, status=status.HTTP_404_NOT_FOUND)
        if request.user.role == 'student':
            if TestSubmission.objects.filter(test=test, student=request.user).exists():
                return Response(
                    {'error': 'You have already completed and submitted this test.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        return Response(TestSerializer(test).data)

class StartTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        test_id = request.data.get('test_id')
        if test_id:
            try:
                test = Test.objects.get(id=test_id)
            except Test.DoesNotExist:
                return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            test = Test.objects.filter(is_live=True).first()
            if not test:
                return Response({'error': 'No active test'}, status=status.HTTP_404_NOT_FOUND)
        
        if request.user.role == 'student':
            if not test.is_live:
                return Response({'error': 'Test is not live'}, status=status.HTTP_403_FORBIDDEN)

            # Check if the student has already SUBMITTED this test
            if TestSubmission.objects.filter(test=test, student=request.user).exists():
                return Response(
                    {'error': 'You have already completed and submitted this test. Re-attempts are not allowed without teacher permission.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if the student has already ATTEMPTED this test
            if TestAttempt.objects.filter(test=test, student=request.user).exists():
                return Response(
                    {'error': 'You have already attempted this test. Re-attempts are not allowed without teacher permission.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # First attempt: record the attempt
            TestAttempt.objects.create(test=test, student=request.user)
        
        return Response(TestSerializer(test).data)

class SubmitTestView(APIView):
    """Student submits/finishes a test. Results become visible only after this."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        test_id = request.data.get('test_id')
        if not test_id:
            # Fall back to the currently active test
            test = Test.objects.filter(is_live=True).first()
            if not test:
                return Response({'error': 'No active test'}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                test = Test.objects.get(id=test_id)
            except Test.DoesNotExist:
                return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

        if TestSubmission.objects.filter(test=test, student=request.user).exists():
            return Response({'error': 'Test already submitted.'}, status=status.HTTP_400_BAD_REQUEST)

        TestSubmission.objects.create(test=test, student=request.user)
        # Ensure attempt record also exists
        TestAttempt.objects.get_or_create(test=test, student=request.user)
        return Response({'success': True, 'message': 'Test submitted successfully.'})

    def get(self, request):
        """Return submitted and attempted test info.
        Teachers: all submissions (test_id + student roll_number).
        Students: their submitted test IDs and attempted test IDs."""
        if request.user.role == 'teacher':
            submissions = TestSubmission.objects.all().values('test_id', 'student__roll_number')
            return Response({'submissions': list(submissions)})
        else:
            submissions = list(TestSubmission.objects.filter(student=request.user).values_list('test_id', flat=True))
            attempts = list(TestAttempt.objects.filter(student=request.user).values_list('test_id', flat=True))
            return Response({
                'submitted_test_ids': submissions,
                'attempted_test_ids': attempts
            })

class SyncSubmitTestView(APIView):
    """Offline Node Backend sync endpoint for test submissions.
    
    Identifies the student by JWT token first, then falls back to
    roll_number in the request body (sent by the sync daemon).
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        import jwt
        from django.conf import settings
        from users.models import User
        
        user = None
        
        # Strategy 1: Identify student via JWT token
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
                user_id = payload.get('user_id')
                if user_id:
                    user = User.objects.get(id=user_id)
            except Exception:
                pass  # Fall through to roll_number fallback
        
        # Strategy 2: Identify student via roll_number in the request body
        if user is None:
            roll_number = request.data.get('roll_number')
            if roll_number:
                try:
                    user = User.objects.get(roll_number__iexact=str(roll_number).strip())
                except User.DoesNotExist:
                    pass
        
        if user is None:
            return Response({'error': 'Could not identify student. Provide a valid token or roll_number.'}, status=status.HTTP_401_UNAUTHORIZED)

        test_id = request.data.get('test_id')
        if not test_id:
            test = Test.objects.filter(is_live=True).first()
            if not test:
                return Response({'error': 'No active test'}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                test = Test.objects.get(id=test_id)
            except Test.DoesNotExist:
                return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

        if not TestSubmission.objects.filter(test=test, student=user).exists():
            TestSubmission.objects.create(test=test, student=user)
            
        return Response({'success': True, 'message': 'Test synced successfully.'})


# Keep old question views for backward compatibility with submission pipelines if needed
class QuestionListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        test_id = request.query_params.get('test_id')
        if test_id:
            qs = Question.objects.filter(test_id=test_id)
        else:
            qs = Question.objects.all()
        if request.user.role == 'student':
            qs = qs.filter(test__is_live=True).exclude(test__submissions__student=request.user)
        return Response(QuestionSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        if request.user.role != 'teacher':
            return Response(status=status.HTTP_403_FORBIDDEN)
            
        data = request.data
        test_id = data.get('test_id')
        if not test_id:
            return Response({"error": "test_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
            return Response({"error": "Test not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # Reset test attempts and submissions if a new question is added
        clear_test_results(test)
            
        q = Question.objects.create(
            test=test,
            marks=int(data.get("marks", 10)),
            title=data.get("title", ""),
            description=data.get("description", ""),
            input_format=data.get("input_format", ""),
            output_format=data.get("output_format", ""),
            examples=data.get("examples", []),
            constraints=data.get("constraints", "")
        )
        
        for tc in data.get("test_cases", []):
            TestCase.objects.create(question=q, input_data=tc.get("input", tc.get("input_data", "")), expected_output=tc.get("output", tc.get("expected_output", "")))
            
        for tc in data.get("hidden_test_cases", []):
            HiddenTestCase.objects.create(question=q, input_data=tc.get("input", tc.get("input_data", "")), expected_output=tc.get("output", tc.get("expected_output", "")))
            
        return Response(QuestionSerializer(q, context={'request': request}).data, status=status.HTTP_201_CREATED)

class QuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, question_id):
        try:
            q = Question.objects.get(id=question_id)
            if request.user.role == 'student':
                if not q.test.is_live:
                    return Response({"error": "Test not live"}, status=status.HTTP_403_FORBIDDEN)
                if TestSubmission.objects.filter(test=q.test, student=request.user).exists():
                    return Response(
                        {"error": "You have already submitted this test. Re-attempts are not allowed without teacher permission."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            return Response(QuestionSerializer(q, context={'request': request}).data)
        except Question.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, question_id):
        if request.user.role != 'teacher':
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            q = Question.objects.get(id=question_id)
            # Reset test attempts and submissions because the test changed
            clear_test_results(q.test)
            q.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Question.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, question_id):
        if request.user.role != 'teacher':
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        try:
            q = Question.objects.get(id=question_id)
        except Question.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        # Reset test attempts and submissions if a question is modified
        clear_test_results(q.test)
            
        data = request.data
        if "title" in data:
            q.title = data["title"]
        if "description" in data:
            q.description = data["description"]
        if "marks" in data:
            q.marks = int(data["marks"])
        q.save()
        
        # Replace test cases if provided
        if "test_cases" in data:
            q.test_cases.all().delete()
            for tc in data["test_cases"]:
                TestCase.objects.create(question=q, input_data=tc.get("input", tc.get("input_data", "")), expected_output=tc.get("output", tc.get("expected_output", "")))
                
        if "hidden_test_cases" in data:
            q.hidden_test_cases.all().delete()
            for tc in data["hidden_test_cases"]:
                HiddenTestCase.objects.create(question=q, input_data=tc.get("input", tc.get("input_data", "")), expected_output=tc.get("output", tc.get("expected_output", "")))
                
        return Response(QuestionSerializer(q, context={'request': request}).data)

class AITestCaseGeneratorView(APIView):
    permission_classes = [IsAuthenticated]

    def _run_reference_solution(self, code, input_data, timeout_s=10):
        """Run a Python reference solution against a single test case input."""
        import tempfile
        import subprocess
        import sys
        tmpdir = tempfile.mkdtemp(prefix='tc_validate_')
        try:
            src_path = os.path.join(tmpdir, 'ref_solution.py')
            with open(src_path, 'w', encoding='utf-8') as f:
                f.write(code)
            proc = subprocess.run(
                [sys.executable, src_path],
                input=str(input_data),
                capture_output=True, text=True,
                timeout=timeout_s, cwd=tmpdir,
            )
            if proc.returncode != 0:
                return None
            return proc.stdout.strip()
        except (subprocess.TimeoutExpired, Exception):
            return None
        finally:
            import shutil
            shutil.rmtree(tmpdir, ignore_errors=True)

    def _validate_test_cases(self, cases, ref_code):
        """Validate test cases by running reference solution. Returns (valid, discarded_count)."""
        if not ref_code or not ref_code.strip():
            return cases, 0

        valid = []
        discarded = 0
        for case in cases:
            inp = case.get('input', '')
            expected = str(case.get('output', '')).strip()
            actual = self._run_reference_solution(ref_code, inp)
            if actual is not None and actual == expected:
                valid.append(case)
            else:
                discarded += 1
        return valid, discarded

    def post(self, request):
        if request.user.role != "teacher":
            return Response({"error": "Only teachers can generate testcases"}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        title = data.get("title", "")
        description = data.get("description", "")
        constraints = data.get("constraints", "None provided")

        if not title or not description:
            return Response({"error": "Title and description required"}, status=status.HTTP_400_BAD_REQUEST)

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return Response({"error": "Gemini API Key not configured on the server"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        prompt = f"""You are an expert competitive programming testcase generator and problem setter.
Generate testcases, format descriptions, and a reference solution for this coding problem:
Title: {title}
Description: {description}
Constraints: {constraints}

Requirements:
1. "input_format": A clear description of how input is structured (e.g., "First line contains N. Second line contains N space-separated integers."). This guides students on how stdin will be provided to their program.
2. "output_format": A clear description of what the program should print (e.g., "Print a single integer — the maximum sum."). This guides students on what their program should output to stdout.
3. "reference_solution": A complete, correct Python solution that reads from stdin and prints to stdout. This solution MUST be fully working and produce the correct output for every test case you generate. Do NOT use any external libraries. Use only standard Python.
4. "test_cases": 2 to 5 visible test cases (examples) as objects with "input" and "output" string fields.
5. "hidden_test_cases": 10 to 30 hidden test cases that rigorously test the solution, including:
   - Edge cases (minimum/maximum possible values, empty/single elements).
   - Worst-case scenarios for TLE using maximum constraints.
   - Tricky variants (e.g., negative numbers, all duplicates, strictly increasing/decreasing).

CRITICAL: The "output" field of every test case MUST exactly match the output produced by your reference_solution when given the corresponding "input" via stdin.

Return ONLY valid JSON in this exact format:
{{
  "input_format": "...",
  "output_format": "...",
  "reference_solution": "...",
  "test_cases": [{{"input": "...", "output": "..."}}],
  "hidden_test_cases": [{{"input": "...", "output": "..."}}]
}}"""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        models_to_try = [
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite"
        ]
        
        response = None
        last_error = ""
        
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=115)
                if resp.ok:
                    response = resp
                    break
                else:
                    last_error = f"{resp.status_code} - {resp.text[:300]}"
                    continue
            except Exception as e:
                last_error = str(e)
                continue
                
        if not response:
            return Response({"error": f"LLM API error: All fallback models failed. Last error: {last_error}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        try:
            result_data = response.json()
            text_content = result_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            
            # Strip optional markdown code fence that some Gemini versions add
            import re
            cleaned_text = re.sub(r'^```(?:json)?\s*', '', text_content.strip())
            cleaned_text = re.sub(r'\s*```$', '', cleaned_text).strip()
            
            # Try to parse; if the model already returned valid JSON object directly, use it
            try:
                parsed_json = json.loads(cleaned_text)
            except json.JSONDecodeError:
                # Last resort: try to extract JSON from the raw text
                match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
                if match:
                    parsed_json = json.loads(match.group(0))
                else:
                    return Response({"error": "Could not parse JSON from AI response", "raw": cleaned_text[:500]}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Validate test cases using the reference solution
            ref_code = parsed_json.get("reference_solution", "")
            total_discarded = 0

            if ref_code:
                visible, d1 = self._validate_test_cases(parsed_json.get("test_cases", []), ref_code)
                hidden, d2 = self._validate_test_cases(parsed_json.get("hidden_test_cases", []), ref_code)
                total_discarded = d1 + d2
                parsed_json["test_cases"] = visible
                parsed_json["hidden_test_cases"] = hidden

            parsed_json["validation_info"] = {
                "discarded_count": total_discarded,
                "validated": bool(ref_code),
            }

            # Remove reference_solution from response (no need to send to frontend)
            parsed_json.pop("reference_solution", None)
            
            return Response(parsed_json)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LockdownScheduleView(APIView):
    # No permission_classes at class level; GET is public for daemon

    def get(self, request):
        from django.utils import timezone
        import threading
        from results.models import SubmittedSolution
        from results.services import trigger_email_daemon
        
        schedule = LockdownSchedule.objects.filter(is_active=True).order_by('-created_at').first()
        if not schedule:
            return Response({"schedule": None})
            
        # Autonomous daemon now handles the LLM checking and Emails
                
        return Response({
            "schedule": {
                "start_time": schedule.start_time,
                "end_time": schedule.end_time,
                "is_active": schedule.is_active
            }
        })

    def post(self, request):
        if not request.user or not request.user.is_authenticated or getattr(request.user, 'role', None) != 'teacher':
            return Response({"error": "Only teachers can set schedule"}, status=status.HTTP_403_FORBIDDEN)
        
        data = request.data
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        is_active = data.get("is_active", True)
        
        if not start_time or not end_time:
            return Response({"error": "start_time and end_time are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        schedule = LockdownSchedule.objects.create(
            start_time=start_time,
            end_time=end_time,
            is_active=is_active
        )
        
        # Deactivate old schedules
        LockdownSchedule.objects.exclude(id=schedule.id).update(is_active=False)
        
        return Response({
            "schedule": {
                "start_time": schedule.start_time,
                "end_time": schedule.end_time,
                "is_active": schedule.is_active
            }
        }, status=status.HTTP_201_CREATED)

from users.permissions import IsTeacher
from users.models import User
from .models import TestAttempt

from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class TestReattemptView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        user = request.user if request.user and request.user.is_authenticated else None
        if not user:
            auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                try:
                    import jwt
                    from django.conf import settings
                    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False})
                    user_id = payload.get('user_id')
                    if user_id:
                        user = User.objects.get(id=user_id)
                except Exception:
                    pass

        if not user or user.role != 'teacher':
            return Response({'error': 'Unauthorized. Teacher access required.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            test = Test.objects.get(id=pk)
        except Test.DoesNotExist:
            return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

        roll_numbers = []

        # Handle manual text input
        manual_rolls = request.data.get('roll_numbers', '')
        if manual_rolls:
            roll_numbers.extend([r.strip() for r in manual_rolls.split(',') if r.strip()])

        # Handle Excel file upload
        if 'file' in request.FILES:
            try:
                import openpyxl
                excel_file = request.FILES['file']
                wb = openpyxl.load_workbook(excel_file)
                ws = wb.active
                # Assuming roll numbers are in the first column
                for row in ws.iter_rows(min_row=1, max_col=1, values_only=True):
                    if row[0]:
                        roll_numbers.append(str(row[0]).strip())
            except Exception as e:
                return Response({'error': f'Failed to parse Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        if not roll_numbers:
            return Response({'error': 'No roll numbers provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from django.db.models import Q
            # Build case-insensitive query for roll numbers and usernames
            query = Q()
            for r in roll_numbers:
                r_clean = r.strip()
                query |= (Q(roll_number__iexact=r_clean) | Q(username__iexact=r_clean))
                
            users_to_reattempt = User.objects.filter(query)
            
            if not users_to_reattempt.exists():
                return Response({'error': 'No matching students found.'}, status=status.HTTP_404_NOT_FOUND)

            TestSubmission.objects.filter(test=test, student__in=users_to_reattempt).delete()
            TestAttempt.objects.filter(test=test, student__in=users_to_reattempt).delete()
            
            return Response({'success': True, 'message': f'Re-attempt granted for {users_to_reattempt.count()} students.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
