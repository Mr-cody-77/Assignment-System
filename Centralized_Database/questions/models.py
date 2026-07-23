from django.db import models


class Question(models.Model):
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
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="test_cases"
    )

    input_data = models.TextField()

    expected_output = models.TextField()

    def __str__(self):
        return f"TestCase {self.id}"


class HiddenTestCase(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="hidden_test_cases"
    )

    input_data = models.TextField()

    expected_output = models.TextField()

    def __str__(self):
        return f"HiddenTestCase {self.id}"