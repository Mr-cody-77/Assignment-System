$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\Users\HP\OneDrive\Desktop\Start Assignment System.lnk")
$Shortcut.TargetPath = "C:\Users\HP\OneDrive\Desktop\Assignment_System\Assignment-System\.venv\Scripts\pythonw.exe"
$Shortcut.Arguments = "C:\Users\HP\OneDrive\Desktop\Assignment_System\Assignment-System\launcher.py"
$Shortcut.WorkingDirectory = "C:\Users\HP\OneDrive\Desktop\Assignment_System\Assignment-System"
$Shortcut.IconLocation = "shell32.dll, 43"
$Shortcut.Save()
