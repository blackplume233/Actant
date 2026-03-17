#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -n "${ACTANT_BOOTSTRAP_NODE:-}" && -x "${ACTANT_BOOTSTRAP_NODE}" ]]; then
  NODE_BIN="${ACTANT_BOOTSTRAP_NODE}"
elif [[ -x "/opt/homebrew/opt/node@22/bin/node" ]]; then
  NODE_BIN="/opt/homebrew/opt/node@22/bin/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "No usable Node.js found. Set ACTANT_BOOTSTRAP_NODE or install Node 22." >&2
  exit 1
fi

exec "${NODE_BIN}" "$ROOT_DIR/scripts/run-workspace-entry.mjs" "$@"
