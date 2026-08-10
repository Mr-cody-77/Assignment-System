#!/bin/bash
SCRIPT_DIR=$(dirname "$(realpath "$0")")
echo "Stopping Assignment System (Centralized Database and React Frontend)..."
echo

# Kill python and node processes gracefully based on their ports
"$SCRIPT_DIR/.venv/bin/python" "$SCRIPT_DIR/stop_servers.py"

echo
echo "All background servers have been stopped."
read -p "Press Enter to exit..."
