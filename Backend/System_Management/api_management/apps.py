import os
import threading
import time
import platform
import subprocess
from django.apps import AppConfig

def monitor_heartbeat():
    # 60 second grace period on startup
    time.sleep(60)
    
    from api_management import views
    while True:
        time.sleep(5)
        # Check if more than 15 seconds have passed since the last heartbeat
        if time.time() - views.last_heartbeat > 15:
            print("Heartbeat lost! Browser closed. Shutting down system...")
            try:
                if platform.system() == 'Windows':
                    subprocess.run("taskkill /F /IM node.exe /T", shell=True, stderr=subprocess.DEVNULL)
                    subprocess.run("taskkill /F /IM python.exe /T", shell=True, stderr=subprocess.DEVNULL)
                else:
                    subprocess.run("pkill -f node", shell=True, stderr=subprocess.DEVNULL)
                    subprocess.run("pkill -f python", shell=True, stderr=subprocess.DEVNULL)
            except Exception:
                pass
            break

class ApiManagementConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api_management'

    def ready(self):
        # The RUN_MAIN check prevents Django's dev server from 
        # starting the discovery thread twice.
        if os.environ.get('RUN_MAIN') == 'true':
            from Services.Sender_Server.network import start_discovery
            
            # Start the Zeroconf broadcast loop!
            start_discovery()
            
            # Start the browser heartbeat monitor daemon
            threading.Thread(target=monitor_heartbeat, daemon=True).start()