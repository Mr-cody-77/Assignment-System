import time
import requests
import subprocess
import logging
import os
import sys
import json
from datetime import datetime, timezone, timedelta
import platform

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

def get_db_url_from_local_node():
    # First check .env for REACT_APP_NODE_PORT
    frontend_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Frontend', 'system_interface', '.env')
    node_port = 8000
    if os.path.exists(frontend_env):
        try:
            with open(frontend_env, 'r') as f:
                for line in f:
                    if line.strip().startswith('REACT_APP_NODE_PORT='):
                        node_port = int(line.split('=', 1)[1].strip())
                        break
        except Exception:
            pass

    # Try to query the local node
    try:
        res = requests.get(f"http://localhost:{node_port}/api/node_info/", timeout=2)
        if res.status_code == 200:
            data = res.json()
            db = data.get('database_server')
            if db and db.get('ip') and db.get('port') and db.get('ip') != 'Pending...':
                return f"http://{db['ip']}:{db['port']}/api/schedule/"
    except Exception:
        pass
        
    # Also fallback to check ports 8000 to 8010 just in case
    for port in range(8000, 8010):
        if port == node_port:
            continue
        try:
            res = requests.get(f"http://localhost:{port}/api/node_info/", timeout=1)
            if res.status_code == 200:
                data = res.json()
                db = data.get('database_server')
                if db and db.get('ip') and db.get('port') and db.get('ip') != 'Pending...':
                    return f"http://{db['ip']}:{db['port']}/api/schedule/"
        except Exception:
            continue
    return None

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

def is_admin():
    if platform.system() == 'Windows':
        try:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            return False
    else:
        try:
            return os.geteuid() == 0
        except Exception:
            return False

def lock_internet(target_url=None):
    try:
        import ipaddress
        allowed_ipv4 = ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '224.0.0.0/4']
        allowed_ipv6 = ['::1/128', 'fe80::/10', 'fc00::/7', 'ff00::/8']
        
        try:
            import socket
            hostname = socket.gethostname()
            _, _, ip_list = socket.gethostbyname_ex(hostname)
            for ip in ip_list:
                try:
                    ip_obj = ipaddress.IPv4Address(ip)
                    if not ip_obj.is_loopback:
                        net = ipaddress.IPv4Network(f"{ip}/24", strict=False)
                        allowed_ipv4.append(str(net))
                except Exception:
                    pass
        except Exception as e:
            logging.warning(f"Could not get local IPs: {e}")
            
        if target_url:
            db_ip = None
            try:
                import urllib.parse
                import socket
                host = urllib.parse.urlparse(target_url).hostname
                if host:
                    try:
                        ip_obj = ipaddress.ip_address(host)
                        db_ip = str(ip_obj)
                    except ValueError:
                        db_ip = socket.gethostbyname(host)
            except Exception as e:
                logging.warning(f"Could not resolve DB IP from {target_url}: {e}")
                
            if db_ip:
                try:
                    ip_obj = ipaddress.ip_address(db_ip)
                    if ip_obj.version == 4:
                        allowed_ipv4.append(f"{db_ip}/32")
                    else:
                        allowed_ipv6.append(f"{db_ip}/128")
                except ValueError:
                    pass
                    
        def get_block_ranges(allowed_ips, is_ipv6=False):
            if is_ipv6:
                networks = [ipaddress.IPv6Network(n, strict=False) for n in allowed_ips]
                blocked = [ipaddress.IPv6Network('::/0')]
            else:
                networks = [ipaddress.IPv4Network(n, strict=False) for n in allowed_ips]
                blocked = [ipaddress.IPv4Network('0.0.0.0/0')]
                
            for allowed in networks:
                new_blocked = []
                for b in blocked:
                    if allowed.overlaps(b):
                        if allowed.supernet_of(b):
                            pass
                        elif allowed.subnet_of(b):
                            new_blocked.extend(list(b.address_exclude(allowed)))
                    else:
                        new_blocked.append(b)
                blocked = new_blocked
            return [str(net) for net in blocked]

        ipv4_blocks = get_block_ranges(allowed_ipv4, is_ipv6=False)
        ipv6_blocks = get_block_ranges(allowed_ipv6, is_ipv6=True)

        if platform.system() == 'Windows':
            ipv4_str = "'" + "', '".join(ipv4_blocks) + "'"
            ipv6_str = "'" + "', '".join(ipv6_blocks) + "'"
            script = (
                "$ErrorActionPreference = 'Stop'; "
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockInternet' -ErrorAction SilentlyContinue; "
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -ErrorAction SilentlyContinue; "
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -ErrorAction SilentlyContinue; "
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockIPv6' -ErrorAction SilentlyContinue; "
                f"New-NetFirewallRule -DisplayName 'ExamSystem_BlockInternet' -Direction Outbound -Action Block -RemoteAddress {ipv4_str} -Enabled True; "
                f"New-NetFirewallRule -DisplayName 'ExamSystem_BlockIPv6' -Direction Outbound -Action Block -RemoteAddress {ipv6_str} -Enabled True;"
            )
            res1 = subprocess.run([
                'powershell', '-Command', script
            ], capture_output=True, text=True)
            
            if res1.returncode != 0:
                logging.error(f"Failed to lock internet. res1: {res1.stderr}")
            else:
                logging.info("Internet locked using explicit public IP blocks.")
        else:
            # Linux iptables lockdown
            # Insert rules at the top of the OUTPUT chain so they take precedence
            subprocess.run(["iptables", "-I", "OUTPUT", "1", "-j", "DROP"])
            # Allow LAN traffic (adjust as needed, commonly 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12)
            subprocess.run(["iptables", "-I", "OUTPUT", "1", "-d", "172.16.0.0/12", "-j", "ACCEPT"])
            subprocess.run(["iptables", "-I", "OUTPUT", "1", "-d", "10.0.0.0/8", "-j", "ACCEPT"])
            subprocess.run(["iptables", "-I", "OUTPUT", "1", "-d", "192.168.0.0/16", "-j", "ACCEPT"])
            # Allow loopback (localhost)
            res = subprocess.run(["iptables", "-I", "OUTPUT", "1", "-o", "lo", "-j", "ACCEPT"], capture_output=True, text=True)
            if res.returncode != 0:
                logging.error(f"Failed to lock internet. iptables error: {res.stderr}")
            else:
                logging.info("Internet locked via iptables.")
    except Exception as e:
        logging.error(f"Failed to lock internet: {e}")

