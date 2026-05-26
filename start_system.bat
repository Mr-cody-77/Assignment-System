@echo off
setlocal EnableDelayedExpansion
:: ============================================================
:: start_system.bat — One-Click Launcher
:: Assignment System — Decentralized Coding Evaluation
:: ============================================================
title CodeLab Assignment System — Startup
color 0A

set ROOT=%~dp0
set BACKEND=%ROOT%Backend\System_Management
set FRONTEND=%ROOT%Frontend\system_interface
set SERVICES=%ROOT%Services
set LOGS=%ROOT%logs
set VENV=%ROOT%venv

:: Create logs directory
if not exist "%LOGS%" mkdir "%LOGS%"

echo.
echo  ╔════════════════════════════════════════════════════════╗
echo  ║       CodeLab — Decentralized Assignment System       ║
echo  ║              Starting All Services...                 ║
echo  ╚════════════════════════════════════════════════════════╝
echo.

:: ─── Step 1: Check/Start PostgreSQL ──────────────────────────
echo  [1/7] Checking PostgreSQL...
sc query postgresql-x64-16 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    sc start postgresql-x64-16 >nul 2>&1
    echo       PostgreSQL-16 started.
    goto :pg_ok
)
sc query postgresql-x64-15 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    sc start postgresql-x64-15 >nul 2>&1
    echo       PostgreSQL-15 started.
    goto :pg_ok
)
sc query postgresql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    sc start postgresql >nul 2>&1
    echo       PostgreSQL started.
    goto :pg_ok
)
echo       [WARN] PostgreSQL service not found. Attempting to continue...
:pg_ok
timeout /t 3 /nobreak >nul

:: ─── Step 2: Activate Virtual Environment ────────────────────
echo  [2/7] Activating Python virtual environment...
if exist "%VENV%\Scripts\activate.bat" (
    call "%VENV%\Scripts\activate.bat"
    echo       venv activated.
) else (
    echo       [WARN] No venv found. Using system Python.
)

:: ─── Step 3: Install Python dependencies (first run) ─────────
if not exist "%ROOT%.deps_installed" (
    echo  [3/7] Installing Python dependencies ^(first run^)...
    pip install -r "%ROOT%Backend\requirements.txt" --quiet
    echo. > "%ROOT%.deps_installed"
    echo       Dependencies installed.
) else (
    echo  [3/7] Dependencies already installed. Skipping.
)

:: ─── Step 4: Run Django Migrations ───────────────────────────
echo  [4/7] Running database migrations...
cd /d "%BACKEND%"
python manage.py migrate --run-syncdb >> "%LOGS%\migration.log" 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo       [WARN] Migration failed — check logs\migration.log
) else (
    echo       Migrations applied.
)

:: Collect static files (only if React build exists)
if exist "%FRONTEND%\build\index.html" (
    echo       Collecting static files...
    python manage.py collectstatic --noinput >> "%LOGS%\static.log" 2>&1
)

:: ─── Step 5: Start All Services ──────────────────────────────
echo  [5/7] Starting services...

:: Django Backend (waitress for Windows — production WSGI server)
echo       Starting Django backend on port 8000...
start "Django Backend" /min cmd /c "cd /d %BACKEND% && python -m waitress --listen=0.0.0.0:8000 System_Management.wsgi:application >> %LOGS%\django.log 2>&1"
timeout /t 2 /nobreak >nul

:: Zeroconf Discovery Service (registers this node on the LAN)
echo       Starting Zeroconf discovery service...
start "Node Discovery" /min cmd /c "cd /d %SERVICES% && python discovery_service.py >> %LOGS%\discovery.log 2>&1"
timeout /t 1 /nobreak >nul

:: Sender / Dispatcher Service (distributes tasks to worker nodes)
echo       Starting task dispatcher ^(Sender Server^)...
start "Task Dispatcher" /min cmd /c "cd /d %SERVICES%\Sender_Server && python main.py >> %LOGS%\sender.log 2>&1"
timeout /t 1 /nobreak >nul

:: Worker Engine / Receiver Server (executes code on this node)
echo       Starting worker execution engine ^(Receiver Server^)...
start "Worker Engine" /min cmd /c "cd /d %SERVICES%\Receiver_Server && python main.py >> %LOGS%\receiver.log 2>&1"
timeout /t 1 /nobreak >nul

echo  [6/7] All services started successfully.

:: ─── Step 6: Open Browser ────────────────────────────────────
echo  [7/7] Opening browser...
timeout /t 4 /nobreak >nul
start "" "http://localhost:8000"

echo.
echo  ╔════════════════════════════════════════════════════════╗
echo  ║   ✓ CodeLab is running at http://localhost:8000       ║
echo  ║                                                        ║
echo  ║   Services:    Django · Discovery · Sender · Worker   ║
echo  ║   Default login:   admin / Admin@1234                 ║
echo  ║   Stop system:     run stop_system.bat                ║
echo  ║   Logs directory:  logs\                              ║
echo  ╚════════════════════════════════════════════════════════╝
echo.
echo  Press any key to minimize this window...
pause >nul
exit
