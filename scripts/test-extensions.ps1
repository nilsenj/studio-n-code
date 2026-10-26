param([Parameter(Mandatory=$true)][string]$Application, [string]$ProfileName = 'extension-compatibility')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$app = [IO.Path]::GetFullPath($Application)
$cli = Join-Path $app 'bin/studio-n-code.cmd'
if ($ProfileName -notmatch '^extension-compatibility(?:-[a-z0-9-]+)?$') { throw 'Invalid compatibility profile name.' }
$profile = Join-Path $projectRoot ".runtime/$ProfileName"
$data = Join-Path $profile 'data'
$extensions = Join-Path $profile 'extensions'
foreach ($id in @('esbenp.prettier-vscode','EditorConfig.EditorConfig','dracula-theme.theme-dracula')) {
    & $cli --user-data-dir $data --extensions-dir $extensions --install-extension $id
    if ($LASTEXITCODE -ne 0) { throw "Extension installation failed: $id" }
}
# Exercise local VSIX installation as well as the registry route.
$vsix = Join-Path $profile 'theme.vsix'
$theme = Invoke-RestMethod 'https://open-vsx.org/api/dracula-theme/theme-dracula/2.25.1'
Invoke-WebRequest $theme.files.download -OutFile $vsix
& $cli --user-data-dir $data --extensions-dir $extensions --install-extension $vsix --force
if ($LASTEXITCODE -ne 0) { throw 'Local VSIX installation failed.' }
Push-Location $projectRoot
try {
    & node scripts/create-fixture.mjs
    $fixture = (Get-Content artifacts/fixture-path.txt -Raw).Trim()
    $arguments = @('--user-data-dir', $data, '--extensions-dir', $extensions, '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--extensionDevelopmentPath', (Join-Path $projectRoot 'tests/extensions-smoke'), '--extensionTestsPath', (Join-Path $projectRoot 'tests/extensions-smoke/test.cjs'), $fixture)
    $env:ELECTRON_RUN_AS_NODE = $null
    $started = Get-Date
    & (Join-Path $app 'studio-n-code.exe') @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Extension activation/formatting checks failed.' }
    $resultPath = Join-Path $projectRoot 'artifacts/extensions-results.json'
    $deadline = (Get-Date).AddMinutes(2)
    do {
        $result = Get-Item -LiteralPath $resultPath -ErrorAction SilentlyContinue
        if ($result -and $result.LastWriteTime -ge $started) { break }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    if (-not $result -or $result.LastWriteTime -lt $started) { throw 'The extension host did not produce fresh compatibility results.' }
} finally { Pop-Location }
