from django.urls import path

from .views import (
    CreateQuestionView,
    QuestionListView,
    QuestionDetailView
)

urlpatterns = [
    path("",QuestionListView.as_view(),name="question-list"),
    path("create/",CreateQuestionView.as_view(),name="create-question"),
    path("<int:question_id>/",QuestionDetailView.as_view(),name="question-detail"),
]