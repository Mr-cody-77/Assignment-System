import os
import subprocess
import sys
import time

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Paths
    venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    backend_dir = os.path.join(base_dir, "Backend", "System_Management")
    frontend_dir = os.path.join(base_dir, "Frontend", "system_interface")
    
    if not os.path.exists(venv_python):
        venv_python = "python"  # fallback to system python
        
    print("Starting Assignment System...")
    
    # Run Updater
    updater_path = os.path.join(base_dir, "updater.bat")
    if os.path.exists(updater_path):
        print("Checking for auto-updates (this may take a moment)...")
        if sys.platform == "win32":
            subprocess.run([updater_path], shell=True, creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            subprocess.run([updater_path], shell=True)
    
    # Start Backend silently in the background
    print("Starting Backend (Port 8000)...")
    backend_log = open(os.path.join(base_dir, "backend.log"), "a")
    if sys.platform == "win32":
        subprocess.Popen(
            [venv_python, "manage.py", "runserver", "0.0.0.0:8000"],
            cwd=backend_dir,
            stdout=backend_log,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
    else:
        subprocess.Popen(
            [venv_python, "manage.py", "runserver", "0.0.0.0:8000"],
            cwd=backend_dir,
            stdout=backend_log,
            stderr=subprocess.STDOUT
        )
    
    # Start Frontend silently in the background
    if os.path.exists(frontend_dir):
        print("Starting Frontend (Port 3000)...")
        frontend_log = open(os.path.join(base_dir, "frontend.log"), "a")
        if sys.platform == "win32":
            subprocess.Popen(
                "npm start",
                cwd=frontend_dir,
                stdout=frontend_log,
                stderr=subprocess.STDOUT,
                shell=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            subprocess.Popen(
                "npm start",
                cwd=frontend_dir,
                stdout=frontend_log,
                stderr=subprocess.STDOUT,
                shell=True
            )

if __name__ == "__main__":
    main()
