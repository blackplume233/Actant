#!/bin/bash
# Changelog draft validation utilities

if ! type get_repo_root &>/dev/null; then
  echo "Error: paths.sh must be sourced before changelog-draft.sh" >&2
  exit 1
fi

CHANGELOG_REQUIRED_SECTIONS=(
  "## 变更摘要"
  "## 用户可见影响"
  "## 破坏性变更/迁移说明"
  "## 验证结果"
  "## 关联 PR / Commit / Issue"
)

get_changelog_drafts_dir() {
  local repo_root="${1:-$(get_repo_root)}"
  echo "$repo_root/docs/agent/changelog-drafts"
}

is_valid_changelog_draft_filename() {
  local file_name="$1"
  [[ "$file_name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Za-z0-9_-]+-[A-Za-z0-9._-]+\.md$ ]]
}

validate_changelog_draft_file() {
  local draft_file="$1"
  local quiet="${2:-false}"
  local failed=0
  local section

  if [[ ! -f "$draft_file" ]]; then
    [[ "$quiet" != "true" ]] && echo "Changelog draft error: file not found: $draft_file" >&2
    return 1
  fi

  if ! is_valid_changelog_draft_filename "$(basename "$draft_file")"; then
    [[ "$quiet" != "true" ]] && echo "Changelog draft error: invalid filename format: $(basename "$draft_file")" >&2
    failed=1
  fi

  if ! grep -q '^# ' "$draft_file"; then
    [[ "$quiet" != "true" ]] && echo "Changelog draft error: missing top-level title in $(basename "$draft_file")" >&2
    failed=1
  fi

  for section in "${CHANGELOG_REQUIRED_SECTIONS[@]}"; do
    if ! grep -Fq "$section" "$draft_file"; then
      [[ "$quiet" != "true" ]] && echo "Changelog draft error: missing section '$section' in $(basename "$draft_file")" >&2
      failed=1
    fi
  done

  return "$failed"
}

normalize_changelog_topic_token() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

find_matching_changelog_drafts() {
  local repo_root="${1:-$(get_repo_root)}"
  shift || true
  local drafts_dir
  drafts_dir=$(get_changelog_drafts_dir "$repo_root")
  [[ ! -d "$drafts_dir" ]] && return 0

  local normalized_tokens=()
  local token=""
  for token in "$@"; do
    [[ -z "$token" ]] && continue
    normalized_tokens+=("$(normalize_changelog_topic_token "$token")")
  done

  local file=""
  for file in "$drafts_dir"/*.md; do
    [[ ! -f "$file" ]] && continue
    validate_changelog_draft_file "$file" true || continue

    if [[ "${#normalized_tokens[@]}" -eq 0 ]]; then
      echo "$file"
      continue
    fi

    local draft_name
    draft_name=$(normalize_changelog_topic_token "$(basename "$file")")
    local matched=false
    for token in "${normalized_tokens[@]}"; do
      if [[ -n "$token" ]] && [[ "$draft_name" == *"$token"* ]]; then
        matched=true
        break
      fi
    done

    [[ "$matched" == "true" ]] && echo "$file"
  done
}

require_matching_changelog_draft() {
  local repo_root="${1:-$(get_repo_root)}"
  local task_name="$2"
  local branch_name="$3"
  local branch_leaf="${branch_name##*/}"
  local drafts=()
  local draft=""

  while IFS= read -r draft; do
    [[ -z "$draft" ]] && continue
    drafts+=("$draft")
  done < <(find_matching_changelog_drafts "$repo_root" "$task_name" "$branch_leaf")

  if [[ "${#drafts[@]}" -eq 0 ]]; then
    echo "Changelog draft error: no valid draft found in docs/agent/changelog-drafts/ for task '$task_name' or branch '$branch_leaf'" >&2
    echo "Expected filename format: YYYY-MM-DD-<agent>-<topic>.md" >&2
    echo "Required sections: 标题, 变更摘要, 用户可见影响, 破坏性变更/迁移说明, 验证结果, 关联 PR / Commit / Issue" >&2
    return 1
  fi

  return 0
}
