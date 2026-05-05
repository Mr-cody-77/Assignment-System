
from runtime import runtime

NODE_NAME = runtime.node_id

REQUEST_PORT = 5000      # other nodes (load/token)
RESPONSE_PORT = 5001     # receive task results

MAX_WORKERS = 5
MAX_RETRIES = 3

RETRY_DELAY_MIN = 0.05
RETRY_DELAY_MAX = 0.2