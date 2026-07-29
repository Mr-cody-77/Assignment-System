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
        subprocess.run([updater_path], shell=True)
    
    # Start Backend in a new window
    print("Starting Backend (Port 8000)...")
    subprocess.Popen(
        f'start "Assignment System - Backend" cmd /k "{venv_python} manage.py runserver 0.0.0.0:8000"',
        cwd=backend_dir,
        shell=True
    )
    
    # Start Frontend in a new window
    if os.path.exists(frontend_dir):
        print("Starting Frontend (Port 3000)...")
        subprocess.Popen(
            'start "Assignment System - Frontend" cmd /k "npm start"',
            cwd=frontend_dir,
            shell=True
        )

if __name__ == "__main__":
    main()
