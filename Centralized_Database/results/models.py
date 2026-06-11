from django.db import models
from django.conf import settings


class Result(models.Model):

    STATUS_CHOICES = (
        ('accepted', 'Accepted'),
        ('partial', 'Partial'),
        ('wrong_answer', 'Wrong Answer'),
        ('runtime_error', 'Runtime Error'),
        ('time_limit_exceeded', 'Time Limit Exceeded'),
        ('memory_limit_exceeded', 'Memory Limit Exceeded'),
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='results'
    )
    roll_number = models.CharField(max_length=100)

    question_id = models.CharField(max_length=100)

    score = models.FloatField(default=0)

    passed_testcases = models.IntegerField(default=0)

    total_testcases = models.IntegerField(default=0)

    execution_time = models.FloatField(default=0)

    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES
    )

    submitted_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.username} - {self.question_id}"


# ─────────────────────────────────────────────────────────────────
# PLAGIARISM DETECTION
# ─────────────────────────────────────────────────────────────────

class SubmittedSolution(models.Model):
    """
    Raw source code submitted by a student for a question.
    Used as the ground-truth input for fingerprint generation.
    """
    roll_number = models.CharField(max_length=100)
    question_id = models.CharField(max_length=100)
    language = models.CharField(max_length=50, default='python')
    code = models.TextField()
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']
        # One record per (student, question) — replace on re-submission
        unique_together = [('roll_number', 'question_id')]

    def __str__(self):
        return f"Solution: {self.roll_number} / Q{self.question_id}"


class SolutionFingerprint(models.Model):
    """
    Compressed structural fingerprint of a submitted solution.
    Stored as a JSON list of hex-encoded n-gram hashes for fast comparison.
    """
    roll_number = models.CharField(max_length=100)
    question_id = models.CharField(max_length=100)
    language = models.CharField(max_length=50, default='python')
    # JSON array of hex strings, e.g. ["a1b2c3d4e5f60001", ...]
    fingerprint_data = models.JSONField(default=list)
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-generated_at']
        unique_together = [('roll_number', 'question_id')]

    def __str__(self):
        return f"Fingerprint: {self.roll_number} / Q{self.question_id}"


class PlagiarismDetected(models.Model):
    """
    Log of plagiarism incidents.
    flagged_student_id  — the student whose submission was compared
    copied_from_student_roll — roll number of the student they matched
    similarity_score    — Jaccard similarity (0.0–1.0)
    """
    flagged_student_id = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='plagiarism_flags',
    )
    copied_from_student_roll = models.CharField(max_length=100)
    question_id = models.CharField(max_length=100)
    similarity_score = models.FloatField()
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-detected_at']

    def __str__(self):
        return (
            f"Plagiarism: {self.flagged_student_id.roll_number} "
            f"~ {self.copied_from_student_roll} "
            f"(Q{self.question_id}, {self.similarity_score:.0%})"
        )