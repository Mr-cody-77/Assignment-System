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


# ─────────────────────────────────────────────────────────────────────────────
# PLAGIARISM DETECTION
# ─────────────────────────────────────────────────────────────────────────────

from .models import SubmittedSolution, SolutionFingerprint, PlagiarismDetected


class SolutionIngestSerializer(serializers.Serializer):
    """Validates the payload sent by the Backend Node's async pipeline."""
    roll_number = serializers.CharField()
    question_id = serializers.CharField()
    language = serializers.CharField()
    code = serializers.CharField()


class PlagiarismDetectedTeacherSerializer(serializers.ModelSerializer):
    """
    For the teacher dashboard — exposes both student roll numbers
    and the similarity score.
    """
    flagged_student_roll = serializers.CharField(
        source='flagged_student_id.roll_number'
    )

    class Meta:
        model = PlagiarismDetected
        fields = [
            'id',
            'flagged_student_roll',
            'copied_from_student_roll',
            'question_id',
            'similarity_score',
            'detected_at',
        ]


class PlagiarismDetectedStudentSerializer(serializers.ModelSerializer):
    """
    For the student dashboard — deliberately omits copied_from_student_roll
    so the student cannot identify who they matched.
    """
    flagged_student_roll = serializers.CharField(
        source='flagged_student_id.roll_number'
    )

    class Meta:
        model = PlagiarismDetected
        fields = [
            'id',
            'flagged_student_roll',
            'question_id',
            'similarity_score',
            'detected_at',
        ]
