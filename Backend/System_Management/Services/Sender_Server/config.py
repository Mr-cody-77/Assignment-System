"""
Sender_Server/config.py
Configuration constants for the Sender (dispatcher) node.
"""

from Services.Sender_Server.runtime import runtime

# This node's identity (set by network.py after mDNS registration)
NODE_NAME = runtime.node_id

# Port where the Sender listens for task result callbacks
RESPONSE_PORT = 5001


# Max assignment attempts per task before re-queuing
MAX_RETRIES = 3

# Jitter range between retry attempts (seconds)
RETRY_DELAY_MIN = 0.1
RETRY_DELAY_MAX = 0.5

# Max Assigner Thread
MAX_ASSIGNER_THREADS = 10
DISPATCHER_SLEEP = 0.1