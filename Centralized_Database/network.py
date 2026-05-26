import os
import socket
import threading
import logging
import time  # <-- Added missing import

from zeroconf import Zeroconf, ServiceInfo

logger = logging.getLogger("database.network")

import uuid
unique_id = str(uuid.uuid4())[:8]

SERVICE_TYPE = "_assignsysdb._tcp.local."
SERVER_PORT = 8000  # Django port
RE_ANNOUNCE_INTERVAL = 30  # <-- Added interval


def get_local_ip():
    targets = [
        "192.168.1.1",
        "192.168.0.1",
        "10.0.0.1",
        "172.16.0.1"
    ]

    for target in targets:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((target, 80))
            ip = s.getsockname()[0]
            s.close()

            if not ip.startswith("127."):
                return ip
        except:
            pass

    try:
        ip = socket.gethostbyname(socket.gethostname())
        if not ip.startswith("127."):
            return ip
    except:
        pass

    return "127.0.0.1"


class DatabaseBroadcaster:
    def __init__(self):
        self.zc = None
        self.info = None

    # --- MODIFIED HERE: Added re-announce loop ---
    def _re_announce_loop(self):
        while True:
            time.sleep(RE_ANNOUNCE_INTERVAL)
            if self.zc and self.info:
                try:
                    self.zc.update_service(self.info)
                except Exception as e:
                    logger.warning(f"Database re-announce failed: {e}")
    # ---------------------------------------------

    def start(self):
        ip = get_local_ip()

        logger.info(f"Database Server IP: {ip}")

        self.zc = Zeroconf()
        print(
            "SERVER_PORT ENV =",
            os.environ.get("SERVER_PORT")
        )
        self.info = ServiceInfo(
            SERVICE_TYPE,
            f"DatabaseServer_{unique_id}._assignsysdb._tcp.local.",
            addresses=[socket.inet_aton(ip)],
            port=SERVER_PORT,
            properties={
                "role": "database",
                "api_port": str(SERVER_PORT),
                "version": "1.0"
            }
        )

        self.zc.register_service(self.info)

        logger.info(
            f"Database server advertised on LAN: {ip}:{SERVER_PORT}"
        )

        # --- MODIFIED HERE: Start the background heartbeat thread ---
        threading.Thread(
            target=self._re_announce_loop,
            daemon=True,
            name="db-reannounce"
        ).start()
        # ------------------------------------------------------------

    def stop(self):
        if self.zc and self.info:
            self.zc.unregister_service(self.info)
            self.zc.close()


broadcaster = DatabaseBroadcaster()


def start_database_discovery():
    threading.Thread(
        target=broadcaster.start,
        daemon=True
    ).start()