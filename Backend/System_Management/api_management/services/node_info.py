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


def handle_node_info() -> dict:

    nodes_info = []

    with sender_runtime.lock:

        nodes = list(
            sender_runtime.nodes.values()
        )

        database_server = (
            sender_runtime.database_server.copy()
            if sender_runtime.database_server
            else None
        )

    # Fetch load only from execution nodes
        
    for node in nodes:

        try:

            load_info = fetch_node_load(
                node["ip"],
                node["port"],
            )

            with sender_runtime.lock:

                node_ref = sender_runtime.nodes.get(
                    node["node_id"]
                )

                if node_ref:
                    node_ref["failures"] = 0

            nodes_info.append(load_info)

        except Exception:

            with sender_runtime.lock:

                node_ref = sender_runtime.nodes.get(
                    node["node_id"]
                )

                if node_ref:

                    node_ref["failures"] += 1

                    print(
                        f"Node {node['node_id']} "
                        f"failure count = "
                        f"{node_ref['failures']}"
                    )

                    if node_ref["failures"] >= 3:

                        sender_runtime.nodes.pop(
                            node["node_id"],
                            None,
                        )

                        print(
                            f"Removing dead node "
                            f"{node['node_id']}"
                        )

            continue

    # Database server metadata only
    db_info = None
# Database server metadata only
    if database_server:
        db_info = {
            "name": "Database Server",
            "ip": database_server["ip"],
            "port": database_server["port"],
        }
    else:
        # MODIFIED: Provide a fallback object so React doesn't crash 
        # while Zeroconf is still discovering the network.
        db_info = {
            "name": "Searching for Database...",
            "ip": "Pending...",
            "port": 8000,
        }

    # Fetch gateway (self) metrics directly from memory to avoid deadlocks
    try:
        from Services.Receiver_Server.runtime import runtime as receiver_runtime
        from Services.Receiver_Server.load_checker import get_predicted_score
        
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
            "current_load_score": get_predicted_score(receiver_runtime),
            "is_gateway": True
        }
        nodes_info.insert(0, gateway_info)
    except Exception as e:
        print(f"Failed to fetch gateway load: {e}")

    return {
            "database_server": db_info,
            
            # --- NEW GATEWAY BLOCK ---
            "gateway": {
                "node_id": sender_runtime.node_id,
                "hostname": sender_runtime.hostname,
                "ip": sender_runtime.ip,
                "port": sender_runtime.port,
            },
            # -------------------------
            
            "nodes": nodes_info,
        }