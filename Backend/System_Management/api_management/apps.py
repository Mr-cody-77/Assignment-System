import os
import threading
import time
import platform
import subprocess
from django.apps import AppConfig

def monitor_heartbeat():
    # 120 second grace period on startup
    time.sleep(120)
    
    from api_management import views
    while True:
        time.sleep(5)
        # Check if more than 15 seconds have passed since the last heartbeat
        if time.time() - views.last_heartbeat > 15:
            print("Heartbeat lost! Browser closed. Shutting down system...")
            try:
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
                if platform.system() == 'Windows':
                    venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
                else:
                    venv_python = os.path.join(base_dir, ".venv", "bin", "python")
                    
                stop_script = os.path.join(base_dir, "stop_servers.py")
                if os.path.exists(venv_python) and os.path.exists(stop_script):
                    subprocess.run([venv_python, stop_script])
            except Exception as e:
                print(f"Error shutting down: {e}")
            break

class ApiManagementConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api_management'

    def ready(self):
        # The RUN_MAIN check prevents Django's dev server from 
        # starting the discovery thread twice.
            from Services.Sender_Server.network import start_discovery
            from api_management.sync_daemon import start_sync_daemon
            from api_management.heartbeat_daemon import start_heartbeat_daemon
            
            # Start the Zeroconf broadcast loop!
            start_discovery()
            
            # Start the cluster node heartbeat reporter to Central DB
            start_heartbeat_daemon()

            # Start the browser heartbeat monitor daemon
            threading.Thread(target=monitor_heartbeat, daemon=True).start()
            
            # Start the offline fallback sync daemon
            start_sync_daemon()