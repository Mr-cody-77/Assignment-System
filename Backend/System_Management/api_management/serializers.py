from rest_framework import serializers


class TaskSubmissionSerializer(
    serializers.Serializer
):

    roll_number = serializers.CharField()

    question = serializers.JSONField()

    language = serializers.CharField()

    solution = serializers.CharField()