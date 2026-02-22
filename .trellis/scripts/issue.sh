#!/bin/bash
# Compatibility wrapper — redirects to the canonical script in the issue-manager skill.
# The authoritative implementation lives at:
#   .agents/skills/issue-manager/scripts/issue.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec "$REPO_ROOT/.agents/skills/issue-manager/scripts/issue.sh" "$@"
