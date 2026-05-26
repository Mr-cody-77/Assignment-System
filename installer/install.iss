; ============================================================
; Inno Setup Installer Script
; CodeLab — Decentralized Assignment Evaluation System
; ============================================================

[Setup]
AppName=CodeLab Assignment System
AppVersion=1.0.0
AppPublisher=College Computer Lab
AppPublisherURL=http://localhost:8000
DefaultDirName={autopf}\CodeLab
DefaultGroupName=CodeLab
OutputDir=..\dist\installer
OutputBaseFilename=CodeLab_Setup_v1.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
SetupIconFile=..\configs\icon.ico
UninstallDisplayIcon={app}\CodeLab.exe
DisableProgramGroupPage=no
AllowNoIcons=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";     Description: "Create &desktop shortcut";    GroupDescription: "Shortcuts:"; Flags: unchecked
Name: "startmenuicon";   Description: "Create &Start Menu shortcut"; GroupDescription: "Shortcuts:"
Name: "autostart";       Description: "Auto-start on Windows boot";  GroupDescription: "Startup:"; Flags: unchecked

[Files]
; Main application (PyInstaller bundle)
Source: "..\launcher\dist\CodeLab\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Backend source (for migrations/manage.py)
Source: "..\Backend\*";  DestDir: "{app}\Backend";  Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\Services\*"; DestDir: "{app}\Services"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\database\*"; DestDir: "{app}\database"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\configs\*";  DestDir: "{app}\configs";  Flags: ignoreversion recursesubdirs createallsubdirs

; Batch scripts
Source: "..\start_system.bat";   DestDir: "{app}"; Flags: ignoreversion
Source: "..\stop_system.bat";    DestDir: "{app}"; Flags: ignoreversion
Source: "..\restart_system.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\.env.example";       DestDir: "{app}"; DestName: ".env.example"; Flags: ignoreversion

[Icons]
Name: "{group}\CodeLab";              Filename: "{app}\CodeLab.exe"; Comment: "Start CodeLab Assignment System"
Name: "{group}\Stop CodeLab";         Filename: "{app}\stop_system.bat"
Name: "{group}\Open CodeLab in Browser"; Filename: "http://localhost:8000"
Name: "{group}\Uninstall CodeLab";    Filename: "{uninstallexe}"
Name: "{autodesktop}\CodeLab";        Filename: "{app}\CodeLab.exe"; Tasks: desktopicon

[Registry]
; Auto-start on Windows boot
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "CodeLabAssignmentSystem"; \
  ValueData: """{app}\CodeLab.exe"""; \
  Flags: uninsdeletevalue; Tasks: autostart

[Run]
; Initialize DB after install
Filename: "{app}\database\setup_postgres.bat"; \
  Description: "Set up PostgreSQL database"; \
  StatusMsg: "Initializing database..."; \
  Flags: postinstall skipifsilent runascurrentuser

Filename: "{app}\CodeLab.exe"; \
  Description: "Launch CodeLab now"; \
  StatusMsg: "Starting CodeLab..."; \
  Flags: postinstall skipifsilent nowait

[UninstallRun]
Filename: "{app}\stop_system.bat"; RunOnceId: "StopServices"

[Code]
// Check for Python and PostgreSQL prerequisites
function InitializeSetup(): Boolean;
begin
  Result := True;
  // Additional pre-install checks can go here
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    // Copy .env.example to .env if .env doesn't exist
    if not FileExists(ExpandConstant('{app}\.env')) then
      FileCopy(ExpandConstant('{app}\.env.example'), ExpandConstant('{app}\.env'), False);
  end;
end;
