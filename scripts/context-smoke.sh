#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

run() {
  bash scripts/run-workspace-entry.sh "$@"
}

cleanup() {
  run packages/cli/src/bin/actant.ts daemon stop >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "[1/6] Context host status"
status_json="$(run packages/cli/src/bin/actant.ts hub status -f json)"
echo "$status_json"
printf '%s' "$status_json" | grep '"active": true' >/dev/null
printf '%s' "$status_json" | grep '"projectRoot": "'"$ROOT_DIR"'"' >/dev/null

echo "[2/6] Hub read project context"
context_json="$(run packages/cli/src/bin/actant.ts hub read /project/context.json)"
echo "$context_json"
printf '%s' "$context_json" | grep '"mode": "project-context"' >/dev/null

echo "[3/6] Hub list skills"
skills_out="$(run packages/cli/src/bin/actant.ts hub list /skills)"
echo "$skills_out"
printf '%s' "$skills_out" | grep '_catalog.json' >/dev/null

echo "[4/6] acthub alias"
alias_json="$(run packages/cli/src/bin/acthub.ts status -f json)"
echo "$alias_json"
printf '%s' "$alias_json" | grep '"active": true' >/dev/null

echo "[5/6] MCP connected path"
connected_out="$(run packages/mcp-server/src/index.ts </dev/null 2>&1 || true)"
echo "$connected_out"
printf '%s' "$connected_out" | grep 'connected to daemon' >/dev/null

echo "[6/6] MCP standalone fallback with invalid socket"
standalone_out="$(ACTANT_SOCKET=/tmp/actant-context-smoke-missing.sock run packages/mcp-server/src/index.ts </dev/null 2>&1 || true)"
echo "$standalone_out"
printf '%s' "$standalone_out" | grep 'standalone project-context mode' >/dev/null

echo "Context smoke passed."
