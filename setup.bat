@echo off
echo ===================================================
echo     Assignment System - Automated Setup Script
echo ===================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Administrator privileges confirmed.
) else (
    echo [ERROR] Please right-click this script and select "Run as Administrator".
    pause
    exit /b 1
)

:: Check for Python
set PYTHON_CMD=
python --version >nul 2>&1
if %errorLevel% == 0 set PYTHON_CMD=python

if not "%PYTHON_CMD%"=="" goto python_found

py --version >nul 2>&1
if %errorLevel% == 0 set PYTHON_CMD=py

if not "%PYTHON_CMD%"=="" goto python_found

python3 --version >nul 2>&1
if %errorLevel% == 0 set PYTHON_CMD=python3

if not "%PYTHON_CMD%"=="" goto python_found

echo [ERROR] Python is not installed, or not in the Administrator PATH.
echo TIP: If you just installed Python, try restarting your PC.
echo TIP: Make sure you checked "Add Python to PATH" AND "Install for all users" during installation.
pause
exit /b 1

:python_found
echo [OK] Python found using command: %PYTHON_CMD%
:: Check for Node.js (npm)
call npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js or npm is not installed or not in PATH. Please install Node.js.
    pause
    exit /b 1
)
echo [OK] Node.js and npm found.

:: Get current directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo.
echo === 1. Setting up Python Virtual Environment ===
if not exist ".venv" (
    %PYTHON_CMD% -m venv .venv
    echo [OK] Virtual environment created.
) else (
    echo [INFO] Virtual environment already exists.
)

echo.
echo === 2. Installing Backend Dependencies ===
".venv\Scripts\python.exe" -m pip install --upgrade pip
if %errorLevel% neq 0 (
    echo [WARNING] The virtual environment appears to be corrupted or invalid (possibly copied from another computer).
    echo [INFO] Recreating the virtual environment...
    rmdir /s /q ".venv"
    %PYTHON_CMD% -m venv .venv
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
)

".venv\Scripts\python.exe" -m pip install -r requirements.txt
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install python requirements.
    pause
    exit /b 1
)

echo.
echo === 3. Installing Frontend Dependencies ===
if exist "Frontend\system_interface" (
    cd Frontend\system_interface
    call npm install
    cd ..\..
)

echo.
echo === 4. Installing the Lockdown Daemon ===
call install_daemon.bat

echo.
echo === 5. Creating Desktop Shortcut ===
powershell -ExecutionPolicy Bypass -File create_shortcut.ps1

echo.
echo ===================================================
echo   Setup Complete! You can now use the Desktop
echo   shortcut "Start Assignment System" to launch it!
echo ===================================================
pause
