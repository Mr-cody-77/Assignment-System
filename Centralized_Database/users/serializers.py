from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

class AddTeacherSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

class AddStudentSerializer(serializers.Serializer):
    roll_number = serializers.CharField()