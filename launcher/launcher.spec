# -*- mode: python ; coding: utf-8 -*-
# ============================================================
# PyInstaller spec file for CodeLab Launcher
# Build: pyinstaller launcher.spec
# Output: dist/CodeLab.exe
# ============================================================

from PyInstaller.utils.hooks import collect_all

block_cipher = None

# Collect zeroconf and its deps
zeroconf_datas, zeroconf_binaries, zeroconf_hiddenimports = collect_all('zeroconf')
waitress_datas, waitress_binaries, waitress_hiddenimports = collect_all('waitress')

a = Analysis(
    ['launcher.py'],
    pathex=['.'],
    binaries=zeroconf_binaries + waitress_binaries,
    datas=[
        ('../Backend', 'Backend'),
        ('../Services', 'Services'),
        ('../Frontend/system_interface/build', 'Frontend/system_interface/build'),
        ('../configs', 'configs'),
    ] + zeroconf_datas + waitress_datas,
    hiddenimports=[
        'zeroconf', 'zeroconf._utils', 'zeroconf._handlers',
        'waitress', 'waitress.server', 'waitress.task',
        'psutil', 'psycopg2', 'django', 'rest_framework',
        'rest_framework_simplejwt', 'corsheaders', 'drf_spectacular',
        'whitenoise', 'dotenv',
        'api', 'api.models', 'api.views', 'api.serializers',
        'api.services.execution_engine', 'api.services.load_balancer',
        'api.services.task_ingestion',
        'System_Management.settings', 'System_Management.wsgi',
    ] + zeroconf_hiddenimports + waitress_hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='CodeLab',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,           # No console window — runs silently
    disable_windowed_traceback=False,
    icon='../configs/icon.ico' if os.path.exists('../configs/icon.ico') else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='CodeLab',
)
