#!/usr/bin/env bash
set -euo pipefail

ACTANT_HOME="${ACTANT_HOME:-$HOME/.actant}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== Actant Installation ===${NC}"
echo ""

# Check Node.js >= 22
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

# Check pnpm >= 9
if ! command -v pnpm &>/dev/null; then
  echo -e "${RED}Error: pnpm is not installed. Please install pnpm >= 9.${NC}"
  echo "  npm install -g pnpm"
  exit 1
fi

PNPM_VERSION=$(pnpm -v | cut -d. -f1)
if [[ "$PNPM_VERSION" -lt 9 ]]; then
  echo -e "${RED}Error: pnpm >= 9 is required. Found: $(pnpm -v)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# Run from project root (where package.json lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo -e "${CYAN}Installing dependencies...${NC}"
pnpm install

echo ""
echo -e "${CYAN}Building packages...${NC}"
pnpm build

echo ""
echo -e "${CYAN}Linking CLI globally...${NC}"
pnpm --filter @actant/cli link --global

# Create ~/.actant/ directory structure
echo ""
echo -e "${CYAN}Creating Actant home directory at $ACTANT_HOME${NC}"
mkdir -p "$ACTANT_HOME/configs/skills"
mkdir -p "$ACTANT_HOME/configs/prompts"
mkdir -p "$ACTANT_HOME/configs/mcp"
mkdir -p "$ACTANT_HOME/configs/workflows"
mkdir -p "$ACTANT_HOME/configs/plugins"
mkdir -p "$ACTANT_HOME/configs/templates"
mkdir -p "$ACTANT_HOME/instances"
mkdir -p "$ACTANT_HOME/sources/cache"
mkdir -p "$ACTANT_HOME/logs"
mkdir -p "$ACTANT_HOME/backups"

# Create default config.json if not exists
CONFIG_FILE="$ACTANT_HOME/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" << 'EOF'
{
  "devSourcePath": "",
  "update": {
    "maxBackups": 3,
    "preUpdateTestCommand": "pnpm test:changed",
    "autoRestartAgents": true
  }
}
EOF
  echo -e "${GREEN}✓ Created default config.json${NC}"
else
  echo -e "${YELLOW}  config.json already exists, skipping${NC}"
fi

# Verify installation
echo ""
echo -e "${CYAN}Verifying installation...${NC}"
if actant --version &>/dev/null; then
  echo -e "${GREEN}✓ actant --version: $(actant --version)${NC}"
else
  echo -e "${RED}Error: actant command not found. Ensure pnpm global bin is in PATH.${NC}"
  echo "  Try: export PATH=\"$(pnpm root -g)/../bin:\$PATH\""
  exit 1
fi

echo ""
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Start the daemon:    actant daemon start"
echo "  2. Browse components:   actant skill list"
echo "  3. Create an agent:     actant agent create my-agent --template code-review-agent"
echo "  4. Start and chat:      actant agent start my-agent && actant agent chat my-agent"
echo ""
echo "For help: actant help"
echo ""
