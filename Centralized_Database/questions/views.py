import base64
import os
import requests
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import Test, Question, TestCase, HiddenTestCase, TestAttempt, TestSubmission
from .serializers import TestSerializer, QuestionSerializer

EXAM_CIPHER_KEY = "SystemSecureExamKey77!"

def xor_encrypt(plain_text, key=EXAM_CIPHER_KEY):
    encrypted = bytes(ord(c) ^ ord(key[i % len(key)]) for i, c in enumerate(plain_text))
    return base64.b64encode(encrypted).decode()

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

        admin_password = data.get("admin_password", "")
        if not admin_password:
             return Response({"error": "Admin password required"}, status=status.HTTP_400_BAD_REQUEST)

        test = Test.objects.create(
            name=data.get("name", "Unnamed Test"),
            duration_minutes=int(data.get("duration_minutes", 60)),
            admin_password=xor_encrypt(admin_password),
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
            if request.user.role == 'student' and not test.is_live:
                return Response({"error": "Test not live"}, status=status.HTTP_403_FORBIDDEN)
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
        if "admin_password" in data and data["admin_password"]:
            test.admin_password = xor_encrypt(data["admin_password"])
            
        test.save()
        # Reset test attempts if the test is modified
        TestAttempt.objects.filter(test=test).delete()
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
        return Response(TestSerializer(test).data)

class StartTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        test = Test.objects.filter(is_live=True).first()
        if not test:
            return Response({'error': 'No active test'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if the student has already attempted this test
        if TestAttempt.objects.filter(test=test, student=request.user).exists():
            return Response(
                {'error': 'You have already attempted this test.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Record the attempt
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
        return Response({'success': True, 'message': 'Test submitted successfully.'})

    def get(self, request):
        """Return submitted test info.
        Teachers: all submissions (test_id + student roll_number).
        Students: just their own submitted test IDs."""
        if request.user.role == 'teacher':
            submissions = TestSubmission.objects.all().values('test_id', 'student__roll_number')
            return Response({'submissions': list(submissions)})
        else:
            submissions = TestSubmission.objects.filter(student=request.user).values_list('test_id', flat=True)
            return Response({'submitted_test_ids': list(submissions)})

# Keep old question views for backward compatibility with submission pipelines if needed
class QuestionListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        test_id = request.query_params.get('test_id')
        if test_id:
            qs = Question.objects.filter(test_id=test_id)
        else:
             qs = Question.objects.all()
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
            
        # Reset test attempts if a new question is added
        TestAttempt.objects.filter(test=test).delete()
            
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
            return Response(QuestionSerializer(q, context={'request': request}).data)
        except Question.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, question_id):
        if request.user.role != 'teacher':
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        try:
            q = Question.objects.get(id=question_id)
        except Question.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        # Reset test attempts if a question is modified
        TestAttempt.objects.filter(test=q.test).delete()
            
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

        prompt = f"""You are an expert competitive programming testcase generator. 
Generate testcases covering a wide range of the given constraints for this coding problem:
Title: {title}
Description: {description}
Constraints: {constraints}

Requirements for Test Cases:
1. Visible Test Cases: Generate 2 to 5 standard test cases that help the student understand the problem (examples).
2. Hidden Test Cases: Generate 10 to 30 hidden test cases that rigorously test the solution. You MUST include:
   - Edge cases (minimum/maximum possible values, empty/single elements).
   - Worst-case scenarios designed to trigger Time Limit Exceeded (TLE). These MUST strictly use the absolute maximum bounds provided in the constraints.
   - Large input scenarios designed to trigger Memory Limit Exceeded (MLE) if the solution uses excessive memory, based on the maximum constraints.
   - Tricky variants (e.g., negative numbers, all duplicates, strictly increasing/decreasing) depending on the problem.

Return ONLY valid JSON in this exact format:
{{
  "test_cases": [{{"input": "...", "output": "..."}}],
  "hidden_test_cases": [{{"input": "...", "output": "..."}}]
}}"""

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        try:
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=115)
            if not response.ok:
                return Response({"error": f"LLM API error: {response.status_code} — {response.text[:300]}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
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
            
            return Response(parsed_json)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)