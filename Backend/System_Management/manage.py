#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys
import threading

from Services.Sender_Server.dispatcher import start_dispatcher


def main():

    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE",
        "System_Management.settings",
    )

    try:

        from django.core.management import (
            execute_from_command_line,
        )

    except ImportError as exc:

        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    if os.environ.get("RUN_MAIN") == "true":

        from Services.Sender_Server.network import (
            start_discovery,
        )

        from Services.Receiver_Server.system_monitor import (
            system_monitor,
        )

        # start_discovery()

        threading.Thread(
            target=system_monitor,
            daemon=True,
            name="system-monitor",
        ).start()

        threading.Thread(
            target=start_dispatcher,
            daemon=True,
            name="dispatcher",
        ).start()

    execute_from_command_line(
        sys.argv,
    )


if __name__ == "__main__":
    main()