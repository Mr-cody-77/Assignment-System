@echo off
echo Installing Exam Lockdown Daemon...

:: Check for administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator privileges confirmed.
) else (
    echo Elevating privileges to Administrator...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~s0\"' -Verb RunAs"
    exit /b
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
set UPDATER_SCRIPT=%SCRIPT_DIR%auto_updater.py

:: Create scheduled tasks
:: Daemon needs SYSTEM privileges on startup
schtasks /create /tn "ExamLockdownDaemon" /tr "\"%PYTHON_EXE%\" \"%DAEMON_SCRIPT%\"" /sc onstart /ru SYSTEM /rl HIGHEST /f
:: Updater needs to run as the normal user to avoid git/npm permission issues
schtasks /create /tn "AssignmentSystemUpdater" /tr "\"%PYTHON_EXE%\" \"%UPDATER_SCRIPT%\"" /sc onlogon /f

if %errorLevel% == 0 (
    echo Configuring tasks to run on battery power...
    powershell -Command "Set-ScheduledTask -TaskName 'ExamLockdownDaemon' -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0)"
    powershell -Command "Set-ScheduledTask -TaskName 'AssignmentSystemUpdater' -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0)"
    echo Daemon and Updater installed successfully.
    echo Starting the daemon and updater now...
    schtasks /run /tn "ExamLockdownDaemon"
    schtasks /run /tn "AssignmentSystemUpdater"
) else (
    echo Failed to install the daemon.
)

pause
