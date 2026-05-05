import threading
from task_manager import start_task_manager
from system_monitor import system_monitor


def main():
    threading.Thread(target=system_monitor, daemon=True).start()

    start_task_manager()

    threading.Event().wait()


if __name__ == "__main__":
    main()