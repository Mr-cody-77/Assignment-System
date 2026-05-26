from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = (
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='student'
    )

    roll_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
    )

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = 'teacher'

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"