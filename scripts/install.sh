#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

GITHUB_RELEASE_URL="https://github.com/blackplume233/Actant/releases/latest/download/actant-cli.tgz"

SKIP_SETUP=false
UNINSTALL=false
FROM_GITHUB=false

for arg in "$@"; do
  case "$arg" in
    --skip-setup)    SKIP_SETUP=true ;;
    --uninstall)     UNINSTALL=true ;;
    --from-github)   FROM_GITHUB=true ;;
  esac
done

echo -e "${CYAN}=== Actant Installer ===${NC}"
echo ""

# ── Node.js check ──────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js is not installed. Please install Node.js >= 22.${NC}"
  echo "  https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/^v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 22 ]]; then
  echo -e "${RED}Error: Node.js >= 22 is required. Found: $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── Non-interactive uninstall ──────────────────────────────────────
if $UNINSTALL; then
  echo ""
  echo -e "${YELLOW}Uninstalling Actant...${NC}"
  actant daemon stop 2>/dev/null || true
  rm -f ~/.config/systemd/user/actant-daemon.service 2>/dev/null
  systemctl --user disable actant-daemon 2>/dev/null || true
  rm -f ~/Library/LaunchAgents/com.actant.daemon.plist 2>/dev/null
  launchctl unload ~/Library/LaunchAgents/com.actant.daemon.plist 2>/dev/null || true
  npm uninstall -g actant 2>/dev/null || true
  npm uninstall -g @actant/cli 2>/dev/null || true
  echo -e "${GREEN}✓ Actant has been uninstalled.${NC}"
  echo -e "${DIM}  Data directory (~/.actant) was kept. Remove manually if needed.${NC}"
  exit 0
fi

# ── Install from GitHub Release ──────────────────────────────────
install_from_github() {
  echo -e "${CYAN}Installing actant from GitHub Release...${NC}"
  echo -e "${DIM}  $GITHUB_RELEASE_URL${NC}"
  npm install -g "$GITHUB_RELEASE_URL"
  echo -e "${GREEN}✓ Actant installed from GitHub Release${NC}"
}

# ── Existing installation detection ───────────────────────────────
if command -v actant &>/dev/null; then
  CURRENT_VERSION=$(actant --version 2>/dev/null || echo "unknown")
  echo ""
  echo -e "${YELLOW}检测到已安装 Actant ${CURRENT_VERSION}${NC}"
  echo ""
  echo "  [U] 更新 (npm registry)"
  echo "  [G] 从 GitHub Release 更新"
  echo "  [R] 重新运行配置向导 (actant setup)"
  echo "  [X] 完全卸载"
  echo "  [C] 取消"
  echo ""
  read -rp "请选择 [U/G/R/X/C]: " choice

  case "${choice,,}" in
    u)
      echo ""
      echo -e "${CYAN}Updating actant from npm...${NC}"
      npm install -g actant
      echo ""
      NEW_VERSION=$(actant --version 2>/dev/null || echo "unknown")
      echo -e "${GREEN}✓ Actant updated to ${NEW_VERSION}${NC}"
      echo ""
      read -rp "是否重新运行配置向导? [y/N]: " reconfig
      if [[ "${reconfig,,}" == "y" ]]; then
        actant setup
      fi
      ;;
    g)
      echo ""
      install_from_github
      echo ""
      NEW_VERSION=$(actant --version 2>/dev/null || echo "unknown")
      echo -e "${GREEN}✓ Actant updated to ${NEW_VERSION} (from GitHub Release)${NC}"
      echo ""
      read -rp "是否重新运行配置向导? [y/N]: " reconfig
      if [[ "${reconfig,,}" == "y" ]]; then
        actant setup
      fi
      ;;
    r)
      actant setup
      ;;
    x)
      echo ""
      echo -e "${YELLOW}Uninstalling Actant...${NC}"
      actant daemon stop 2>/dev/null || true

      rm -f ~/.config/systemd/user/actant-daemon.service 2>/dev/null
      systemctl --user disable actant-daemon 2>/dev/null || true
      systemctl --user daemon-reload 2>/dev/null || true
      launchctl unload ~/Library/LaunchAgents/com.actant.daemon.plist 2>/dev/null || true
      rm -f ~/Library/LaunchAgents/com.actant.daemon.plist 2>/dev/null

      echo ""
      read -rp "是否删除数据目录 (~/.actant)? [y/N]: " rm_data
      if [[ "${rm_data,,}" == "y" ]]; then
        ACTANT_DIR="${ACTANT_HOME:-$HOME/.actant}"
        rm -rf "$ACTANT_DIR"
        echo -e "${GREEN}✓ 已删除 ${ACTANT_DIR}${NC}"
      fi

      npm uninstall -g actant 2>/dev/null || true
      npm uninstall -g @actant/cli 2>/dev/null || true
      echo -e "${GREEN}✓ Actant 已卸载${NC}"
      ;;
    *)
      echo "已取消"
      exit 0
      ;;
  esac
  exit 0
fi

# ── Fresh install ─────────────────────────────────────────────────
if $FROM_GITHUB; then
  install_from_github
else
  echo ""
  echo -e "安装方式:"
  echo "  [1] npm registry (推荐, 快速)"
  echo "  [2] GitHub Release (与 npm 发布同步)"
  echo ""
  read -rp "请选择 [1/2] (默认 1): " install_method
  install_method="${install_method:-1}"

  if [[ "$install_method" == "2" ]]; then
    echo ""
    install_from_github
  else
    echo ""
    echo -e "${CYAN}Installing actant from npm...${NC}"
    npm install -g actant
  fi
fi

echo ""
echo -e "${CYAN}Verifying installation...${NC}"
if actant --version &>/dev/null; then
  echo -e "${GREEN}✓ actant $(actant --version)${NC}"
else
  echo -e "${RED}Error: actant command not found after install.${NC}"
  echo -e "  Try running: ${YELLOW}npm config get prefix${NC} to find global bin path"
  echo -e "  Then add it to your PATH."
  exit 1
fi

# ── Run setup wizard ──────────────────────────────────────────────
if $SKIP_SETUP; then
  echo ""
  echo -e "${GREEN}=== Installation Complete ===${NC}"
  echo ""
  echo "Quick start:"
  echo "  actant setup                 # Run setup wizard"
  echo "  actant daemon start          # Start the daemon"
  echo "  actant template list         # Browse templates"
  echo ""
else
  echo ""
  actant setup
fi
