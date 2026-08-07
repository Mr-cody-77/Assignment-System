#!/bin/bash
echo "==================================================="
echo "    Assignment System - Automated Setup (Ubuntu)   "
echo "==================================================="
echo

# 1. Check for Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python 3 is not installed or not in PATH."
    exit 1
fi
echo "[OK] Python found: $PYTHON_CMD"

# 2. Check for Node.js (npm)
if ! command -v npm &> /dev/null; then
    echo "[ERROR] Node.js (npm) is not installed. Please install Node.js."
    exit 1
fi
echo "[OK] Node.js and npm found."

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR" || exit

echo
echo "=== 1. Setting up Python Virtual Environment ==="
if [ ! -d ".venv" ]; then
    $PYTHON_CMD -m venv .venv
    echo "[OK] Virtual environment created."
else
    echo "[INFO] Virtual environment already exists."
fi

VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python"

echo
echo "=== 2. Installing Backend Dependencies ==="
"$VENV_PYTHON" -m pip install --no-cache-dir --upgrade pip
"$VENV_PYTHON" -m pip install --no-cache-dir -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install python requirements."
    exit 1
fi
echo "[OK] Backend dependencies installed."

echo
echo "=== 3. Installing Frontend Dependencies ==="
if [ -d "Frontend/system_interface" ]; then
    cd Frontend/system_interface || exit
    npm install
    cd ../..
fi
echo "[OK] Frontend dependencies installed."

echo
echo "=== 4. Installing the Lockdown Daemon ==="
# Ensure install_daemon.sh is executable and run it
chmod +x install_daemon.sh
./install_daemon.sh

echo
echo "=== 5. Creating Desktop Shortcut ==="
DESKTOP_FILE="$HOME/Desktop/Assignment System.desktop"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Name=Assignment System
Comment=Start the Assignment System
Exec=bash -c "cd '$SCRIPT_DIR' && '$VENV_PYTHON' launcher.py"
Icon=utilities-terminal
Terminal=true
Type=Application
Categories=Application;
EOF
chmod +x "$DESKTOP_FILE"
echo "[OK] Desktop shortcut created at $DESKTOP_FILE"

echo
echo "==================================================="
echo "   Setup Complete! You can now use the Desktop     "
echo "   shortcut 'Assignment System' to launch it!      "
echo "==================================================="
read -p "Press Enter to exit..."
