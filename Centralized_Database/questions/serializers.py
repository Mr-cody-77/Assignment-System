from rest_framework import serializers

from .models import (
    Question,
    TestCase,
    HiddenTestCase
)
from results.models import Result

class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = (
            "id",
            "input_data",
            "expected_output"
        )

class HiddenTestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = HiddenTestCase
        fields = (
            "id",
            "input_data",
            "expected_output"
        )

class QuestionSerializer(serializers.ModelSerializer):
    test_cases = TestCaseSerializer(
        many=True,
        read_only=True
    )

    hidden_test_cases = HiddenTestCaseSerializer(
        many=True,
        read_only=True
    )

    is_solved = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = (
            "id",
            "title",
            "description",
            "examples",
            "constraints",
            "test_cases",
            "hidden_test_cases",
            "created_at",
            "is_solved"  
        )


    def get_is_solved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:

            return Result.objects.filter(
                student=request.user, 
                question_id=str(obj.id), 
                status='accepted'
            ).exists()
        return False

class QuestionDetailSerializer(serializers.ModelSerializer):
    test_cases = TestCaseSerializer(many=True)
    hidden_test_cases = HiddenTestCaseSerializer(many=True)
    

    is_solved = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = (
            "id",
            "title",
            "description",
            "examples",
            "constraints",
            "test_cases",
            "hidden_test_cases",
            "created_at",
            "is_solved" 
        )

    def get_is_solved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Result.objects.filter(
                student=request.user, 
                question_id=str(obj.id), 
                status='accepted'
            ).exists()
        return False