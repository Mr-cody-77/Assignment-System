import json
import urllib.request

from Services.Sender_Server.runtime import runtime as sender_runtime


def fetch_node_load(ip: str, port: int) -> dict:

    url = f"http://{ip}:{port}/api/get-load/"

    try:

        with urllib.request.urlopen(
            url,
            timeout=3,
        ) as response:

            return json.loads(
                response.read().decode()
            )

    except Exception as e:

        raise Exception(
            f"Failed to fetch load info "
            f"from {ip}:{port}: {str(e)}"
        )


def _get_local_addresses():
    import socket
    addrs = {"127.0.0.1", "localhost", "0.0.0.0"}
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            a = info[4][0]
            if a and not a.startswith("127."):
                addrs.add(a)
    except Exception:
        pass
    return addrs


def handle_node_info() -> dict:
    from Services.Receiver_Server.runtime import runtime as receiver_runtime
    from Services.Receiver_Server.load_checker import get_predicted_score

    local_ips = _get_local_addresses()
    if receiver_runtime.ip:
        local_ips.add(receiver_runtime.ip)
    if sender_runtime.ip:
        local_ips.add(sender_runtime.ip)

    # 1. Fetch gateway (self) metrics directly from local memory
    gateway_info = {
        "node_id": receiver_runtime.node_id,
        "hostname": receiver_runtime.hostname,
        "ip": receiver_runtime.ip,
        "port": receiver_runtime.port,
        "cpu_usage": receiver_runtime.cpu_usage,
        "memory_usage": receiver_runtime.memory_usage,
        "io_wait": receiver_runtime.io_wait,
        "active_workers": receiver_runtime.active_workers,
        "inflight_tasks": receiver_runtime.inflight_tasks,
        "completed_tasks": receiver_runtime.completed_tasks,
        "workers_limit": receiver_runtime.workers_limit,
        "current_load_score": get_predicted_score(),
        "is_gateway": True
    }

    with sender_runtime.lock:
        raw_nodes = list(sender_runtime.nodes.values())
        database_server = (
            sender_runtime.database_server.copy()
            if sender_runtime.database_server
            else None
        )

    # 2. Try fetching the authoritative cluster node list from Central DB
    cluster_nodes = None
    if database_server and database_server.get("ip") and database_server.get("port"):
        try:
            db_url = f"http://{database_server['ip']}:{database_server['port']}/api/nodes/"
            with urllib.request.urlopen(db_url, timeout=2.5) as resp:
                if resp.status == 200:
                    payload = json.loads(resp.read().decode())
                    if isinstance(payload.get("nodes"), list):
                        cluster_nodes = payload["nodes"]
        except Exception:
            cluster_nodes = None

    nodes_info = []
    seen_endpoints = set()
    seen_ids = set()

    # Always ensure gateway is registered first
    gw_ep = (gateway_info["ip"], int(gateway_info["port"]))
    seen_endpoints.add(gw_ep)
    seen_ids.add(gateway_info["node_id"])
    nodes_info.append(gateway_info)

    if cluster_nodes is not None:
        # A. Authoritative list from Central DB
        for n in cluster_nodes:
            n_ip = n.get("ip")
            n_port = int(n.get("port", 8000))
            n_id = n.get("node_id")

            if (n_ip, n_port) in seen_endpoints or n_id in seen_ids:
                continue
            if n_ip in local_ips and n_port in (int(receiver_runtime.port), int(sender_runtime.port)):
                continue

            n_copy = dict(n)
            n_copy["is_gateway"] = False
            seen_endpoints.add((n_ip, n_port))
            if n_id:
                seen_ids.add(n_id)
            nodes_info.append(n_copy)

    else:
        # B. Fallback to Zeroconf discovered nodes with strict deduplication
        for node in raw_nodes:
            n_ip = node.get("ip")
            n_port = int(node.get("port", 0))
            n_id = node.get("node_id")
            n_host = (node.get("hostname") or "").strip().lower()

            if (n_ip, n_port) in seen_endpoints or n_id in seen_ids:
                continue
            if n_ip in local_ips and n_port in (int(receiver_runtime.port), int(sender_runtime.port)):
                continue

            try:
                load_info = fetch_node_load(n_ip, n_port)

                with sender_runtime.lock:
                    node_ref = sender_runtime.nodes.get(n_id)
                    if node_ref:
                        node_ref["failures"] = 0

                ret_id = load_info.get("node_id", n_id)
                ret_ip = load_info.get("ip", n_ip)
                ret_port = int(load_info.get("port", n_port))

                if (ret_ip, ret_port) in seen_endpoints or ret_id in seen_ids:
                    continue
                if ret_ip in local_ips and ret_port in (int(receiver_runtime.port), int(sender_runtime.port)):
                    continue

                seen_endpoints.add((ret_ip, ret_port))
                seen_ids.add(ret_id)
                load_info["is_gateway"] = False
                nodes_info.append(load_info)

            except Exception:
                with sender_runtime.lock:
                    node_ref = sender_runtime.nodes.get(n_id)
                    if node_ref:
                        node_ref["failures"] = node_ref.get("failures", 0) + 1
                        if node_ref["failures"] >= 3:
                            sender_runtime.nodes.pop(n_id, None)
                continue

    # Database server metadata
    db_info = None
    if database_server:
        db_info = {
            "name": "Database Server",
            "ip": database_server["ip"],
            "port": database_server["port"],
        }
    else:
        db_info = {
            "name": "Searching for Database...",
            "ip": "Pending...",
            "port": 8000,
        }

    return {
        "database_server": db_info,
        "gateway": {
            "node_id": sender_runtime.node_id,
            "hostname": sender_runtime.hostname,
            "ip": sender_runtime.ip,
            "port": sender_runtime.port,
        },
        "nodes": nodes_info,
    }