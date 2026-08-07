#!/bin/bash
echo "Stopping Assignment System (Centralized Database and React Frontend)..."
echo

# Kill python and node processes gracefully
pkill -f node
pkill -f python3
pkill -f python

echo
echo "All background servers have been stopped."
read -p "Press Enter to exit..."