def unlock_internet():
    try:
        if platform.system() == 'Windows':
            script = (
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockInternet' -ErrorAction SilentlyContinue; "
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockIPv6' -ErrorAction SilentlyContinue; "
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -ErrorAction SilentlyContinue; "
                "Remove-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -ErrorAction SilentlyContinue;"
            )
            res1 = subprocess.run([
                'powershell', '-Command', script
            ], capture_output=True, text=True)
            
            if res1.returncode != 0 and "No MSFT_NetFirewallRule" not in res1.stderr:
                logging.error(f"Failed to unlock internet. res1: {res1.stderr}")
            else:
                logging.info("Internet unlocked.")
        else:
            # Linux iptables unlock
            subprocess.run(["iptables", "-D", "OUTPUT", "-o", "lo", "-j", "ACCEPT"])
            subprocess.run(["iptables", "-D", "OUTPUT", "-d", "192.168.0.0/16", "-j", "ACCEPT"])
            subprocess.run(["iptables", "-D", "OUTPUT", "-d", "10.0.0.0/8", "-j", "ACCEPT"])
            subprocess.run(["iptables", "-D", "OUTPUT", "-d", "172.16.0.0/12", "-j", "ACCEPT"])
            res = subprocess.run(["iptables", "-D", "OUTPUT", "-j", "DROP"], capture_output=True, text=True)
            if res.returncode != 0 and "Bad rule" not in res.stderr:
                logging.error(f"Failed to unlock internet. iptables error: {res.stderr}")
            else:
                logging.info("Internet unlocked via iptables.")
    except Exception as e:
        logging.error(f"Failed to unlock internet: {e}")

def main():
    if not is_admin():
        logging.critical("Lockdown daemon MUST be run as Administrator! Firewall rules will fail. Exiting.")
        print("CRITICAL: Lockdown daemon MUST be run as Administrator!")
        sys.exit(1)
        
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
            target_url = get_db_url_from_local_node()
            if not target_url:
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
                lock_internet(target_url)
                is_currently_locked = True
            elif not should_lock and is_currently_locked:
                unlock_internet()
                is_currently_locked = False
        except Exception as e:
            logging.error(f"Error applying lockdown logic: {e}")
            
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
