from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import (
    Question,
    TestCase,
    HiddenTestCase
)

from .serializers import (
    QuestionSerializer,
    QuestionDetailSerializer
)


class CreateQuestionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        if request.user.role != "teacher":
            return Response(
                {"error": "Only teachers can create questions"},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data

        question = Question.objects.create(
            title=data["title"],
            description=data["description"],
            examples=data.get("examples", []),
            constraints=data["constraints"]
        )

        for tc in data.get("test_cases", []):
            TestCase.objects.create(
                question=question,
                input_data=tc["input"],
                expected_output=tc["output"]
            )

        for tc in data.get("hidden_test_cases", []):
            HiddenTestCase.objects.create(
                question=question,
                input_data=tc["input"],
                expected_output=tc["output"]
            )

        return Response(
            {
                "message": "Question created",
                "question_id": question.id
            },
            status=status.HTTP_201_CREATED
        )


class QuestionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        questions = Question.objects.all()

        # --- MODIFIED HERE: Added context={'request': request} ---
        serializer = QuestionSerializer(
            questions,
            many=True,
            context={'request': request}
        )

        return Response(serializer.data)


class QuestionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, question_id):
        try:
            question = Question.objects.get(
                id=question_id
            )
        except Question.DoesNotExist:
            return Response(
                {"error": "Question not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # --- MODIFIED HERE: Used DetailSerializer and added context ---
        serializer = QuestionDetailSerializer(
            question,
            context={'request': request}
        )

        return Response(serializer.data)