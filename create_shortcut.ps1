$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Start Assignment System.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

$ScriptDir = $PSScriptRoot
$Shortcut.TargetPath = Join-Path $ScriptDir ".venv\Scripts\pythonw.exe"
$Shortcut.Arguments = """$($ScriptDir)\launcher.py"""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.IconLocation = "shell32.dll, 43"
$Shortcut.Save()
