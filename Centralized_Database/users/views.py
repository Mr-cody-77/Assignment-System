from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    LoginSerializer,
    AddStudentSerializer,
    AddTeacherSerializer,
)

from .permissions import IsTeacher
from .services import create_student, create_teacher

from django.http import JsonResponse
import json
from rest_framework_simplejwt.exceptions import TokenError

@api_view(['POST'])
def login_view(request):
    serializer = LoginSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = serializer.validated_data['username']
    password = serializer.validated_data['password']


    user = authenticate(
        username=username,
        password=password,
    )

    if not user:
        return Response({
            'authenticated': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)

    return Response({
        'authenticated': True,
        'role': user.role,
        'username': user.username,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })

@api_view(['POST'])
def refresh_view(request):

    try:
        body = json.loads(request.body)

        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return JsonResponse(
                {"detail": "Refresh token required"},
                status=400
            )

        token = RefreshToken(refresh_token)

        return JsonResponse({
            "access": str(token.access_token)
        })

    except TokenError:
        return JsonResponse(
            {"detail": "Invalid refresh token"},
            status=401
        )

    except Exception as e:
        return JsonResponse(
            {"detail": str(e)},
            status=400
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacher])
def add_teacher(request):

    serializer = AddTeacherSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=400
        )

    teacher = create_teacher(
        serializer.validated_data["username"],
        serializer.validated_data["password"]
    )

    if teacher is None:
        return Response({
            "success": False,
            "message": "Teacher already exists"
        })

    return Response({
        "success": True,
        "username": teacher.username,
        "role": teacher.role
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacher])
def add_student(request):

    serializer = AddStudentSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=400
        )

    student = create_student(
        serializer.validated_data["roll_number"]
    )

    if student is None:
        return Response({
            "success": False,
            "message": "Student already exists"
        })

    return Response({
        "success": True,
        "username": student.username,
        "password": student.username
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_email(request):
    email = request.data.get('email')
    if not email:
        return Response({"detail": "Email is required"}, status=400)
    
    user = request.user
    user.email = email
    user.save()
    
    return Response({"success": True, "email": user.email})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not old_password or not new_password:
        return Response({"detail": "old_password and new_password are required"}, status=400)
        
    user = request.user
    if not user.check_password(old_password):
        return Response({"detail": "Incorrect old password"}, status=400)
        
    user.set_password(new_password)
    user.save()
    
    return Response({"success": True, "message": "Password updated successfully"})
