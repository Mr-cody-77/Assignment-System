"""
launcher.py — PyInstaller-compatible one-click launcher.
Starts all CodeLab services and opens the browser.
Can be compiled to a standalone .exe using PyInstaller.

Build:  pyinstaller launcher.spec
"""

import sys
import os
import subprocess
import threading
import time
import webbrowser
import socket
import logging
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    # Running as PyInstaller bundle
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).resolve().parent

BACKEND_DIR  = BASE_DIR / 'Backend' / 'System_Management'
SERVICES_DIR = BASE_DIR / 'Services'
LOGS_DIR     = BASE_DIR / 'logs'
VENV_PYTHON  = BASE_DIR / 'venv' / 'Scripts' / 'python.exe'

# Use bundled or venv Python
PYTHON = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

LOGS_DIR.mkdir(exist_ok=True)

# ─── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [Launcher] %(levelname)s %(message)s',
    handlers=[
        logging.FileHandler(LOGS_DIR / 'launcher.log'),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger('launcher')

# ─── Running processes ────────────────────────────────────────
_processes: list[subprocess.Popen] = []


def start_process(name: str, cmd: list, cwd: str, log_file: str) -> subprocess.Popen:
    """Start a background process and track it."""
    log_path = LOGS_DIR / log_file
    with open(log_path, 'a') as lf:
        proc = subprocess.Popen(
            cmd, cwd=cwd,
            stdout=lf, stderr=lf,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
    _processes.append(proc)
    log.info(f"Started {name} (PID {proc.pid})")
    return proc


def wait_for_port(port: int, host: str = 'localhost', timeout: float = 30) -> bool:
    """Block until a port is open, or timeout."""
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except (ConnectionRefusedError, OSError):
            time.sleep(0.5)
    return False


def start_postgresql():
    """Attempt to start PostgreSQL service on Windows."""
    if sys.platform != 'win32':
        return
    for svc in ['postgresql-x64-16', 'postgresql-x64-15', 'postgresql']:
        result = subprocess.run(['sc', 'query', svc], capture_output=True)
        if result.returncode == 0:
            subprocess.run(['sc', 'start', svc], capture_output=True)
            log.info(f"Started PostgreSQL service: {svc}")
            time.sleep(3)
            return
    log.warning("PostgreSQL service not found — assuming it is already running.")


def run_migrations():
    """Run Django database migrations."""
    log.info("Running migrations...")
    result = subprocess.run(
        [PYTHON, 'manage.py', 'migrate', '--run-syncdb'],
        cwd=str(BACKEND_DIR),
        capture_output=True, text=True
    )
    if result.returncode != 0:
        log.error(f"Migration failed: {result.stderr}")
    else:
        log.info("Migrations applied successfully.")

    # Collect static files
    subprocess.run(
        [PYTHON, 'manage.py', 'collectstatic', '--noinput'],
        cwd=str(BACKEND_DIR), capture_output=True
    )


def start_django():
    """Start Django via waitress (Windows-compatible WSGI server)."""
    return start_process(
        'Django Backend',
        [PYTHON, '-m', 'waitress', '--listen=0.0.0.0:8000', 'System_Management.wsgi:application'],
        cwd=str(BACKEND_DIR),
        log_file='django.log'
    )


def start_discovery():
    """Start Zeroconf node discovery service."""
    return start_process(
        'Zeroconf Discovery',
        [PYTHON, 'discovery_service.py'],
        cwd=str(SERVICES_DIR),
        log_file='discovery.log'
    )


def start_sender():
    """Start the task dispatcher (Sender Server)."""
    sender = SERVICES_DIR / 'Sender_Server'
    return start_process(
        'Task Dispatcher',
        [PYTHON, 'main.py'],
        cwd=str(sender),
        log_file='sender.log'
    )


def start_worker():
    """Start the worker execution engine (Receiver Server)."""
    receiver = SERVICES_DIR / 'Receiver_Server'
    return start_process(
        'Worker Engine',
        [PYTHON, 'main.py'],
        cwd=str(receiver),
        log_file='receiver.log'
    )


def open_browser():
    """Open the web browser after Django is ready."""
    log.info("Waiting for Django to be ready...")
    if wait_for_port(8000, timeout=30):
        log.info("Django ready. Opening browser...")
        webbrowser.open('http://localhost:8000')
    else:
        log.warning("Django did not start in time. Open http://localhost:8000 manually.")


def monitor_processes():
    """Watch processes and restart if they crash."""
    while True:
        time.sleep(10)
        for proc in list(_processes):
            if proc.poll() is not None:
                log.warning(f"Process {proc.pid} exited with code {proc.returncode}")
                _processes.remove(proc)


def stop_all():
    """Gracefully stop all managed processes."""
    log.info("Shutting down all services...")
    for proc in _processes:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
    log.info("All services stopped.")


def main():
    log.info("=" * 55)
    log.info("  CodeLab Assignment System — Launcher")
    log.info(f"  Base: {BASE_DIR}")
    log.info("=" * 55)

    try:
        # 1. Start PostgreSQL
        log.info("[1/5] Starting PostgreSQL...")
        start_postgresql()

        # 2. Run migrations
        log.info("[2/5] Running migrations...")
        run_migrations()

        # 3. Start Django backend
        log.info("[3/5] Starting Django backend...")
        start_django()

        # 4. Start services
        log.info("[4/5] Starting discovery, dispatcher, and worker services...")
        start_discovery()
        time.sleep(1)
        start_sender()
        time.sleep(1)
        start_worker()

        # 5. Open browser
        log.info("[5/5] Opening browser...")
        threading.Thread(target=open_browser, daemon=True).start()

        # Monitor processes
        log.info("All services running. Monitoring...")
        threading.Thread(target=monitor_processes, daemon=True).start()

        # Keep launcher alive
        while True:
            time.sleep(60)

    except KeyboardInterrupt:
        stop_all()
    except Exception as e:
        log.exception(f"Launcher error: {e}")
        stop_all()
        sys.exit(1)


if __name__ == '__main__':
    main()
