@echo off
:: ============================================================
:: stop_system.bat — Gracefully stop all CodeLab services
:: ============================================================
title CodeLab — Stop System
color 0C

echo.
echo  Stopping CodeLab Assignment System...
echo.

:: Kill all named windows started by start_system.bat
taskkill /fi "WINDOWTITLE eq Django Backend"   /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Node Discovery"   /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Task Dispatcher"  /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Worker Engine"    /f >nul 2>&1

:: Also kill any stray Python processes running our scripts (safe fallback)
:: Comment these out if you have other Python processes you want to keep.
:: wmic process where "commandline like '%%waitress%%'" delete >nul 2>&1
:: wmic process where "commandline like '%%discovery_service%%'" delete >nul 2>&1

echo  ✓ All services stopped.
echo.
pause
exit
