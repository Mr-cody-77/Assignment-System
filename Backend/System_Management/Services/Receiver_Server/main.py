"""
Receiver_Server/main.py
Full HTTP server entry point for the standalone Worker/Receiver node.

Exposes endpoints:
  GET  /load          — return current load metrics
  POST /request_token — Phase 1 admission control
  POST /accepted_task — Phase 2 full task execution
  GET  /health        — simple health check

Starts:
  1. System monitor (psutil daemon)
  2. HTTP server (stdlib, no Flask dependency)
  3. Task worker pool
"""

import json
import logging
import os
import signal
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s %(asctime)s [Receiver] %(message)s',
)
logger = logging.getLogger('receiver.main')

# ── Local imports ──────────────────────────────────────────────
from Services.Receiver_Server.runtime import runtime
from Services.Receiver_Server.system_monitor import system_monitor
from Services.Receiver_Server.load_checker import system_load_checker
from Services.Receiver_Server.worker_manager import handle_accepted_task, register_accepted_task
from Services.Receiver_Server.queue_manager import queue_size
from Services.Receiver_Server.worker import execute_task
from Services.Receiver_Server.network import start_discovery, stop_discovery

PORT = int(os.getenv('NODE_PORT', 8000))
runtime.port = PORT


# ══════════════════════════════════════════════════════════════
#  HTTP Request Handler
# ══════════════════════════════════════════════════════════════

class ReceiverHandler(BaseHTTPRequestHandler):
    """Handle all incoming HTTP requests from peer nodes."""

    def log_message(self, fmt, *args):
        logger.debug(f"HTTP {fmt % args}")

    # ── Routing ───────────────────────────────────────────────

    def do_GET(self):
        if self.path == '/load' or self.path.startswith('/load?'):
            self._handle_load()
        elif self.path == '/health':
            self._respond(200, {'status': 'ok', 'node_id': runtime.node_id})
        else:
            self._respond(404, {'error': 'Not found'})

    def do_POST(self):
        body = self._read_body()
        if body is None:
            return
        if self.path == '/request_token':
            self._handle_request_token(body)
        elif self.path == '/accepted_task':
            self._handle_accepted_task(body)
        else:
            self._respond(404, {'error': 'Not found'})

    # ── Handlers ──────────────────────────────────────────────

    def _handle_load(self):
        predicted = runtime.predicted_load()
        self._respond(200, {
            'node_id':      runtime.node_id,
            'ip':           runtime.ip,
            'port':         runtime.port,
            'hostname':     runtime.hostname,
            'cpu':          round(runtime.cpu_usage, 3),
            'memory':       round(runtime.memory_usage, 3),
            'io_wait':      round(runtime.io_wait, 3),
            'active_workers':  runtime.active_workers,
            'inflight_tasks':  runtime.inflight_tasks,
            'completed_tasks': runtime.completed_tasks,
            'workers_limit':   runtime.workers_limit,
            'predicted_cpu':   predicted,
            'load':            predicted,
        })

    def _handle_request_token(self, body: dict):
        task_id = body.get('task_id')
        if not task_id:
            self._respond(400, {'status': 'reject', 'reason': 'task_id required'})
            return

        if system_load_checker():
            token = str(uuid.uuid4())
            register_accepted_task(task_id, token)
            logger.info(f"Token issued for task {task_id}")
            self._respond(200, {'status': 'accept', 'token': token})
        else:
            logger.info(f"Token rejected for task {task_id} — node overloaded")
            self._respond(200, {'status': 'reject', 'reason': 'Node overloaded'})

    def _handle_accepted_task(self, body: dict):
        task_id = body.get('task_id')
        token   = body.get('token')

        if not task_id or not token:
            self._respond(400, {'status': 'rejected', 'reason': 'task_id and token required'})
            return

        ok, reason = handle_accepted_task(body)
        if ok:
            self._respond(200, {'status': 'accepted', 'message': 'Task queued for execution'})
        else:
            self._respond(403, {'status': 'rejected', 'reason': reason})

    # ── Helpers ───────────────────────────────────────────────

    def _read_body(self) -> dict | None:
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            self._respond(400, {'error': 'Empty body'})
            return None
        try:
            return json.loads(self.rfile.read(length))
        except json.JSONDecodeError as e:
            self._respond(400, {'error': f'Invalid JSON: {e}'})
            return None

    def _respond(self, code: int, body: dict):
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


# ══════════════════════════════════════════════════════════════
#  Startup
# ══════════════════════════════════════════════════════════════

def _signal_handler(sig, frame):
    logger.info("Shutdown signal received. Exiting.")
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT,  _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    logger.info("=" * 55)
    logger.info(f"  Receiver Server  |  Node: {runtime.node_id}")
    logger.info(f"  LAN IP: {runtime.ip}:{PORT}")
    logger.info("=" * 55)

    # 1. System monitor
    logger.info("[1/3] Starting system monitor...")
    threading.Thread(target=system_monitor, daemon=True, name='sys-monitor').start()
    time.sleep(0.5)  # Let psutil collect one sample

    # 2. Service discovery
    logger.info("[2/3] Starting service discovery...")
    discovery_zc = start_discovery()

    # 3. HTTP server
    logger.info("[3/3] Starting HTTP server on 0.0.0.0:{PORT}...")
    server = HTTPServer(('0.0.0.0', PORT), ReceiverHandler)
    logger.info(f"✓ Receiver ready at http://{runtime.ip}:{PORT}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutdown signal received.")
    finally:
        # Clean up discovery service
        logger.info("[Cleanup] Stopping service discovery...")
        stop_discovery(discovery_zc)
        logger.info("Server stopped.")


if __name__ == '__main__':
    main()