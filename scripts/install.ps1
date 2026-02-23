#Requires -Version 5.1
$ErrorActionPreference = "Stop"

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

# Install @actant/cli globally
Write-Host ""
Write-Host "Installing @actant/cli from npm..." -ForegroundColor Cyan
npm install -g @actant/cli

# Verify installation
Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Cyan
try {
  $versionOutput = actant --version 2>&1
  Write-Host "✓ actant $versionOutput" -ForegroundColor Green
} catch {
  Write-Host "Error: actant command not found after install." -ForegroundColor Red
  $globalBin = npm bin -g 2>$null
  if ($globalBin) {
    Write-Host "  Try adding to PATH: $globalBin" -ForegroundColor Gray
  }
  exit 1
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Quick start:"
Write-Host "  actant daemon start          # Start the daemon"
Write-Host "  actant template list         # Browse templates"
Write-Host "  actant agent create my-agent --template code-review-agent"
Write-Host "  actant agent chat my-agent   # Chat with your agent"
Write-Host ""
Write-Host "For help: actant help"
Write-Host ""
