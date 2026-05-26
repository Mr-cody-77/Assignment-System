from rest_framework.decorators import (
    api_view,
    permission_classes
)

from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework.response import Response

from users.permissions import (
    IsTeacher,
    IsStudent
)

from .serializers import (
    PushResultSerializer,
    ResultSerializer
)

from .services import store_result
from .models import Result
from users.models import User

@api_view(['POST'])
@permission_classes([AllowAny])
def push_result(request):
    serializer = PushResultSerializer(data=request.data)

    if not serializer.is_valid():
        print(serializer.errors)
        return Response(serializer.errors, status=400)

    data = serializer.validated_data

    try:
        student = User.objects.get(roll_number=data["roll_number"])
    except User.DoesNotExist:
        return Response({
            "success": False,
            "message": "Student not found"
        }, status=404)

    result = store_result(student, data)

    return Response({
        "success": True,
        "result_id": result.id
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_results(request):

    roll_number = request.data.get('roll_number')

    # Teacher -> can see everything
    if request.user.role == 'teacher':

        if roll_number:
            queryset = Result.objects.filter(roll_number=roll_number)
        else:
            queryset = Result.objects.all()

    # Student -> only own results
    else:

        if roll_number != request.user.roll_number:
            return Response(
                {
                    "success": False,
                    "message": "You can only view your own results"
                },
                status=403
            )

        queryset = Result.objects.filter(
            student=request.user
        )

    serializer = ResultSerializer(
        queryset,
        many=True
    )

    return Response(serializer.data)
