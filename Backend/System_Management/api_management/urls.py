from django.urls import path


from .views import TaskSubmissionView, TaskStatusView
from .views import LoadView, TaskTokenView, AcceptedTaskView, TaskResultView, NodeInfoView, LocalRunView
from .views import LockdownLockView, LockdownUnlockView, LockdownStatusView

urlpatterns = [

    path("task/",TaskSubmissionView.as_view(),name="task-submit"),
    path("task_status/",TaskStatusView.as_view()),

    path("get-load/",LoadView.as_view(),name="load"),
    path("task_token/", TaskTokenView.as_view(), name="task_token"),

    path("accepted_task/",AcceptedTaskView.as_view(),name="accepted_task"),
    path("task_result/", TaskResultView.as_view(), name="task_result"),
    path("node_info/", NodeInfoView.as_view(), name="node_info"),
    path("local-run/", LocalRunView.as_view(), name="local_run"),

    # Exam lockdown endpoints
    path("lockdown/lock/", LockdownLockView.as_view(), name="lockdown-lock"),
    path("lockdown/unlock/", LockdownUnlockView.as_view(), name="lockdown-unlock"),
    path("lockdown/status/", LockdownStatusView.as_view(), name="lockdown-status"),

]