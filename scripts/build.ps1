param([switch]$DevelopmentWithoutSpectre)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$upstreamRoot = Join-Path $projectRoot 'upstream'
Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $upstreamRoot '.git'))) {
        $pin = Get-Content -LiteralPath 'upstream.lock.json' -Raw | ConvertFrom-Json
        & git clone --depth 1 --branch $pin.tag $pin.repository $upstreamRoot
        if ($LASTEXITCODE -ne 0) { throw 'Could not clone the pinned upstream source.' }
    }
    & node scripts/generate-manifest.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Manifest generation failed.' }
    & node scripts/prepare.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Source preparation failed.' }
    if ($DevelopmentWithoutSpectre) {
        Copy-Item -LiteralPath 'customizations/build/Directory.Build.targets' -Destination (Join-Path $upstreamRoot 'Directory.Build.targets')
        Write-Warning 'Native modules will use ordinary MSVC runtime libraries. This option is for local development builds.'
    } elseif (Test-Path -LiteralPath (Join-Path $upstreamRoot 'Directory.Build.targets')) {
        throw 'A local Directory.Build.targets override exists. Use -DevelopmentWithoutSpectre for this development build or remove that override after installing the Spectre libraries.'
    }
    Push-Location $upstreamRoot
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Upstream dependency installation failed.' }
        & npm.cmd run build-fast
        if ($LASTEXITCODE -ne 0) { throw 'Upstream build failed.' }
        & npm.cmd run electron
        if ($LASTEXITCODE -ne 0) { throw 'Electron preparation failed.' }
        & npm.cmd run download-builtin-extensions
        if ($LASTEXITCODE -ne 0) { throw 'Built-in debugger preparation failed.' }
    } finally { Pop-Location }
} finally { Pop-Location }
