from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"

    started = False

    def ready(self):
        import sys
        import os

        # Only advertise database service if this process is running the actual web server
        is_runserver = "runserver" in sys.argv
        if is_runserver and os.environ.get("RUN_MAIN") != "true":
            # Reloader parent process - do not start broadcaster
            return

        # Do not start discovery from background daemons (like central_db_daemon), migrations, tests, etc.
        if not is_runserver and not os.environ.get("START_DB_DISCOVERY"):
            return

        if UsersConfig.started:
            return

        UsersConfig.started = True

        try:
            from network import start_database_discovery
            start_database_discovery()
        except Exception as e:
            print("Network startup failed:", e)