import socket
from zeroconf import Zeroconf, ServiceInfo, ServiceBrowser
import uuid
from node_manager import on_node_removed
from runtime import runtime

SERVICE_TYPE = "_work_tcp.local."

PORT = 8000

NODE_NAME = f"Node-{uuid.uuid4().hex[:6]}"
runtime.node_id = NODE_NAME

class NodeListener:
    def add_service(self, zeroconf, type, name):
        info = zeroconf.get_service_info(type, name)
        if info:
            ip = socket.inet_ntoa(info.addresses[0])
            port = info.port

            runtime.nodes[name] = {
                "ip": ip,
                "port": port
            }



    def remove_service(self, zeroconf, type, name):
        if name in runtime.nodes:
            del runtime.nodes[name]
        on_node_removed(name)


    def update_service(self, zeroconf, type, name):
        info = zeroconf.get_service_info(type, name)
        if info:
            ip = socket.inet_ntoa(info.addresses[0])
            port = info.port

            runtime.nodes[name] = {
                "ip": ip,
                "port": port
            }


zeroconf = Zeroconf()

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))   # doesn't actually send data
        ip = s.getsockname()[0]
    finally:
        s.close()
    return ip

hostname = socket.gethostname()
local_ip = get_local_ip()
runtime.ip = local_ip 


info = ServiceInfo(
    SERVICE_TYPE,
    f"{NODE_NAME}.{SERVICE_TYPE}",
    addresses=[socket.inet_aton(local_ip)],
    port=PORT,
    properties={"node": NODE_NAME},
)


zeroconf.register_service(info)


listener = NodeListener()
browser = ServiceBrowser(zeroconf, SERVICE_TYPE, listener)


print(f"Node {NODE_NAME} running at {local_ip}:{PORT}")
print("Listening for other nodes...")

try:
    while True:
        pass
except KeyboardInterrupt:
    print("Shutting down...")
    zeroconf.unregister_service(info)
    zeroconf.close()