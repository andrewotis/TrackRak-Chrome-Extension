<#
Build a temporary Firefox extension package suitable for loading in
about:debugging or with web-ext. This copies the MV2 Firefox manifest
(`manifest-firefox.json`) to `dist/firefox/manifest.json` and copies the
`src/` folder so all referenced scripts/assets are present.

Usage (PowerShell):
  .\scripts\build-firefox-temp.ps1

After running, load `dist\firefox\manifest.json` in `about:debugging` or
run `npx web-ext run --source-dir dist/firefox`.


ACTUAL USAGE INSTRUCTIONS:
----------------------
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-firefox-temp.ps1

#>

param()

$ErrorActionPreference = 'Stop'

# Build log (project root)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj = Resolve-Path "$root\.."
$logFile = Join-Path $proj 'dist\firefox-build.log'
if (Test-Path $logFile) { Remove-Item $logFile -Force }

function Log {
  param([string]$s)
  $t = Get-Date -Format o
  $line = "[$t] $s"
  Write-Host $line
  try { Add-Content -Path $logFile -Value $line } catch {}
}

Log "Building temporary Firefox package..."

try {
  $dist = Join-Path $proj 'dist\firefox'

  if (Test-Path $dist) {
    Log "Removing existing $dist"
    Remove-Item -Recurse -Force $dist
  }

  Log "Creating $dist"
  New-Item -ItemType Directory -Path $dist | Out-Null

  # Copy manifest-firefox.json -> manifest.json
  $srcManifest = Join-Path $proj 'manifest-firefox.json'
  if (-not (Test-Path $srcManifest)) {
    throw "manifest-firefox.json not found at $srcManifest"
  }
  Copy-Item -Path $srcManifest -Destination (Join-Path $dist 'manifest.json') -Force
  Log "Copied manifest-firefox.json"

  # Copy src directory
  $srcDir = Join-Path $proj 'src'
  if (-not (Test-Path $srcDir)) {
    throw "src directory not found at $srcDir"
  }
  Copy-Item -Path $srcDir -Destination $dist -Recurse -Force
  Log "Copied src/ to $dist\src"

  Log "Temporary Firefox package built at: $dist"
  Log "Load the manifest at: $dist\manifest.json or run: npx web-ext run --source-dir $dist"
} catch {
  Log "ERROR: $_"
  throw
}
