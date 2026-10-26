$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'launch.mjs') --smoke
exit $LASTEXITCODE
