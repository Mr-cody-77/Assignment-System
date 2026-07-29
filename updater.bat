@echo off
echo Checking for updates...

:: Get current directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

if not exist ".git" (
    echo [INFO] This folder is not a git repository. Skipping updates.
    exit /b 0
)

:: Get current commit hash
for /f %%i in ('git rev-parse HEAD 2^>nul') do set OLD_HASH=%%i

:: Pull latest code
git pull origin main

:: Get new commit hash
for /f %%i in ('git rev-parse HEAD 2^>nul') do set NEW_HASH=%%i

if "%OLD_HASH%"=="%NEW_HASH%" (
    echo [INFO] System is up to date.
    exit /b 0
)

echo [INFO] Updates downloaded! Installing any new dependencies...

:: Update python packages
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
) else (
    python -m pip install -r requirements.txt
)

:: Update frontend packages
if exist "Frontend\system_interface\package.json" (
    cd Frontend\system_interface
    call npm install
    cd ..\..
)

echo [INFO] Update complete!
exit /b 0
