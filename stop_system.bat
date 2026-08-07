@echo off
echo Stopping Assignment System (Centralized Database and React Frontend)...
echo.
taskkill /F /IM node.exe /T
taskkill /F /IM python.exe /T
echo.
echo All background servers have been stopped.
pause
