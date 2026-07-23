import logging
import socket
import threading
import time

from Services.Sender_Server.runtime import runtime
from Services.Receiver_Server.runtime import runtime as receiver_runtime
from Services.Sender_Server.node_manager import on_node_removed
from Services.load_score import get_runtime_score

logger = logging.getLogger("sender.network")

try:
    from zeroconf import Zeroconf, ServiceInfo, ServiceBrowser
    ZEROCONF_OK = True
except ImportError:
    ZEROCONF_OK = False
    logger.warning("zeroconf not installed")

NODE_SERVICE_TYPE = "_assignsys._tcp.local."
DATABASE_SERVICE_TYPE = "_assignsysdb._tcp.local."

RE_ANNOUNCE_INTERVAL = 30
NODE_TTL = 40


def _get_local_ip():
    for target in ("8.8.8.8", "192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.3)
            s.connect((target, 80))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith("127."):
                return ip
        except OSError:
            continue

    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip and not ip.startswith("127."):
            return ip
    except OSError:
        pass

    return "127.0.0.1"


class NodeListener:
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

        role = props.get("role", "node")

        # -------------------------
        # Centralized Database
        # -------------------------
        if role == "database":
            db_info = {
                "ip": ip,
                "port": port,
                "last_seen": time.time(),
            }
            # MODIFIED HERE: Update BOTH runtimes simultaneously
            runtime.database_server = db_info
            receiver_runtime.database_server = db_info

            logger.info(f"Database discovered @ {ip}:{port}")
            return

        # -------------------------
        # Execution Node
        # -------------------------
        node_id = props.get("node_id", name)

        if node_id == runtime.node_id:
            return

        with runtime.lock:
            runtime.nodes[node_id] = {
                "node_id": node_id,
                "ip": ip,
                "port": port,
                "hostname": props.get("hostname", ""),
                "load": float(props.get("load", 0)),
                "last_seen": time.time(),
                "failures": 0,
            }

        logger.info(f"Peer discovered: {node_id} @ {ip}:{port}")

    def remove_service(self, zc, service_type, name):
        if service_type == DATABASE_SERVICE_TYPE:
            if runtime.database_server:
                logger.warning("Database server left network")
                runtime.database_server = None
                # MODIFIED HERE: Clear Receiver runtime too
                receiver_runtime.database_server = None
            return

        with runtime.lock:
            to_remove = [
                node_id
                for node_id in runtime.nodes
                if name.startswith(node_id) or node_id in name
            ]

            for node_id in to_remove:
                runtime.nodes.pop(node_id, None)
                logger.warning(f"Peer removed: {node_id}")
                on_node_removed(node_id)

    def update_service(self, zc, service_type, name):
        self.add_service(zc, service_type, name)

def _cleanup_stale():
    while True:
        time.sleep(NODE_TTL // 2)
        now = time.time()

        with runtime.lock:
            # 1. Keep the computing node cleanup (they need it because they disconnect)
            stale_nodes = [
                node_id
                for node_id, node in runtime.nodes.items()
                if (now - node.get("last_seen", 0)) > NODE_TTL
            ]

            for node_id in stale_nodes:
                runtime.nodes.pop(node_id, None)
                logger.warning(f"Stale node removed: {node_id}")
                on_node_removed(node_id)

            # 2. DELETE OR COMMENT OUT THE DATABASE TIMEOUT LOGIC
            # We trust that the database is always there once discovered.
            # 
            # if runtime.database_server:
            #     if (now - runtime.database_server["last_seen"]) > NODE_TTL:
            #         logger.warning("Database server timed out")
            #         runtime.database_server = None
            #         receiver_runtime.database_server = None


def _re_announce_loop(zc, info):
    while True:
        time.sleep(RE_ANNOUNCE_INTERVAL)

        try:
            with runtime.lock:
                load = get_runtime_score(receiver_runtime)

            new_info = ServiceInfo(
                NODE_SERVICE_TYPE,
                f"{runtime.node_id}_{runtime.port}.{NODE_SERVICE_TYPE}",
                addresses=[socket.inet_aton(runtime.ip)],
                port=runtime.port,
                properties={
                    "role": "node",
                    "node_id": runtime.node_id,
                    "hostname": runtime.hostname,
                    "load": str(load),
                    "version": "1.0",
                },
                server=f"{runtime.hostname}.local.",
            )

            zc.update_service(new_info)
            runtime.service_info = new_info

        except Exception as e:
            logger.warning(f"Reannounce failed: {e}")


def start_discovery():
    if not ZEROCONF_OK:
        logger.error("Run: pip install zeroconf")
        return

    runtime.ip = _get_local_ip()

    logger.info(
        f"Node {runtime.node_id} @ {runtime.ip}:{runtime.port}"
    )

    zc = Zeroconf()
    runtime.zc = zc

    info = ServiceInfo(
        NODE_SERVICE_TYPE,
        f"{runtime.node_id}_{runtime.port}.{NODE_SERVICE_TYPE}",
        addresses=[socket.inet_aton(runtime.ip)],
        port=runtime.port,
        properties={
            "role": "node",
            "node_id": runtime.node_id,
            "hostname": runtime.hostname,
            "load": str(get_runtime_score(receiver_runtime)),
            "version": "1.0",
        },
        server=f"{runtime.hostname}.local.",
    )

    runtime.service_info = info

    try:
        zc.register_service(info)
        logger.info(f"Registered {runtime.node_id}")
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        return

    listener = NodeListener()

    ServiceBrowser(zc, NODE_SERVICE_TYPE, listener)
    ServiceBrowser(zc, DATABASE_SERVICE_TYPE, listener)

    threading.Thread(
        target=_re_announce_loop,
        args=(zc, info),
        daemon=True,
        name="zc-reannounce",
    ).start()

    threading.Thread(
        target=_cleanup_stale,
        daemon=True,
        name="zc-cleanup",
    ).start()

    logger.info("Browsing LAN for nodes...")
    return zc, info


def stop_discovery():
    if not runtime.zc:
        return

    try:
        if runtime.service_info:
            runtime.zc.unregister_service(runtime.service_info)

        runtime.zc.close()
        logger.info("Discovery stopped")

    except Exception as e:
        logger.warning(f"Stop discovery failed: {e}")