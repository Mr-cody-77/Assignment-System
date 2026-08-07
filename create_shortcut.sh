#!/bin/bash
SCRIPT_DIR=$(dirname "$(realpath "$0")")
DESKTOP_FILE="$HOME/Desktop/Assignment System.desktop"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Name=Assignment System
Comment=Start the Assignment System
Exec=bash -c "cd '$SCRIPT_DIR' && '$SCRIPT_DIR/.venv/bin/python' launcher.py"
Icon=utilities-terminal
Terminal=true
Type=Application
Categories=Application;
EOF
chmod +x "$DESKTOP_FILE"
echo "Shortcut created on your desktop successfully!"
