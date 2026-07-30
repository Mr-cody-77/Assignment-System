from django.db import models

class Test(models.Model):
    name = models.CharField(max_length=255)
    duration_minutes = models.IntegerField(default=60)
    is_live = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} (duration={self.duration_minutes}m, live={self.is_live})"

class Question(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='questions')
    marks = models.IntegerField(default=10)
    title = models.CharField(max_length=255)
    description = models.TextField()
    input_format = models.TextField(blank=True, default="")
    output_format = models.TextField(blank=True, default="")
    examples = models.JSONField(default=list)
    constraints = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class TestCase(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="test_cases")
    input_data = models.TextField()
    expected_output = models.TextField()

    def __str__(self):
        return f"TestCase {self.id}"

class HiddenTestCase(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="hidden_test_cases")
    input_data = models.TextField()
    expected_output = models.TextField()

    def __str__(self):
        return f"HiddenTestCase {self.id}"

class TestAttempt(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    student = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='test_attempts')
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('test', 'student')

    def __str__(self):
        return f"{self.student.username} attempted {self.test.name}"

class TestSubmission(models.Model):
    """Tracks when a student formally submits/finishes a test.
    Results are only visible after a TestSubmission record exists."""
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='test_submissions')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('test', 'student')

    def __str__(self):
        return f"{self.student.username} submitted {self.test.name}"

class LockdownSchedule(models.Model):
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    emails_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Lockdown from {self.start_time} to {self.end_time} (Active: {self.is_active})"