"""
Services/node_identity.py

Provides a persistent and unified node_id per physical/virtual machine.
Ensures both Sender_Server and Receiver_Server share the exact same ID,
and that the ID does not change across Django auto-reloads or process restarts.
"""

import os
import uuid

_CACHED_NODE_ID = None

def get_persistent_node_id() -> str:
    global _CACHED_NODE_ID
    if _CACHED_NODE_ID:
        return _CACHED_NODE_ID

    # Locate storage path inside System_Management
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    id_file_path = os.path.join(base_dir, ".node_id")

    node_id = None
    if os.path.exists(id_file_path):
        try:
            with open(id_file_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content.startswith("Node-") and len(content) >= 9:
                    node_id = content
        except Exception:
            pass

    if not node_id:
        # Generate a new persistent 8-hex character Node ID
        node_id = f"Node-{uuid.uuid4().hex[:8]}"
        try:
            with open(id_file_path, "w", encoding="utf-8") as f:
                f.write(node_id)
        except Exception:
            pass

    _CACHED_NODE_ID = node_id
    return node_id
