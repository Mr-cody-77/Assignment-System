#!/bin/bash
echo "Installing Exam Lockdown Daemon for Ubuntu..."

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Elevating privileges to root..."
  # Try pkexec for GUI prompt, fallback to sudo
  if command -v pkexec &> /dev/null; then
    pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY "$0" "$@"
  else
    sudo "$0" "$@"
  fi
  exit $?
fi

SCRIPT_DIR=$(dirname "$(realpath "$0")")
PYTHON_EXE="$SCRIPT_DIR/.venv/bin/python"

if [ ! -f "$PYTHON_EXE" ]; then
    echo "Virtual environment not found at $SCRIPT_DIR/.venv"
    echo "Assuming python3 is in global PATH."
    PYTHON_EXE=$(which python3)
fi

DAEMON_SCRIPT="$SCRIPT_DIR/lockdown_daemon.py"
SERVICE_FILE="/etc/systemd/system/exam_lockdown.service"

echo "Creating systemd service file..."
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Exam Lockdown Daemon
After=network.target

[Service]
ExecStart=$PYTHON_EXE $DAEMON_SCRIPT
WorkingDirectory=$SCRIPT_DIR
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling and starting the Exam Lockdown Daemon..."
systemctl enable exam_lockdown.service
systemctl restart exam_lockdown.service

echo "Daemon installed and started successfully!"
read -p "Press Enter to continue..."
