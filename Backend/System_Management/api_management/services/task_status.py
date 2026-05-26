from rest_framework.views import APIView
from rest_framework.response import Response

from Services.Sender_Server.state import tasks, lock


class TaskStatusView(APIView):

    def get(self, request):

        with lock:

            all_tasks = list(
                tasks.values()
            )

        return Response(
            all_tasks
        )