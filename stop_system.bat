@echo off
echo Stopping Assignment System (Centralized Database and React Frontend)...
echo.
taskkill /F /IM python.exe /T
taskkill /F /IM node.exe /T
echo.
echo All background servers have been stopped.
pause
