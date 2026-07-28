"""
lockdown.py
System-wide internet lockdown using Windows Defender Firewall.

This module provides functions to block and unblock outbound internet traffic
on Windows, while allowing local loopback and specific LAN addresses/ports
for the Assignment System to function.

Security:
- The UAC admin password is received encrypted (XOR + base64) from the
  Centralized Database and decrypted in-memory only when needed.
- The password is never written to disk on the student machine.
- Firewall rules persist across reboots until explicitly removed.
"""

import base64
import ctypes
import logging
import os
import subprocess
import sys

logger = logging.getLogger("lockdown")

EXAM_CIPHER_KEY = "SystemSecureExamKey77!"

RULE_BLOCK_ALL = "ExamSystem_BlockAll"
RULE_ALLOW_LOOPBACK = "ExamSystem_AllowLoopback"
RULE_ALLOW_DB = "ExamSystem_AllowDB"
LOCKDOWN_FLAG = ".lockdown_active"


def xor_decrypt(encrypted_b64: str, key: str = EXAM_CIPHER_KEY) -> str:
    """Decrypt a base64-encoded XOR-encrypted string."""
    encrypted_bytes = base64.b64decode(encrypted_b64)
    decrypted = "".join(
        chr(b ^ ord(key[i % len(key)]))
        for i, b in enumerate(encrypted_bytes)
    )
    return decrypted


def is_admin() -> bool:
    """Check if the current process has Administrator privileges."""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False


def _run_ps(command: str) -> tuple:
    """Run a PowerShell command and return (success, output)."""
    try:
        result = subprocess.run(
            ["powershell", "-Command", command],
            capture_output=True,
            text=True,
            timeout=30,
        )
        success = result.returncode == 0
        output = result.stdout.strip() or result.stderr.strip()
        if not success:
            logger.error(f"PowerShell error: {output}")
        return success, output
    except subprocess.TimeoutExpired:
        logger.error("PowerShell command timed out")
        return False, "Command timed out"
    except Exception as e:
        logger.error(f"PowerShell execution failed: {e}")
        return False, str(e)


def _run_ps_elevated(command: str, password: str = None) -> tuple:
    """Run a PowerShell command, elevating privileges if necessary."""
    if is_admin():
        return _run_ps(command)
    
    # Base64 encode the command to avoid any quoting or parsing errors when passing to Start-Process
    script_bytes = command.encode('utf-16-le')
    script_b64 = base64.b64encode(script_bytes).decode('utf-8')
    
    ps_cmd = f"Start-Process -FilePath powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-EncodedCommand {script_b64}' -Wait"
        
    return _run_ps(ps_cmd)

def _rules_exist() -> bool:
    """Check if any ExamSystem firewall rules are currently active."""
    ok, output = _run_ps(
        f'Get-NetFirewallRule -DisplayName "{RULE_BLOCK_ALL}" -ErrorAction SilentlyContinue'
    )
    return ok and RULE_BLOCK_ALL in output


def enable_lockdown(db_ip: str = None, db_port: int = 8000, admin_password: str = None) -> dict:
    """
    Block all outbound internet traffic except:
    1. Loopback (127.0.0.1) - for React <-> Django local communication
    2. Specific DB server IP on its port - for LAN database access

    Returns a dict with status and message.
    """
    script = (
        f"Remove-NetFirewallRule -DisplayName '{RULE_BLOCK_ALL}' -ErrorAction SilentlyContinue; "
        f"Remove-NetFirewallRule -DisplayName '{RULE_ALLOW_LOOPBACK}' -ErrorAction SilentlyContinue; "
        f"Remove-NetFirewallRule -DisplayName '{RULE_ALLOW_DB}' -ErrorAction SilentlyContinue; "
        f"New-NetFirewallRule -DisplayName '{RULE_BLOCK_ALL}' -Direction Outbound -Action Block -Enabled True; "
        f"New-NetFirewallRule -DisplayName '{RULE_ALLOW_LOOPBACK}' -Direction Outbound -Action Allow -RemoteAddress '127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '224.0.0.0/4', '255.255.255.255' -Enabled True; "
    )
    if db_ip:
        script += f"New-NetFirewallRule -DisplayName '{RULE_ALLOW_DB}' -Direction Outbound -Action Allow -RemoteAddress '{db_ip}' -RemotePort '{db_port}' -Protocol TCP -Enabled True;"
    
    _run_ps_elevated(script, admin_password)
    
    if not _rules_exist():
        return {"success": False, "error": "UAC prompt was denied or firewall rules could not be created."}

    # Write lockdown flag file
    try:
        flag_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), LOCKDOWN_FLAG
        )
        with open(flag_path, "w") as f:
            f.write("locked")
    except Exception:
        pass

    logger.info("Internet lockdown ENABLED")
    return {"success": True, "message": "Internet lockdown enabled"}


def disable_lockdown(admin_password: str = None) -> dict:
    """
    Remove all ExamSystem firewall rules, restoring full internet access.

    Returns a dict with status and message.
    """
    _cleanup_rules(admin_password)

    if _rules_exist():
        return {"success": False, "error": "UAC prompt was denied or firewall rules could not be removed."}

    # Remove lockdown flag file
    try:
        flag_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), LOCKDOWN_FLAG
        )
        if os.path.exists(flag_path):
            os.remove(flag_path)
    except Exception:
        pass

    logger.info("Internet lockdown DISABLED")
    return {"success": True, "message": "Internet lockdown disabled"}


def _cleanup_rules(admin_password: str = None):
    """Remove all ExamSystem_* firewall rules."""
    script = (
        f"Remove-NetFirewallRule -DisplayName '{RULE_BLOCK_ALL}' -ErrorAction SilentlyContinue; "
        f"Remove-NetFirewallRule -DisplayName '{RULE_ALLOW_LOOPBACK}' -ErrorAction SilentlyContinue; "
        f"Remove-NetFirewallRule -DisplayName '{RULE_ALLOW_DB}' -ErrorAction SilentlyContinue;"
    )
    _run_ps_elevated(script, admin_password)


def is_locked() -> bool:
    """Check if the lockdown is currently active."""
    return _rules_exist()
