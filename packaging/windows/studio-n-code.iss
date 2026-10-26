#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef AppSource
  #error AppSource is required
#endif
#ifndef ReleaseOutput
  #error ReleaseOutput is required
#endif

[Setup]
AppId={{0C61E089-5602-4C40-81FD-085EC5C033A1}
AppName=studio-n-code
AppVersion={#AppVersion}
AppVerName=studio-n-code {#AppVersion}
AppPublisher=studio-n-code contributors
AppPublisherURL=https://github.com/nilsenj/studio-n-code
AppSupportURL=https://github.com/nilsenj/studio-n-code/issues
AppUpdatesURL=https://github.com/nilsenj/studio-n-code/releases
DefaultDirName={localappdata}\Programs\studio-n-code
DefaultGroupName=studio-n-code
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
SetupIconFile=..\..\assets\icon.ico
UninstallDisplayIcon={app}\studio-n-code.exe,0
UninstallDisplayName=studio-n-code
OutputDir={#ReleaseOutput}
OutputBaseFilename=studio-n-code-{#AppVersion}-windows-x64-setup
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
VersionInfoCompany=studio-n-code contributors
VersionInfoDescription=studio-n-code Setup
VersionInfoProductName=studio-n-code
VersionInfoProductVersion={#AppVersion}

[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "{#AppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\studio-n-code"; Filename: "{app}\studio-n-code.exe"; IconFilename: "{app}\studio-n-code.exe"; AppUserModelID: "StudioNCode.Editor"
Name: "{autodesktop}\studio-n-code"; Filename: "{app}\studio-n-code.exe"; IconFilename: "{app}\studio-n-code.exe"; AppUserModelID: "StudioNCode.Editor"; Tasks: desktopicon

[Run]
Filename: "{app}\studio-n-code.exe"; Description: "Launch studio-n-code"; Flags: nowait postinstall skipifsilent
