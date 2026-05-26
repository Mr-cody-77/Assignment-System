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