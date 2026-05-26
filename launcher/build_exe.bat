@echo off
:: ============================================================
:: Build CodeLab.exe using PyInstaller
:: Run from project root: launcher\build_exe.bat
:: ============================================================
title Building CodeLab.exe

cd /d "%~dp0"

echo [1/3] Installing PyInstaller...
pip install pyinstaller --quiet

echo [2/3] Building executable...
pyinstaller launcher.spec --clean --noconfirm

echo [3/3] Build complete!
echo.
echo Executable: dist\CodeLab\CodeLab.exe
echo.
pause
