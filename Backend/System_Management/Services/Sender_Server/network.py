import logging
import socket
import threading
import time
import sys

if sys.platform == 'win32':
    import asyncio
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

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


def _get_all_local_ips():
    ips = {"127.0.0.1", "localhost", "0.0.0.0"}
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None):
            addr = info[4][0]
            if addr and not addr.startswith("127."):
                ips.add(addr)
    except Exception:
        pass
    if runtime.ip:
        ips.add(runtime.ip)
    if receiver_runtime.ip:
        ips.add(receiver_runtime.ip)
    return ips


class NodeListener:
    def add_service(self, zc, service_type, name):
        info = zc.get_service_info(service_type, name)

        if not info or not info.addresses:
            return

        ip = socket.inet_ntoa(info.addresses[0])
        port = int(info.port)

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
            runtime.database_server = db_info
            receiver_runtime.database_server = db_info

            logger.info(f"Database discovered @ {ip}:{port}")

            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.settimeout(0.3)
                s.connect((ip, int(port)))
                resolved_ip = s.getsockname()[0]
                s.close()
                if resolved_ip and not resolved_ip.startswith('127.'):
                    runtime.ip = resolved_ip
                    receiver_runtime.ip = resolved_ip
                    logger.info(f"Dynamically updated local IP to {resolved_ip} using DB connection.")
            except Exception:
                pass
            return

        # -------------------------
        # Execution Node
        # -------------------------
        # Parse canonical node_id from props, or extract from service name if missing
        node_id = props.get("node_id")
        if not node_id:
            clean_name = name.split(".")[0]
            node_id = clean_name.rsplit("_", 1)[0] if "_" in clean_name else clean_name

        local_ips = _get_all_local_ips()
        hostname = props.get("hostname", "")

        # Strict check: Never add local machine to remote peer nodes
        is_self = (
            node_id in (runtime.node_id, receiver_runtime.node_id)
            or (ip in local_ips and port in (int(runtime.port), int(receiver_runtime.port)))
            or (hostname and hostname.lower() == runtime.hostname.lower() and port == int(runtime.port))
        )
        if is_self:
            return

        with runtime.lock:
            # Evict any existing entry for the same machine endpoint (IP:port), same hostname:port, or same node_id
            stale_keys = [
                k for k, v in runtime.nodes.items()
                if k == node_id
                or (v.get("ip") == ip and int(v.get("port", 0)) == port)
                or (hostname and v.get("hostname") and v.get("hostname").lower() == hostname.lower() and int(v.get("port", 0)) == port)
            ]
            for k in stale_keys:
                runtime.nodes.pop(k, None)

            runtime.nodes[node_id] = {
                "node_id": node_id,
                "ip": ip,
                "port": port,
                "hostname": hostname,
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
                receiver_runtime.database_server = None
            return

        clean_name = name.split(".")[0]
        target_id = clean_name.rsplit("_", 1)[0] if "_" in clean_name else clean_name

        with runtime.lock:
            to_remove = [
                node_id
                for node_id in runtime.nodes
                if node_id == target_id or name.startswith(node_id) or node_id in name
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
            # Check if IP has changed
            current_ip = _get_local_ip()
            if runtime.ip != current_ip:
                logger.info(f"Network IP changed from {runtime.ip} to {current_ip}. Restarting discovery...")
                threading.Thread(target=restart_discovery_safe, daemon=True).start()
                break # Exit this old loop, a new one will start

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

def restart_discovery_safe():
    try:
        stop_discovery()
    except:
        pass
    time.sleep(2)
    start_discovery()


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