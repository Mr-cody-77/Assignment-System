from django.contrib.auth.hashers import make_password
from .models import User


def create_teacher(username: str, password: str):

    if User.objects.filter(username=username).exists():
        return None

    teacher = User.objects.create(
        username=username,
        password=make_password(password),
        role='teacher'
    )

    return teacher


def create_student(roll_number: str):

    if User.objects.filter(username=roll_number).exists():
        return None

    student = User.objects.create(
        username=roll_number,
        roll_number=roll_number,
        password=make_password(roll_number),
        role='student'
    )

    return student