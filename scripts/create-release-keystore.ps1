\
param(
  [string]$Keytool = "",
  [string]$Output = ""
)
$ErrorActionPreference = "Stop"
if (-not $Keytool) { $Keytool = "keytool.exe" }
if (-not $Output) { $Output = Join-Path $PSScriptRoot "..\android\tayba-pos-release.jks" }
$Output = [System.IO.Path]::GetFullPath($Output)
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($Output)) | Out-Null
Write-Host "Creating release keystore: $Output"
& $Keytool -genkeypair -v -keystore $Output -alias tayba-pos -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS
if ($LASTEXITCODE -ne 0) { throw "keytool failed with exit code $LASTEXITCODE" }
Write-Host "Keystore created. Keep this file and its passwords backed up securely."
