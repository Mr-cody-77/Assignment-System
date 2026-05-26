from django.urls import path

from .views import (
    login_view,
    add_student,
    add_teacher,
    refresh_view,
)

urlpatterns = [
    path('login/', login_view),
    path('refresh/', refresh_view),
    path('add_student/', add_student),
    path('add_teacher/', add_teacher),
]