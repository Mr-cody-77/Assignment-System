from rest_framework import serializers
from .models import Test, Question, TestCase, HiddenTestCase
from results.models import Result

class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = ("id", "input_data", "expected_output")

class HiddenTestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = HiddenTestCase
        fields = ("id", "input_data", "expected_output")

class QuestionSerializer(serializers.ModelSerializer):
    test_cases = TestCaseSerializer(many=True, read_only=True)
    hidden_test_cases = HiddenTestCaseSerializer(many=True, read_only=True)
    is_solved = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = (
            "id", "test", "marks", "title", "description", 
            "input_format", "output_format", "examples", 
            "constraints", "test_cases", "hidden_test_cases", 
            "created_at", "is_solved"
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

class TestSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Test
        fields = (
            'id', 'name', 'duration_minutes', 'admin_password', 
            'is_live', 'created_by', 'created_at', 'updated_at', 'questions'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')