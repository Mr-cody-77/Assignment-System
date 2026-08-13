from django.urls import path
from .views import (
    CreateTestView, TestListView, TestDetailView, TestToggleLiveView, ActiveTestConfigView,
    StartTestView, SubmitTestView, SyncSubmitTestView, QuestionListView, QuestionDetailView, AITestCaseGeneratorView,
    LockdownScheduleView, TestReattemptView
)

urlpatterns = [
    # Test endpoints
    path('tests/', TestListView.as_view(), name='test-list'),
    path('tests/create/', CreateTestView.as_view(), name='test-create'),
    path('tests/active/', ActiveTestConfigView.as_view(), name='test-active'),
    path('tests/start/', StartTestView.as_view(), name='test-start'),
    path('tests/submit/', SubmitTestView.as_view(), name='test-submit'),
    path('tests/sync_submit/', SyncSubmitTestView.as_view(), name='test-sync-submit'),
    path('tests/<int:test_id>/', TestDetailView.as_view(), name='test-detail'),
    path('tests/<int:test_id>/toggle-live/', TestToggleLiveView.as_view(), name='test-toggle'),
    path('tests/<int:pk>/grant_reattempt/', TestReattemptView.as_view(), name='test-grant-reattempt'),
    
    # Question endpoints
    path('questions/', QuestionListView.as_view(), name='question-list'),
    path('questions/<int:question_id>/', QuestionDetailView.as_view(), name='question-detail'),
    
    # Legacy alias for older student laptops that haven't updated their frontend code
    path('questions/start_test/', StartTestView.as_view(), name='test-start-legacy'),

    path('ai/generate/', AITestCaseGeneratorView.as_view(), name='ai-generate'),
    path('schedule/', LockdownScheduleView.as_view(), name='schedule'),
]