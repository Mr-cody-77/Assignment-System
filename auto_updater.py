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
    print("[INFO] Checking for network connection...")
    ping_cmd = "ping -n 1 -w 2000 github.com" if sys.platform == "win32" else "ping -c 1 -W 2 github.com"
    
    max_retries = 1 if "--fast" in sys.argv else 30
    for i in range(max_retries):
        if subprocess.run(ping_cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(2)
    else:
        print("[WARNING] No network connection detected to github.com. Skipping updates.")
        return

    old_hash = get_git_hash()

    # Handle conflicts dynamically by force-resetting to match origin/main exactly
    # This guarantees no local file changes or untracked files will ever abort the update
    print("[INFO] Fetching latest code...")
    if not run_command("git fetch origin main"):
        print("[ERROR] Failed to fetch latest code.")
        return
        
    print("[INFO] Discarding any local modifications...")
    run_command("git reset --hard origin/main")
    run_command("git clean -fd")
        
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
