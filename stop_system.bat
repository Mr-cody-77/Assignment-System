@echo off
set SCRIPT_DIR=%~dp0
echo Stopping Assignment System (Centralized Database and React Frontend)...
echo.
"%SCRIPT_DIR%.venv\Scripts\python.exe" "%SCRIPT_DIR%stop_servers.py"
echo.
echo All background servers have been stopped.
pause
