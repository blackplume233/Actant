#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ACTANT_HOME = if ($env:ACTANT_HOME) { $env:ACTANT_HOME } else { Join-Path $env:USERPROFILE ".actant" }

Write-Host "=== Actant Installation ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js >= 22
try {
  $nodeVersion = node -v
  $nodeMajor = [int]($nodeVersion -replace '^v(\d+)\..*', '$1')
  if ($nodeMajor -lt 22) {
    Write-Host "Error: Node.js >= 22 is required. Found: $nodeVersion" -ForegroundColor Red
    exit 1
  }
  Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green
} catch {
  Write-Host "Error: Node.js is not installed. Please install Node.js >= 22." -ForegroundColor Red
  Write-Host "  https://nodejs.org/" -ForegroundColor Gray
  exit 1
}

# Check pnpm >= 9
try {
  $pnpmVersion = pnpm -v
  $pnpmMajor = [int]($pnpmVersion -split '\.')[0]
  if ($pnpmMajor -lt 9) {
    Write-Host "Error: pnpm >= 9 is required. Found: $pnpmVersion" -ForegroundColor Red
    exit 1
  }
  Write-Host "✓ pnpm $pnpmVersion" -ForegroundColor Green
} catch {
  Write-Host "Error: pnpm is not installed. Please install pnpm >= 9." -ForegroundColor Red
  Write-Host "  npm install -g pnpm" -ForegroundColor Gray
  exit 1
}

# Run from project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pnpm install

Write-Host ""
Write-Host "Building packages..." -ForegroundColor Cyan
pnpm build

Write-Host ""
Write-Host "Linking CLI globally..." -ForegroundColor Cyan
pnpm --filter @actant/cli link --global

# Create directory structure
Write-Host ""
Write-Host "Creating Actant home directory at $ACTANT_HOME" -ForegroundColor Cyan
$dirs = @(
  (Join-Path $ACTANT_HOME "configs\skills"),
  (Join-Path $ACTANT_HOME "configs\prompts"),
  (Join-Path $ACTANT_HOME "configs\mcp"),
  (Join-Path $ACTANT_HOME "configs\workflows"),
  (Join-Path $ACTANT_HOME "configs\plugins"),
  (Join-Path $ACTANT_HOME "configs\templates"),
  (Join-Path $ACTANT_HOME "instances"),
  (Join-Path $ACTANT_HOME "sources\cache"),
  (Join-Path $ACTANT_HOME "logs"),
  (Join-Path $ACTANT_HOME "backups")
)
foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

# Create default config.json if not exists
$ConfigFile = Join-Path $ACTANT_HOME "config.json"
if (-not (Test-Path $ConfigFile)) {
  $defaultConfig = @'
{
  "devSourcePath": "",
  "update": {
    "maxBackups": 3,
    "preUpdateTestCommand": "pnpm test:changed",
    "autoRestartAgents": true
  }
}
'@
  Set-Content -Path $ConfigFile -Value $defaultConfig -Encoding UTF8
  Write-Host "✓ Created default config.json" -ForegroundColor Green
} else {
  Write-Host "  config.json already exists, skipping" -ForegroundColor Yellow
}

# Verify installation
Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Cyan
try {
  $versionOutput = actant --version 2>&1
  Write-Host "✓ actant --version: $versionOutput" -ForegroundColor Green
} catch {
  Write-Host "Error: actant command not found. Ensure pnpm global bin is in PATH." -ForegroundColor Red
  $pnpmRoot = pnpm root -g 2>$null
  if ($pnpmRoot) {
    $globalBin = Join-Path (Split-Path -Parent $pnpmRoot) "bin"
    Write-Host "  Try adding to PATH: $globalBin" -ForegroundColor Gray
  }
  exit 1
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Start the daemon:    actant daemon start"
Write-Host "  2. Browse components:  actant skill list"
Write-Host "  3. Create an agent:     actant agent create my-agent --template code-review-agent"
Write-Host "  4. Start and chat:      actant agent start my-agent; actant agent chat my-agent"
Write-Host ""
Write-Host "For help: actant help"
Write-Host ""
