from django.contrib.auth import get_user_model

User = get_user_model()


class CaseInsensitiveBackend:
    """Authenticate using case-insensitive username lookup."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            return None
        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            return None

        if user.check_password(password):
            return user
        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
