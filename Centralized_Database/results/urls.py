from django.urls import path

from .views import (
    push_result,
    get_results
)

# ── PLAGIARISM DETECTION — new view imports ───────────────────────────────────
from .views import (
    plagiarism_ingest,
    plagiarism_teacher_view,
    plagiarism_student_view,
    code_history_view,
)

urlpatterns = [

    # ── Existing endpoints (unchanged) ────────────────────────────────────────
    path('push_result/', push_result),
    path('result/', get_results),

    # ── Plagiarism detection — new endpoints only ─────────────────────────────
    path('plagiarism/ingest/', plagiarism_ingest),
    path('plagiarism/teacher/', plagiarism_teacher_view),
    path('plagiarism/student/', plagiarism_student_view),
    path('code-history/', code_history_view),
]