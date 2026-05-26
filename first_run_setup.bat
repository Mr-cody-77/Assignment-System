@echo off
:: ============================================================
:: first_run_setup.bat — Run ONCE on first install (Teacher PC)
:: Sets up venv, installs all Python + Node deps,
:: builds the React SPA, copies it into Django, and inits DB.
:: ============================================================
title CodeLab — First Run Setup
color 0B

set ROOT=%~dp0
set BACKEND=%ROOT%Backend\System_Management
set FRONTEND=%ROOT%Frontend\system_interface
set VENV=%ROOT%venv

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║         CodeLab — First Time Setup                  ║
echo  ║  This will take 3-5 minutes. Please wait...         ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ─── 1. Python virtual environment ───────────────────────────
echo [1/7] Creating Python virtual environment...
python -m venv "%VENV%"
if %ERRORLEVEL% NEQ 0 (
    echo       [ERROR] Python not found! Install Python 3.11+ and retry.
    pause & exit /b 1
)
call "%VENV%\Scripts\activate.bat"
echo       Done.

:: ─── 2. Python dependencies ──────────────────────────────────
echo [2/7] Installing Python dependencies...
pip install --upgrade pip --quiet
pip install -r "%ROOT%Backend\requirements.txt"
if %ERRORLEVEL% NEQ 0 (
    echo       [ERROR] pip install failed. Check internet/firewall.
    pause & exit /b 1
)
echo       Done.

:: ─── 3. Node.js frontend dependencies ────────────────────────
echo [3/7] Installing frontend npm dependencies...
cd /d "%FRONTEND%"
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo       [ERROR] Node.js not found! Install Node.js 18+ and retry.
    pause & exit /b 1
)
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo       [ERROR] npm install failed.
    pause & exit /b 1
)
echo       Done.

:: ─── 4. Build React production bundle ────────────────────────
echo [4/7] Building React production bundle...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo       [ERROR] React build failed! Check errors above.
    pause & exit /b 1
)
echo       Done.

:: ─── 5. Copy React build → Django templates + static ─────────
echo [5/7] Copying React build to Django...
if not exist "%BACKEND%\templates"     mkdir "%BACKEND%\templates"
if not exist "%BACKEND%\static"        mkdir "%BACKEND%\static"
if not exist "%BACKEND%\staticfiles"   mkdir "%BACKEND%\staticfiles"

:: Copy index.html
copy /Y "%FRONTEND%\build\index.html" "%BACKEND%\templates\index.html" >nul
if %ERRORLEVEL% NEQ 0 (
    echo       [ERROR] Could not copy index.html
    pause & exit /b 1
)

:: Copy static assets (JS, CSS, media)
xcopy /E /Y /Q "%FRONTEND%\build\static\*" "%BACKEND%\staticfiles\" >nul

:: Collect static (merge app + React static)
cd /d "%BACKEND%"
python manage.py collectstatic --noinput >> "%ROOT%logs\static.log" 2>&1
echo       Done.

:: ─── 6. Create .env from template if missing ─────────────────
echo [6/7] Setting up environment config...
if not exist "%BACKEND%\.env" (
    if exist "%ROOT%.env.example" (
        copy /Y "%ROOT%.env.example" "%BACKEND%\.env" >nul
        echo       Created .env from template — edit it to set DB credentials.
    ) else (
        echo       [WARN] No .env.example found. Create %BACKEND%\.env manually.
    )
) else (
    echo       .env already exists. Skipping.
)

:: ─── 7. Initialize database ──────────────────────────────────
echo [7/7] Initializing PostgreSQL database...
cd /d "%ROOT%"
call "%VENV%\Scripts\python.exe" database\init_db.py
if %ERRORLEVEL% NEQ 0 (
    echo       [WARN] DB init had errors. Check that PostgreSQL is running
    echo             and your .env credentials are correct.
)
echo       Done.

:: ─── Done ────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   ✓ First-run setup complete!                       ║
echo  ║                                                      ║
echo  ║   Next step:  run  start_system.bat                 ║
echo  ║   Login:      admin / Admin@1234                    ║
echo  ║   Change the password after first login!            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
