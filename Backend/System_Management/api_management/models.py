from django.db import models

class CachedQuestion(models.Model):
    question_id = models.CharField(max_length=255, unique=True)
    data = models.JSONField(default=dict)
    test_cases = models.JSONField(default=list)
    hidden_test_cases = models.JSONField(default=list)
    last_updated = models.DateTimeField(auto_now=True)

class CachedTest(models.Model):
    test_id = models.CharField(max_length=255, unique=True)
    data = models.JSONField(default=dict)
    last_updated = models.DateTimeField(auto_now=True)

class PendingResult(models.Model):
    task_id = models.CharField(max_length=255, unique=True)
    payload = models.JSONField(default=dict)
    authorization = models.CharField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
