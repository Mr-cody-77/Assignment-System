import time
import requests
import subprocess
import logging
import os
import sys
import json
from datetime import datetime, timezone, timedelta

os.chdir(os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(
    filename='lockdown_daemon.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Configuration
db_server_ip = None
db_server_port = '8000'

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('DATABASE_SERVER_IP='):
                db_server_ip = line.split('=', 1)[1].strip()
            elif line.startswith('DATABASE_SERVER_PORT='):
                db_server_port = line.split('=', 1)[1].strip()

# Zeroconf Discovery Fallback
discovered_db_url = None
try:
    from zeroconf import Zeroconf, ServiceBrowser
    import socket
    
    class DBListener:
        def add_service(self, zc, type_, name):
            global discovered_db_url
            info = zc.get_service_info(type_, name)
            if info and info.addresses:
                ip = socket.inet_ntoa(info.addresses[0])
                port = info.port
                props = {
                    (k.decode() if isinstance(k, bytes) else k):
                    (v.decode() if isinstance(v, bytes) else v)
                    for k, v in (info.properties or {}).items()
                }
                if props.get("role", "") == "database":
                    discovered_db_url = f"http://{ip}:{port}/api/schedule/"
                    logging.info(f"Discovered DB server via Zeroconf at {ip}:{port}")
        def update_service(self, zc, type_, name): pass
        def remove_service(self, zc, type_, name): pass

    zc = Zeroconf()
    ServiceBrowser(zc, "_assignsysdb._tcp.local.", DBListener())
except Exception as e:
    logging.warning(f"Zeroconf discovery unavailable: {e}")

POLL_INTERVAL = 30 # seconds
CACHE_FILE = 'schedule_cache.json'

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Failed to load cache: {e}")
    return None

def save_cache(schedule):
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(schedule, f)
    except Exception as e:
        logging.error(f"Failed to save cache: {e}")

def is_ist_now_in_range(start_time_iso, end_time_iso):
    if not start_time_iso or not end_time_iso:
        return False
        
    try:
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        
        start_time = datetime.fromisoformat(start_time_iso.replace('Z', '+00:00')).astimezone(ist)
        end_time = datetime.fromisoformat(end_time_iso.replace('Z', '+00:00')).astimezone(ist)
        
        return start_time <= now_ist <= end_time
    except Exception as e:
        logging.error(f"Error parsing dates: {e}")
        return False

def lock_internet():
    try:
        script = (
            "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -ErrorAction SilentlyContinue; "
            "Remove-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -ErrorAction SilentlyContinue; "
            "New-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -Direction Outbound -Action Block -Enabled True; "
            "New-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -Direction Outbound -Action Allow -RemoteAddress '127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '224.0.0.0/4', '255.255.255.255' -Enabled True;"
        )
        res1 = subprocess.run([
            'powershell', '-Command', script
        ], capture_output=True, text=True)
        
        if res1.returncode != 0:
            logging.error(f"Failed to lock internet. res1: {res1.stderr}")
        else:
            logging.info("Internet locked.")
    except Exception as e:
        logging.error(f"Failed to lock internet: {e}")

def unlock_internet():
    try:
        res1 = subprocess.run([
            'powershell', '-Command',
            "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -ErrorAction SilentlyContinue; Remove-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -ErrorAction SilentlyContinue"
        ], capture_output=True, text=True)
        
        if res1.returncode != 0 and "No MSFT_NetFirewallRule" not in res1.stderr:
            logging.error(f"Failed to unlock internet. res1: {res1.stderr}")
        else:
            logging.info("Internet unlocked.")
    except Exception as e:
        logging.error(f"Failed to unlock internet: {e}")

def main():
    logging.info("Lockdown daemon started.")
    is_currently_locked = False
    
    # Ensure initially unlocked on startup just in case
    unlock_internet()
    
    cached_schedule = load_cache()
    
    while True:
        schedule = None
        
        target_url = None
        if db_server_ip:
            target_url = f"http://{db_server_ip}:{db_server_port}/api/schedule/"
        elif discovered_db_url:
            target_url = discovered_db_url
        else:
            target_url = "http://localhost:8000/api/schedule/"
            
        try:
            response = requests.get(target_url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                schedule = data.get('schedule')
                
                # Update cache if a successful response was received
                save_cache(schedule)
                cached_schedule = schedule
            else:
                logging.warning(f"Failed to fetch schedule: {response.status_code}")
                schedule = cached_schedule
                
        except requests.exceptions.RequestException as e:
            logging.warning(f"Network error fetching schedule: {e}. Using cached schedule if available.")
            schedule = cached_schedule
        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            schedule = cached_schedule
            
        try:
            if schedule and schedule.get('is_active'):
                should_lock = is_ist_now_in_range(schedule.get('start_time'), schedule.get('end_time'))
            else:
                should_lock = False
            
            if should_lock and not is_currently_locked:
                lock_internet()
                is_currently_locked = True
            elif not should_lock and is_currently_locked:
                unlock_internet()
                is_currently_locked = False
        except Exception as e:
            logging.error(f"Error applying lockdown logic: {e}")
            
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
