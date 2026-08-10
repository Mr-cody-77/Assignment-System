import os
import subprocess
import sys
import time

def run_command(cmd, cwd=None):
    try:
        subprocess.run(cmd, cwd=cwd, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Command failed: {cmd}")
        return False
    return True

def get_git_hash():
    try:
        return subprocess.check_output("git rev-parse HEAD", shell=True).decode().strip()
    except Exception:
        return None

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    print("Checking for updates...")
    if not os.path.exists(".git"):
        print("[INFO] This folder is not a git repository. Skipping updates.")
        return

    # Wait for network connection (especially useful if running on boot)
    print("[INFO] Waiting for network connection...")
    ping_cmd = "ping -n 1 github.com" if sys.platform == "win32" else "ping -c 1 github.com"
    for i in range(30):
        if subprocess.run(ping_cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(2)
    else:
        print("[ERROR] No network connection detected to github.com. Skipping updates.")
        return

    old_hash = get_git_hash()

    # Handle schedule_cache.json conflict by discarding local changes
    if os.path.exists("schedule_cache.json"):
        print("[INFO] Restoring local schedule_cache.json to avoid merge conflicts...")
        run_command("git checkout -- schedule_cache.json")
    
    # Pull latest code
    print("[INFO] Pulling latest code from origin main...")
    if not run_command("git pull origin main"):
        print("[ERROR] Failed to pull latest code.")
        return
        
    new_hash = get_git_hash()
    
    if old_hash == new_hash:
        print("[INFO] System is up to date.")
        return
        
    print("[INFO] Updates downloaded! Installing any new dependencies...")
    
    # Determine python executable
    if sys.platform == "win32":
        venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    else:
        venv_python = os.path.join(base_dir, ".venv", "bin", "python")
        
    python_cmd = venv_python if os.path.exists(venv_python) else sys.executable
    
    # Update python packages (backend)
    print("[INFO] Updating backend dependencies...")
    run_command(f'"{python_cmd}" -m pip install -r requirements.txt')
    
    # Update frontend packages
    frontend_dir = os.path.join(base_dir, "Frontend", "system_interface")
    if os.path.exists(os.path.join(frontend_dir, "package.json")):
        print("[INFO] Updating frontend dependencies...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        run_command(f'{npm_cmd} install', cwd=frontend_dir)
        
    print("[INFO] Update complete!")

if __name__ == "__main__":
    main()
