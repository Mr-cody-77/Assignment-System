@echo off
echo Installing Exam Lockdown Daemon...

:: Check for administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator privileges confirmed.
) else (
    echo Failure: Current permissions inadequate. Please run this script as Administrator.
    pause
    exit /b 1
)

:: Get current directory
set SCRIPT_DIR=%~dp0
:: Python executable from venv (assuming standard location, or could just use 'python' if in PATH)
:: But to be safe, let's assume python is in PATH or we use the venv
set PYTHON_EXE=%SCRIPT_DIR%.venv\Scripts\python.exe

if not exist "%PYTHON_EXE%" (
    echo Virtual environment not found at %SCRIPT_DIR%.venv
    echo Assuming python is in global PATH.
    set PYTHON_EXE=python
)

set DAEMON_SCRIPT=%SCRIPT_DIR%lockdown_daemon.py

:: Create scheduled task running as SYSTEM on startup
schtasks /create /tn "ExamLockdownDaemon" /tr "\"%PYTHON_EXE%\" \"%DAEMON_SCRIPT%\"" /sc onstart /ru SYSTEM /rl HIGHEST /f

if %errorLevel% == 0 (
    echo Configuring task to run on battery power...
    powershell -Command "Set-ScheduledTask -TaskName 'ExamLockdownDaemon' -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0)"
    echo Daemon installed successfully.
    echo Starting the daemon now...
    schtasks /run /tn "ExamLockdownDaemon"
) else (
    echo Failed to install the daemon.
)

pause
