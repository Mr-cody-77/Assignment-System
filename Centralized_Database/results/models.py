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