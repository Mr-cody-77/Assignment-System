from rest_framework import serializers
from .models import Result

class PushResultSerializer(serializers.Serializer):
    roll_number = serializers.CharField()
    question_id = serializers.CharField()
    status = serializers.CharField()
    score = serializers.FloatField(default=0)
    
    # --- MODIFIED HERE: Match exactly what the Worker sends ---
    passed_testcases = serializers.IntegerField(default=0)
    total_testcases = serializers.IntegerField(default=0)
    execution_time = serializers.FloatField(default=0)
    # ----------------------------------------------------------

    # (You can keep these if you use them elsewhere, otherwise they are optional)
    execution_node = serializers.CharField(required=False)
    results = serializers.ListField(required=False)
    logs = serializers.ListField(required=False)


class ResultSerializer(serializers.ModelSerializer):
    student = serializers.CharField(
        source='student.username'
    )

    class Meta:
        model = Result
        fields = [
            'id',
            'student',
            'roll_number',
            'question_id',
            'score',
            'passed_testcases',
            'total_testcases',
            'execution_time',
            'status',
            'submitted_at',
        ]