"""
Receiver_Server/network.py
Handles zeroconf service discovery for the Receiver Server.
Discovers the centralized database server.
"""

import logging
import socket
import threading
import time

from Services.Receiver_Server.runtime import runtime

logger = logging.getLogger("receiver.network")

try:
    from zeroconf import Zeroconf, ServiceInfo, ServiceBrowser
    ZEROCONF_OK = True
except ImportError:
    ZEROCONF_OK = False
    logger.warning("zeroconf not installed")

DATABASE_SERVICE_TYPE = "_assignsysdb._tcp.local."


def update_local_ip_from_db(db_ip, db_port):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.3)
        s.connect((db_ip, int(db_port)))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith('127.'):
            return ip
    except Exception:
        pass
    return None


class DatabaseListener:
    def __init__(self):
        self.last_seen = {}

    def add_service(self, zc, service_type, name):
        info = zc.get_service_info(service_type, name)

        if not info or not info.addresses:
            return

        ip = socket.inet_ntoa(info.addresses[0])
        port = info.port

        props = {
            (k.decode() if isinstance(k, bytes) else k):
            (v.decode() if isinstance(v, bytes) else v)
            for k, v in (info.properties or {}).items()
        }

        role = props.get("role", "")

        # Centralized Database
        if role == "database":
            database_server = {
                "ip": ip,
                "port": port,
                "last_seen": time.time(),
            }

            with runtime.lock:
                runtime.database_server = database_server
                resolved_ip = update_local_ip_from_db(ip, port)
                if resolved_ip:
                    runtime.ip = resolved_ip
                    logger.info(f"Dynamically updated local IP to {resolved_ip} using DB connection.")

            logger.info(f"Database server discovered @ {ip}:{port}")
            return

    def remove_service(self, zc, service_type, name):
        if service_type == DATABASE_SERVICE_TYPE:
            with runtime.lock:
                if runtime.database_server:
                    logger.warning("Database server left network")
                    runtime.database_server = None

    def update_service(self, zc, service_type, name):
        self.add_service(zc, service_type, name)


def _cleanup_stale():
    while True:
        time.sleep(10)  # Check every 10 seconds

        now = time.time()
        with runtime.lock:
            if runtime.database_server:
                if (now - runtime.database_server.get("last_seen", 0)) > 30:
                    logger.warning("Database server timed out")
                    runtime.database_server = None


def start_discovery():
    if not ZEROCONF_OK:
        logger.error("Run: pip install zeroconf")
        return None

    zc = Zeroconf()
    listener = DatabaseListener()
    ServiceBrowser(zc, DATABASE_SERVICE_TYPE, listener)

    # Start cleanup thread for stale entries
    cleanup_thread = threading.Thread(
        target=_cleanup_stale,
        daemon=True,
        name="db-discovery-cleanup"
    )
    cleanup_thread.start()

    logger.info("Browsing LAN for database server...")
    return zc


def stop_discovery(zc):
    if zc:
        zc.close()
        logger.info("Database discovery stopped")