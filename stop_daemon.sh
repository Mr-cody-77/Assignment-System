#!/bin/bash
echo "==================================================="
echo "    Exam Lockdown Daemon - Stop Script (Ubuntu)    "
echo "==================================================="
echo

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "[INFO] Elevating privileges to root..."
  # Try pkexec for GUI prompt, fallback to sudo
  if command -v pkexec &> /dev/null; then
    pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY "$0" "$@"
  else
    sudo "$0" "$@"
  fi
  exit $?
fi

SERVICE_FILE="/etc/systemd/system/exam_lockdown.service"

echo "Stopping the ExamLockdownDaemon systemd service..."
if systemctl is-active --quiet exam_lockdown.service; then
    systemctl stop exam_lockdown.service
    systemctl disable exam_lockdown.service
    echo "[OK] Systemd service stopped and disabled."
else
    echo "[INFO] Systemd service is not currently running."
fi

SCRIPT_DIR=$(dirname "$(realpath "$0")")
PYTHON_EXE="$SCRIPT_DIR/.venv/bin/python"
if [ ! -f "$PYTHON_EXE" ]; then
    PYTHON_EXE=$(which python3)
fi

echo
echo "Ensuring internet access is unlocked..."
# Run python snippet to call unlock_internet()
"$PYTHON_EXE" -c "from lockdown_daemon import unlock_internet; unlock_internet()"

if [ $? -eq 0 ]; then
    echo "[OK] Firewall rules cleared. Internet unlocked."
else
    echo "[WARNING] Failed to unlock internet via python. Attempting fallback..."
    iptables -D OUTPUT -o lo -j ACCEPT 2>/dev/null
    iptables -D OUTPUT -d 192.168.0.0/16 -j ACCEPT 2>/dev/null
    iptables -D OUTPUT -d 10.0.0.0/8 -j ACCEPT 2>/dev/null
    iptables -D OUTPUT -d 172.16.0.0/12 -j ACCEPT 2>/dev/null
    iptables -D OUTPUT -j DROP 2>/dev/null
fi

echo
echo "Forcefully terminating any remaining lockdown_daemon.py processes..."
pkill -f lockdown_daemon.py 2>/dev/null

echo
echo "==================================================="
echo "  Daemon Stopped and Internet Unlocked!            "
echo "==================================================="
read -p "Press Enter to continue..."
