from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"

    started = False

    def ready(self):
        if UsersConfig.started:
            return

        UsersConfig.started = True

        try:
            from network import start_database_discovery
            start_database_discovery()
        except Exception as e:
            print("Network startup failed:", e)