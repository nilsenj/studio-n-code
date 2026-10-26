param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ProjectPaths)
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'launch.mjs') @ProjectPaths
exit $LASTEXITCODE
