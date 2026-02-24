#Requires -Version 5.1
param(
  [switch]$SkipSetup,
  [switch]$Uninstall,
  [switch]$FromGitHub,
  [switch]$NpmRegistry
)
$ErrorActionPreference = "Stop"

$IsInteractive = [Environment]::UserInteractive -and (-not $env:CI) -and (-not $env:GITHUB_ACTIONS)

$GitHubReleaseUrl = "https://github.com/blackplume233/Actant/releases/latest/download/actant-cli.tgz"

Write-Host "=== Actant Installer ===" -ForegroundColor Cyan
Write-Host ""

# ── Node.js check ──────────────────────────────────────────────────
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

# ── Non-interactive uninstall ──────────────────────────────────────
if ($Uninstall) {
  Write-Host ""
  Write-Host "Uninstalling Actant..." -ForegroundColor Yellow
  try { actant daemon stop 2>$null } catch {}
  try { schtasks /Delete /TN "ActantDaemon" /F 2>$null } catch {}
  npm uninstall -g actant 2>$null
  npm uninstall -g @actant/cli 2>$null
  Write-Host "✓ Actant has been uninstalled." -ForegroundColor Green
  Write-Host "  Data directory (~/.actant) was kept. Remove manually if needed." -ForegroundColor Gray
  exit 0
}

# ── Install from GitHub Release ──────────────────────────────────
function Install-FromGitHub {
  Write-Host "Installing actant from GitHub Release..." -ForegroundColor Cyan
  Write-Host "  $GitHubReleaseUrl" -ForegroundColor Gray
  npm install -g $GitHubReleaseUrl
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm install failed (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit 1
  }
  Write-Host "✓ Actant installed from GitHub Release" -ForegroundColor Green
}

# ── Existing installation detection ───────────────────────────────
$existingActant = Get-Command actant -ErrorAction SilentlyContinue
if ($existingActant) {
  $currentVersion = "unknown"
  try { $currentVersion = actant --version 2>$null } catch {}

  Write-Host ""
  Write-Host "检测到已安装 Actant $currentVersion" -ForegroundColor Yellow
  Write-Host ""
  if (-not $IsInteractive) {
    Write-Host "Non-interactive environment detected. Updating via npm..." -ForegroundColor Yellow
    $choice = "U"
  } else {
    Write-Host "  [U] 更新 (npm registry)"
    Write-Host "  [G] 从 GitHub Release 更新"
    Write-Host "  [R] 重新运行配置向导 (actant setup)"
    Write-Host "  [X] 完全卸载"
    Write-Host "  [C] 取消"
    Write-Host ""
    $choice = Read-Host "请选择 [U/G/R/X/C]"
  }

  switch ($choice.ToUpper()) {
    "U" {
      Write-Host ""
      Write-Host "Updating actant from npm..." -ForegroundColor Cyan
      npm install -g actant
      if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: npm install failed (exit code $LASTEXITCODE)" -ForegroundColor Red
        exit 1
      }
      Write-Host ""
      $newVersion = "unknown"
      try { $newVersion = actant --version 2>$null } catch {}
      Write-Host "✓ Actant updated to $newVersion" -ForegroundColor Green
      if ($IsInteractive) {
        Write-Host ""
        $reconfig = Read-Host "是否重新运行配置向导? [y/N]"
        if ($reconfig -eq "y" -or $reconfig -eq "Y") {
          actant setup
        }
      }
    }
    "G" {
      Write-Host ""
      Install-FromGitHub
      Write-Host ""
      $newVersion = "unknown"
      try { $newVersion = actant --version 2>$null } catch {}
      Write-Host "✓ Actant updated to $newVersion (from GitHub Release)" -ForegroundColor Green
      if ($IsInteractive) {
        Write-Host ""
        $reconfig = Read-Host "是否重新运行配置向导? [y/N]"
        if ($reconfig -eq "y" -or $reconfig -eq "Y") {
          actant setup
        }
      }
    }
    "R" {
      actant setup
    }
    "X" {
      Write-Host ""
      Write-Host "Uninstalling Actant..." -ForegroundColor Yellow
      try { actant daemon stop 2>$null } catch {}
      try { schtasks /Delete /TN "ActantDaemon" /F 2>$null } catch {}

      Write-Host ""
      $rmData = if ($IsInteractive) { Read-Host "是否删除数据目录 (~/.actant)? [y/N]" } else { "N" }
      if ($rmData -eq "y" -or $rmData -eq "Y") {
        $actantDir = if ($env:ACTANT_HOME) { $env:ACTANT_HOME } else { Join-Path $env:USERPROFILE ".actant" }
        if (Test-Path $actantDir) {
          Remove-Item -Recurse -Force $actantDir
          Write-Host "✓ 已删除 $actantDir" -ForegroundColor Green
        }
      }

      npm uninstall -g actant 2>$null
      npm uninstall -g @actant/cli 2>$null
      Write-Host "✓ Actant 已卸载" -ForegroundColor Green
    }
    default {
      Write-Host "已取消"
      exit 0
    }
  }
  exit 0
}

# ── Fresh install ─────────────────────────────────────────────────
if ($FromGitHub) {
  Install-FromGitHub
} elseif ($NpmRegistry -or (-not $IsInteractive)) {
  if (-not $IsInteractive) {
    Write-Host "Non-interactive environment detected. Using npm registry." -ForegroundColor Yellow
  }
  $installMethod = "1"
} else {
  Write-Host ""
  Write-Host "安装方式:"
  Write-Host "  [1] npm registry (推荐, 快速)"
  Write-Host "  [2] GitHub Release (与 npm 发布同步)"
  Write-Host ""
  $installMethod = Read-Host "请选择 [1/2] (默认 1)"
  if (-not $installMethod) { $installMethod = "1" }

  if ($installMethod -eq "2") {
    Write-Host ""
    Install-FromGitHub
  } else {
    Write-Host ""
    Write-Host "Installing actant from npm..." -ForegroundColor Cyan
    npm install -g actant
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Error: npm install failed (exit code $LASTEXITCODE)" -ForegroundColor Red
      exit 1
    }
  }
}

Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Cyan
try {
  $versionOutput = actant --version 2>&1
  Write-Host "✓ actant $versionOutput" -ForegroundColor Green
} catch {
  Write-Host "Error: actant command not found after install." -ForegroundColor Red
  $npmPrefix = npm config get prefix 2>$null
  if ($npmPrefix) {
    Write-Host "  Try adding to PATH: $npmPrefix" -ForegroundColor Gray
  }
  exit 1
}

# ── Run setup wizard ──────────────────────────────────────────────
if ($SkipSetup) {
  Write-Host ""
  Write-Host "=== Installation Complete ===" -ForegroundColor Green
  Write-Host ""
  Write-Host "Quick start:"
  Write-Host "  actant setup                 # Run setup wizard"
  Write-Host "  actant daemon start          # Start the daemon"
  Write-Host "  actant template list         # Browse templates"
  Write-Host ""
} else {
  Write-Host ""
  actant setup
}
