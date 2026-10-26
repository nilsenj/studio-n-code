$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$executable = Join-Path $projectRoot 'upstream/.build/electron/studio-n-code.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Build studio-n-code before creating its shortcut.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $projectRoot 'studio-n-code.lnk'))
$shortcut.TargetPath = $env:ComSpec
$shortcut.Arguments = '/c ""' + (Join-Path $projectRoot 'Start studio-n-code.cmd') + '""'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = $executable + ',0'
$shortcut.Description = 'studio-n-code'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Output 'Created studio-n-code.lnk in the project directory.'
