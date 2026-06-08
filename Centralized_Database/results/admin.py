from django.contrib import admin

from .models import Result


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'student',
        'roll_number',
        'question_id',
        'score',
        'status',
        'submitted_at',
    )

    search_fields = (
        'roll_number',
        'question_id',
        'student__username',
    )

    list_filter = (
        'status',
        'submitted_at',
    )


# ─────────────────────────────────────────────────────────────────────────────
# PLAGIARISM DETECTION — New admin registrations (ResultAdmin unchanged above)
# ─────────────────────────────────────────────────────────────────────────────

from .models import SubmittedSolution, SolutionFingerprint, PlagiarismDetected


@admin.register(SubmittedSolution)
class SubmittedSolutionAdmin(admin.ModelAdmin):
    list_display = ('id', 'roll_number', 'question_id', 'language', 'submitted_at')
    search_fields = ('roll_number', 'question_id')
    list_filter = ('language', 'submitted_at')


@admin.register(SolutionFingerprint)
class SolutionFingerprintAdmin(admin.ModelAdmin):
    list_display = ('id', 'roll_number', 'question_id', 'language', 'generated_at')
    search_fields = ('roll_number', 'question_id')
    list_filter = ('language',)


@admin.register(PlagiarismDetected)
class PlagiarismDetectedAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'flagged_student_id',
        'copied_from_student_roll',
        'question_id',
        'similarity_score',
        'detected_at',
    )
    search_fields = (
        'flagged_student_id__roll_number',
        'copied_from_student_roll',
        'question_id',
    )
    list_filter = ('question_id', 'detected_at')