# Plagiarism Detection — new tables only.
# No existing table or column is altered.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        # Must come after the last existing migration
        ('results', '0002_result_roll_number'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [

        # ── Table 1: submitted_solutions ─────────────────────────────────
        migrations.CreateModel(
            name='SubmittedSolution',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('roll_number', models.CharField(max_length=100)),
                ('question_id', models.CharField(max_length=100)),
                ('language', models.CharField(default='python', max_length=50)),
                ('code', models.TextField()),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-submitted_at'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='submittedsolution',
            unique_together={('roll_number', 'question_id')},
        ),

        # ── Table 2: solution_fingerprints ───────────────────────────────
        migrations.CreateModel(
            name='SolutionFingerprint',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('roll_number', models.CharField(max_length=100)),
                ('question_id', models.CharField(max_length=100)),
                ('language', models.CharField(default='python', max_length=50)),
                ('fingerprint_data', models.JSONField(default=list)),
                ('generated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['-generated_at'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='solutionfingerprint',
            unique_together={('roll_number', 'question_id')},
        ),

        # ── Table 3: plagiarism_detected ─────────────────────────────────
        migrations.CreateModel(
            name='PlagiarismDetected',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'flagged_student_id',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='plagiarism_flags',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ('copied_from_student_roll', models.CharField(max_length=100)),
                ('question_id', models.CharField(max_length=100)),
                ('similarity_score', models.FloatField()),
                ('detected_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-detected_at'],
            },
        ),
    ]
