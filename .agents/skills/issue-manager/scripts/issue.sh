#!/bin/bash
# Issue Management Script — Obsidian Markdown format
#
# Thin wrapper around issue-cli.mjs (Node.js implementation).
# Issues are stored as .md files with YAML frontmatter + wikilinks + body.
#
# Usage:
#   issue.sh create "<title>" [options]
#   issue.sh list [filters]
#   issue.sh show <id>
#   issue.sh edit <id> [fields]
#   issue.sh close <id> [--as completed|not-planned|duplicate] [--ref <id>]
#   issue.sh reopen <id>
#   issue.sh archive <id> | --all
#   issue.sh comment <id> "<text>"
#   issue.sh label <id> --add <l> | --remove <l>
#   issue.sh promote <id> [--slug <name>]
#   issue.sh search "<query>"
#   issue.sh stats
#
# Issue vs Task:
#   Issue  = discussion, idea, bug report, design proposal, question
#   Task   = active work item with a development lifecycle
#   Use 'promote' to create a Task from an Issue when ready to implement

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Find node executable (handle Windows where node may not be in bash PATH)
NODE_CMD="node"
if ! command -v node &>/dev/null; then
  for candidate in \
    "/c/Program Files/nodejs/node.exe" \
    "/c/Program Files (x86)/nodejs/node.exe" \
    "$LOCALAPPDATA/fnm_multishells/"*/node.exe \
    "$NVM_DIR/versions/node/"*/bin/node \
    "$HOME/.nvm/versions/node/"*/bin/node; do
    if [[ -x "$candidate" ]]; then
      NODE_CMD="$candidate"
      break
    fi
  done
fi

exec "$NODE_CMD" "$SCRIPT_DIR/issue-cli.mjs" "$@"
