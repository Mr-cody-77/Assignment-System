import os
try:
    import win32com.client
    shell = win32com.client.Dispatch('WScript.Shell')
    shortcut = shell.CreateShortCut(r'C:\Users\HP\OneDrive\Desktop\Start Assignment System.lnk')
    print('Target:', shortcut.Targetpath)
    print('Args:', shortcut.Arguments)
except Exception as e:
    print('Error:', e)
