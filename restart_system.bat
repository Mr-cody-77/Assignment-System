@echo off
title CodeLab — Restarting
echo  Restarting CodeLab Assignment System...
call "%~dp0stop_system.bat"
timeout /t 2 /nobreak >nul
call "%~dp0start_system.bat"
