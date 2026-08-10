import os
import subprocess
import sys
import time
import threading
import socket
import tkinter as tk
from tkinter import ttk
import psutil

def kill_processes_on_ports(ports):
    print(f"Checking for existing processes on ports: {ports}")
    for conn in psutil.net_connections(kind='inet'):
        if conn.laddr.port in ports:
            try:
                process = psutil.Process(conn.pid)
                print(f"Killing process {process.pid} ({process.name()}) on port {conn.laddr.port}")
                process.terminate()
                process.wait(timeout=3)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired, AttributeError):
                pass

def wait_for_port(port, timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        for host in ("localhost", "127.0.0.1", "0.0.0.0"):
            try:
                with socket.create_connection((host, port), timeout=0.5):
                    return True
            except (ConnectionRefusedError, socket.timeout, OSError):
                continue
        time.sleep(1)
    return False

def update_status(root, status_label, text):
    if root and status_label:
        root.after(0, lambda: status_label.config(text=text))

def start_servers(root, status_label, base_dir):
    kill_processes_on_ports([3000, 8000])

    # Paths
    if sys.platform == "win32":
        venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    else:
        venv_python = os.path.join(base_dir, ".venv", "bin", "python")
        
    backend_dir = os.path.join(base_dir, "Backend", "System_Management")
    frontend_dir = os.path.join(base_dir, "Frontend", "system_interface")
    
    if not os.path.exists(venv_python):
        venv_python = "python3" if sys.platform != "win32" else "python"  # fallback

    # Run Updater
    updater_path = os.path.join(base_dir, "auto_updater.py")
    if os.path.exists(updater_path):
        update_status(root, status_label, "Checking for updates...")
        print("Checking for auto-updates (this may take a moment)...")
        if sys.platform == "win32":
            subprocess.run([venv_python, updater_path, "--fast"], creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            subprocess.run([venv_python, updater_path, "--fast"])
    
    # 1. Start Node Backend (System_Management) on Port 8000
    update_status(root, status_label, "Starting backend server...")
    print("Starting Node Backend (Port 8000)...")
    node_log = open(os.path.join(base_dir, "node_backend.log"), "a")
    
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
            env=backend_env,
            start_new_session=True
        )

    # 2. Start Frontend (React)
    if os.path.exists(frontend_dir):
        update_status(root, status_label, "Starting frontend interface...")
        print("Starting Frontend (React)...")
        with open(os.path.join(frontend_dir, '.env'), 'w') as f:
            f.write("REACT_APP_NODE_PORT=8000\n")
            f.write("PORT=3000\n")
            
        frontend_log = open(os.path.join(base_dir, "frontend.log"), "a")
        
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
                shell=True,
                start_new_session=True
            )

    # Wait for the backend and frontend to be fully ready
    update_status(root, status_label, "Waiting for services to be ready...")
    
    # Wait up to 60 seconds for both ports to open
    wait_for_port(8000, timeout=60)
    wait_for_port(3000, timeout=60)
    
    update_status(root, status_label, "Ready! Opening browser...")
    time.sleep(2)  # Give browser a second to launch
    
    # Safely close the UI window
    if root:
        root.after(0, root.destroy)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Setup Tkinter Loading Screen
    root = tk.Tk()
    root.title("Assignment System")
    
    # Make it frameless and keep it on top during loading
    root.overrideredirect(True)
    root.attributes("-topmost", True)
    
    # Dimensions and centering
    window_width = 400
    window_height = 160
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    x_cord = int((screen_width/2) - (window_width/2))
    y_cord = int((screen_height/2) - (window_height/2))
    root.geometry(f"{window_width}x{window_height}+{x_cord}+{y_cord}")
    
    # Styling (Modern Dark Mode)
    bg_color = '#1e1e2e'
    accent_color = '#89b4fa'
    text_color = '#cdd6f4'
    sub_text_color = '#a6adc8'
    
    root.configure(bg=bg_color)
    
    border_frame = tk.Frame(root, bg=accent_color, bd=0)
    border_frame.pack(fill="both", expand=True, padx=2, pady=2)
    
    inner_frame = tk.Frame(border_frame, bg=bg_color)
    inner_frame.pack(fill="both", expand=True)
    
    title_label = tk.Label(inner_frame, text="Assignment System", font=("Segoe UI", 16, "bold"), bg=bg_color, fg=text_color)
    title_label.pack(pady=(25, 10))
    
    status_label = tk.Label(inner_frame, text="Starting servers...", font=("Segoe UI", 10), bg=bg_color, fg=sub_text_color)
    status_label.pack(pady=(0, 20))
    
    style = ttk.Style()
    if sys.platform == "win32":
        try:
            style.theme_use('clam')
        except:
            pass
    
    style.configure("Custom.Horizontal.TProgressbar", thickness=6, background=accent_color, troughcolor='#313244', bordercolor=bg_color, lightcolor=accent_color, darkcolor=accent_color)
    
    progress = ttk.Progressbar(inner_frame, style="Custom.Horizontal.TProgressbar", orient="horizontal", length=300, mode="indeterminate")
    progress.pack()
    progress.start(15)
    
    # Start the server logic in a background thread
    server_thread = threading.Thread(target=start_servers, args=(root, status_label, base_dir))
    server_thread.daemon = True
    server_thread.start()
    
    # Start the GUI event loop
    root.mainloop()

if __name__ == "__main__":
    main()
