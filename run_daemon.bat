@echo off
cd /d "%~dp0"
.\.venv\Scripts\python.exe lockdown_daemon.py > debug_daemon.log 2>&1
