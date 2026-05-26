from rest_framework import serializers

from .models import (
    Question,
    TestCase,
    HiddenTestCase
)
# IMPORT YOUR RESULT MODEL HERE
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

    # --- 1. ADD THIS FIELD ---
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
            "is_solved"  # --- 2. ADD TO FIELDS ---
        )

    # --- 3. ADD THIS FUNCTION ---
    def get_is_solved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Check if the user has an 'accepted' result for this question
            return Result.objects.filter(
                student=request.user, 
                question_id=str(obj.id), 
                status='accepted'
            ).exists()
        return False

class QuestionDetailSerializer(serializers.ModelSerializer):
    test_cases = TestCaseSerializer(many=True)
    hidden_test_cases = HiddenTestCaseSerializer(many=True)
    
    # --- 4. ADD TO DETAIL SERIALIZER AS WELL ---
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
            "is_solved" # --- ADD TO FIELDS ---
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