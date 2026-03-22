#!/bin/bash
# Create a changelog draft with the required Trellis governance structure.
#
# Usage:
#   ./.trellis/scripts/create-changelog-draft.sh --topic governance-repair
#   ./.trellis/scripts/create-changelog-draft.sh --topic m7-context-flow --title "M7 Context Flow"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/paths.sh"
source "$SCRIPT_DIR/common/developer.sh"
source "$SCRIPT_DIR/common/changelog-draft.sh"

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//'
}

usage() {
  cat << EOF
Create a changelog draft for ship / merge delivery.

Usage:
  $0 --topic <topic> [options]

Options:
  --topic <topic>      Required topic slug or phrase
  --title <title>      Optional human-readable title
  --agent <agent>      Optional agent identifier; defaults to current developer
  --date <YYYY-MM-DD>  Optional date override; defaults to today
  --force              Overwrite existing file
  -h, --help           Show this help
EOF
}

ensure_developer

TOPIC=""
TITLE=""
AGENT=""
DATE_OVERRIDE=""
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --topic)
      TOPIC="$2"
      shift 2
      ;;
    --title)
      TITLE="$2"
      shift 2
      ;;
    --agent)
      AGENT="$2"
      shift 2
      ;;
    --date)
      DATE_OVERRIDE="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TOPIC" ]]; then
  echo "Error: --topic is required" >&2
  usage >&2
  exit 1
fi

REPO_ROOT=$(get_repo_root)
DRAFTS_DIR=$(get_changelog_drafts_dir "$REPO_ROOT")
mkdir -p "$DRAFTS_DIR"

if [[ -z "$DATE_OVERRIDE" ]]; then
  DATE_OVERRIDE=$(date +%Y-%m-%d)
fi

if [[ -z "$AGENT" ]]; then
  AGENT=$(get_developer "$REPO_ROOT")
fi
AGENT=$(printf '%s' "$AGENT" | sed 's/-agent$//' | tr '[:upper:]' '[:lower:]')

TOPIC_SLUG=$(slugify "$TOPIC")
if [[ -z "$TOPIC_SLUG" ]]; then
  echo "Error: could not derive topic slug from '$TOPIC'" >&2
  exit 1
fi

if [[ -z "$TITLE" ]]; then
  TITLE="$TOPIC"
fi

DRAFT_PATH="$DRAFTS_DIR/${DATE_OVERRIDE}-${AGENT}-${TOPIC_SLUG}.md"

if [[ -f "$DRAFT_PATH" ]] && [[ "$FORCE" != "true" ]]; then
  echo "Error: draft already exists: $DRAFT_PATH" >&2
  echo "Use --force to overwrite." >&2
  exit 1
fi

cat > "$DRAFT_PATH" << EOF
# ${TITLE}

## 变更摘要

- TODO: 总结本次交付的核心变更

## 用户可见影响

- TODO: 说明用户或调用方会感知到的变化

## 破坏性变更/迁移说明

- TODO: 如果没有破坏性变更，写明“无”

## 验证结果

- TODO: 列出本次执行过的检查、测试、人工验收

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: pending
EOF

if ! validate_changelog_draft_file "$DRAFT_PATH"; then
  echo "Error: generated draft did not pass validation: $DRAFT_PATH" >&2
  exit 1
fi

echo "$DRAFT_PATH"
