# Convenience wrapper: delegates to the canonical script under scripts\create-release-keystore.ps1
$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "scripts\create-release-keystore.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
