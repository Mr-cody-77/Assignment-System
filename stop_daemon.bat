@echo off
echo ===================================================
echo     Exam Lockdown Daemon - Stop Script
echo ===================================================
echo.

:: Check for administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Administrator privileges confirmed.
) else (
    echo [INFO] Elevating privileges to Administrator...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~s0\"' -Verb RunAs"
    exit /b
)

:: Get current directory
set SCRIPT_DIR=%~dp0

:: Find Python executable
set PYTHON_EXE=%SCRIPT_DIR%.venv\Scripts\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)

echo.
echo Stopping the ExamLockdownDaemon scheduled task...
schtasks /end /tn "ExamLockdownDaemon" >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Scheduled task stopped.
) else (
    echo [INFO] Scheduled task is not currently running.
)

echo.
echo Ensuring internet access is unlocked...
:: Run a small python snippet to call unlock_internet() from lockdown_daemon
"%PYTHON_EXE%" -c "from lockdown_daemon import unlock_internet; unlock_internet()"
if %errorLevel% == 0 (
    echo [OK] Firewall rules cleared. Internet unlocked.
) else (
    echo [WARNING] Failed to unlock internet via python. Attempting fallback...
    powershell -Command "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockInternet' -ErrorAction SilentlyContinue; Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -ErrorAction SilentlyContinue; Remove-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -ErrorAction SilentlyContinue"
)

echo.
echo Forcefully terminating any remaining lockdown_daemon processes...
:: Use WMI to find and kill python processes running lockdown_daemon.py
wmic process where "name='python.exe' and commandline like '%%lockdown_daemon.py%%'" call terminate >nul 2>&1

echo.
echo ===================================================
echo   Daemon Stopped and Internet Unlocked!
echo ===================================================
pause
