from django.urls import path

from .views import (
    login_view,
    add_student,
    add_teacher,
    refresh_view,
    update_email,
)

urlpatterns = [
    path('login/', login_view),
    path('refresh/', refresh_view),
    path('add_student/', add_student),
    path('add_teacher/', add_teacher),
    path('update_email/', update_email),
]