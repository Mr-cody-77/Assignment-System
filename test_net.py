import subprocess

script_lock = "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -ErrorAction SilentlyContinue; Remove-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -Direction Outbound -Action Block -Enabled True; New-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -Direction Outbound -Action Allow -RemoteAddress '127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '224.0.0.0/4', '255.255.255.255' -Enabled True;"

print("Testing lock_internet...")
res1 = subprocess.run(['powershell', '-Command', script_lock], capture_output=True, text=True)
print(f"lock returncode: {res1.returncode}")
print(f"lock stdout: {repr(res1.stdout)}")
print(f"lock stderr: {repr(res1.stderr)}")

script_unlock = "Remove-NetFirewallRule -DisplayName 'ExamSystem_BlockAll' -ErrorAction SilentlyContinue; Remove-NetFirewallRule -DisplayName 'ExamSystem_AllowLAN' -ErrorAction SilentlyContinue"
print("\nTesting unlock_internet...")
res2 = subprocess.run(['powershell', '-Command', script_unlock], capture_output=True, text=True)
print(f"unlock returncode: {res2.returncode}")
print(f"unlock stdout: {repr(res2.stdout)}")
print(f"unlock stderr: {repr(res2.stderr)}")
