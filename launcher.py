import os
import subprocess
import sys
import time

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Paths
    if sys.platform == "win32":
        venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    else:
        venv_python = os.path.join(base_dir, ".venv", "bin", "python")
        
    backend_dir = os.path.join(base_dir, "Backend", "System_Management")
    frontend_dir = os.path.join(base_dir, "Frontend", "system_interface")
    
    if not os.path.exists(venv_python):
        venv_python = "python3" if sys.platform != "win32" else "python"  # fallback
        
    print("Starting Assignment System...")
    
    # Run Updater
    updater_path = os.path.join(base_dir, "updater.bat")
    if os.path.exists(updater_path):
        print("Checking for auto-updates (this may take a moment)...")
        if sys.platform == "win32":
            subprocess.run([updater_path], shell=True, creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            subprocess.run([updater_path], shell=True)
    
    # 1. Start Node Backend (System_Management) on Port 8000
    print("Starting Node Backend (Port 8000)...")
    node_log = open(os.path.join(base_dir, "node_backend.log"), "a")
    
    # Set NODE_PORT environment variable for the backend
    backend_env = os.environ.copy()
    backend_env["NODE_PORT"] = "8000"
    
    if sys.platform == "win32":
        subprocess.Popen(
            [venv_python, "manage.py", "runserver", "0.0.0.0:8000"],
            cwd=backend_dir,
            stdout=node_log,
            stderr=subprocess.STDOUT,
            env=backend_env,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
    else:
        subprocess.Popen(
            [venv_python, "manage.py", "runserver", "0.0.0.0:8000"],
            cwd=backend_dir,
            stdout=node_log,
            stderr=subprocess.STDOUT,
            env=backend_env
        )

    # 2. Start Frontend (React)
    if os.path.exists(frontend_dir):
        print("Starting Frontend (React)...")
        # Ensure React .env is configured correctly for the Node Backend
        with open(os.path.join(frontend_dir, '.env'), 'w') as f:
            f.write("REACT_APP_NODE_PORT=8000\n")
            f.write("PORT=3000\n")
            
        frontend_log = open(os.path.join(base_dir, "frontend.log"), "a")
        
        # Inject our CRA Webpack bug fixes into the environment
        react_env = os.environ.copy()
        react_env["ALLOWED_HOSTS"] = "localhost"
        react_env["HOST"] = "localhost"
        react_env["DANGEROUSLY_DISABLE_HOST_CHECK"] = "true"
        if sys.platform == "win32":
            subprocess.Popen(
                "npm start",
                cwd=frontend_dir,
                stdout=frontend_log,
                stderr=subprocess.STDOUT,
                env=react_env,
                shell=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            subprocess.Popen(
                "npm start",
                cwd=frontend_dir,
                stdout=frontend_log,
                stderr=subprocess.STDOUT,
                env=react_env,
                shell=True
            )

if __name__ == "__main__":
    main()
