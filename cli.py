import argparse
import subprocess
import os
import sys
import time

# --- CONFIGURATION (Change these to match your exact folder names) ---


FRONTEND_DIR = os.path.join("Frontend", "system_interface")  
ASSIGNMENT_NODE_DIR = os.path.join("Backend", "System_Management") # <--- UPDATED THIS LINE
DB_SERVER_DIR = "Centralized_Database"     # Path to your Django Central DB Server
# ---------------------------------------------------------------------

processes = []

def get_python_executable():
    """Returns the virtual environment Python executable if it exists, otherwise falls back to sys.executable."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe") if os.name == 'nt' else os.path.join(base_dir, ".venv", "bin", "python")
    if os.path.exists(venv_python):
        return venv_python
    return sys.executable


def update_frontend_env(port):
    """Dynamically writes the port to the React .env file"""
    env_path = os.path.join(FRONTEND_DIR, '.env')
    print(f"🔧 Updating React frontend to point to Backend port: {port}")
    with open(env_path, 'w') as f:
        f.write(f"REACT_APP_NODE_PORT={port}\n")
        f.write("PORT=3000\n") # You can change this if you want React on a different port

def run_command(command, cwd, name, env_vars=None):
    """Spawns a background process and injects environment variables"""
    print(f"🚀 Starting {name}...")
    
    use_shell = os.name == 'nt' and command[0] == 'npm'
    
    # Copy the current system environment variables
    process_env = os.environ.copy()
    
    # Inject our custom variables (like NODE_PORT or SERVER_PORT)
    if env_vars:
        process_env.update(env_vars)
    
    try:
        # Pass the updated environment to the subprocess
        p = subprocess.Popen(command, cwd=cwd, shell=use_shell, env=process_env)
        processes.append((name, p))
    except Exception as e:
        print(f"❌ Failed to start {name}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Assignment System Orchestrator")
    parser.add_argument("--assignment", action="store_true", help="Start the Node Backend and React Frontend")
    parser.add_argument("--db_server", action="store_true", help="Start the Centralized Database Server")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the specific backend on")
    parser.add_argument("--worker_only", action="store_true", help="Start ONLY a Backend Node (No React)")

    args = parser.parse_args()

    if not args.assignment and not args.db_server and not args.worker_only:
        print("❌ Please specify what to start: --assignment OR --db_server")
        parser.print_help()
        sys.exit(1)

    python_exe = get_python_executable()

    try:
        if args.worker_only:
            print(f"🤖 Mode: Headless Worker Node (Port {args.port})")
            run_command(
                [python_exe, "manage.py", "runserver", f"0.0.0.0:{args.port}"],
                cwd=ASSIGNMENT_NODE_DIR,
                name="Headless Node",
                env_vars={"NODE_PORT": str(args.port)} 
            )

        if args.db_server:
            print(f"🌐 Mode: Centralized DB Server (Port {args.port})")
            run_command(
                            [python_exe, "manage.py", "runserver", f"0.0.0.0:{args.port}"],
                            cwd=DB_SERVER_DIR,
                            name="Central DB Server",
                            env_vars={"SERVER_PORT": str(args.port)}  # <--- Inject the DB port
                        )
            
            # Start the Autonomous Daemon as a separate process alongside the DB Server
            run_command(
                [python_exe, "central_db_daemon.py"],
                cwd=DB_SERVER_DIR,
                name="Central DB Background Daemon",
            )

        if args.assignment:
            print(f"💻 Mode: Assignment Node + Frontend (Node Port {args.port})")
            
            # 1. Update React to know which port the backend is on
            update_frontend_env(args.port)
            
            # 2. Start Django Backend Node
            run_command(
                            [python_exe, "manage.py", "runserver", f"0.0.0.0:{args.port}"],
                            cwd=ASSIGNMENT_NODE_DIR,
                            name="Node Backend",
                            env_vars={"NODE_PORT": str(args.port)}  # <--- Inject the Node port
                        )
            
            # 3. Start React Frontend
            run_command(
                ["npm", "start"],
                cwd=FRONTEND_DIR,
                name="React Frontend"
            )

        # Keep the main script alive so we can listen for Ctrl+C
        print("\n✅ System is running! Press [Ctrl+C] to shut everything down gracefully.\n")
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\n🛑 Shutting down system...")
        for name, p in processes:
            print(f"Shutting down {name} (PID: {p.pid})...")
            p.terminate() # Gracefully ask the process to stop
            p.wait()      # Wait for it to close
        print("Goodbye!")
        sys.exit(0)

if __name__ == "__main__":
    main()