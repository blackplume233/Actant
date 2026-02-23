#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

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

# Install @actant/cli globally
echo ""
echo -e "${CYAN}Installing @actant/cli from npm...${NC}"
npm install -g @actant/cli

# Verify installation
echo ""
echo -e "${CYAN}Verifying installation...${NC}"
if actant --version &>/dev/null; then
  echo -e "${GREEN}✓ actant $(actant --version)${NC}"
else
  echo -e "${RED}Error: actant command not found after install.${NC}"
  echo -e "  Try running: ${YELLOW}npm bin -g${NC} to find global bin path"
  echo -e "  Then add it to your PATH."
  exit 1
fi

echo ""
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo ""
echo "Quick start:"
echo "  actant daemon start          # Start the daemon"
echo "  actant template list         # Browse templates"
echo "  actant agent create my-agent --template code-review-agent"
echo "  actant agent chat my-agent   # Chat with your agent"
echo ""
echo "For help: actant help"
echo ""
