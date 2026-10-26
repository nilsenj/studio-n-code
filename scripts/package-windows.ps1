param([switch]$SkipBuild, [switch]$SkipProductionBuild, [switch]$DevelopmentWithoutSpectre)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$upstreamRoot = Join-Path $projectRoot 'upstream'
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'dist'))
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
if (-not (Get-Command signtool.exe -ErrorAction SilentlyContinue)) {
    $sdkBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
    $signTool = Get-ChildItem -LiteralPath $sdkBin -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue | Where-Object FullName -Match '\\x64\\' | Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $signTool) { throw 'Windows SDK signtool.exe is required to prepare native dependency metadata.' }
    $env:PATH = "$($signTool.DirectoryName);$env:PATH"
}
if ($version -notmatch '^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$') { throw 'Invalid release version.' }
Push-Location $projectRoot
try {
    if (-not $SkipBuild) {
        & (Join-Path $PSScriptRoot 'build.ps1') -DevelopmentWithoutSpectre:$DevelopmentWithoutSpectre
        if ($LASTEXITCODE -ne 0) { throw 'Development build failed.' }
    } else {
        & node scripts/generate-manifest.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Manifest generation failed.' }
        & node scripts/prepare.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Source preparation failed.' }
    }
    if (-not $SkipProductionBuild) { Push-Location $upstreamRoot
    try {
        & npm.cmd run gulp vscode-win32-x64
        if ($LASTEXITCODE -ne 0) { throw 'Production application build failed.' }
    } finally { Pop-Location } }
    $application = Join-Path $projectRoot 'VSCode-win32-x64'
    $executable = Join-Path $application 'studio-n-code.exe'
    if (-not (Test-Path -LiteralPath $executable)) { throw 'Packaged executable is missing.' }
    $resourceEditor = Join-Path $upstreamRoot 'node_modules/rcedit/bin/rcedit.exe'
    if (-not (Test-Path -LiteralPath $resourceEditor)) { throw 'The executable resource editor is missing.' }
    & $resourceEditor $executable --set-icon (Join-Path $projectRoot 'assets/icon.ico') --set-version-string 'OriginalFilename' 'studio-n-code.exe' --set-version-string 'ProductName' 'studio-n-code' --set-version-string 'FileDescription' 'studio-n-code' --set-product-version $version --set-file-version $version
    if ($LASTEXITCODE -ne 0) { throw 'Windows executable branding failed.' }
    & node scripts/launch.mjs --smoke --packaged-executable $executable
    if ($LASTEXITCODE -ne 0) { throw 'Packaged application smoke checks failed.' }
    New-Item -ItemType Directory -Force $releaseRoot | Out-Null
    Copy-Item -LiteralPath LICENSE -Destination (Join-Path $application 'LICENSE.studio-n-code.txt')
    Copy-Item -LiteralPath NOTICE.md -Destination (Join-Path $application 'NOTICE.studio-n-code.md')
    Copy-Item -LiteralPath assets/icon.ico -Destination (Join-Path $application 'studio-n-code.ico')
    $archive = Join-Path $releaseRoot "studio-n-code-$version-windows-x64.zip"
    & tar.exe -a -c -f $archive -C $application .
    if ($LASTEXITCODE -ne 0) { throw 'Portable archive creation failed.' }
    $compiler = Join-Path $upstreamRoot 'node_modules/innosetup/bin/ISCC.exe'
    if (-not (Test-Path -LiteralPath $compiler)) { throw 'The upstream Inno Setup compiler is missing.' }
    & $compiler (Join-Path $projectRoot 'packaging/windows/studio-n-code.iss') "/DAppVersion=$version" "/DAppSource=$application" "/DReleaseOutput=$releaseRoot"
    if ($LASTEXITCODE -ne 0) { throw 'Windows installer compilation failed.' }
    $archiveName = "studio-n-code-$version-windows-x64.zip"
    $setupName = "studio-n-code-$version-windows-x64-setup.exe"
    & node scripts/write-checksums.mjs $releaseRoot $archiveName $setupName
    if ($LASTEXITCODE -ne 0) { throw 'Release checksum generation failed.' }
    Write-Output "Release files created in $releaseRoot"
} finally { Pop-Location }
