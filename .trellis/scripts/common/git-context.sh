#!/bin/bash
# Git and Session Context utilities
#
# Usage:
#   ./.trellis/scripts/common/git-context.sh           # Full context output
#   ./.trellis/scripts/common/git-context.sh --json    # JSON format
#
# Or source in other scripts:
#   source "$(dirname "$0")/common/git-context.sh"

set -e

COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$COMMON_DIR/paths.sh"
source "$COMMON_DIR/developer.sh"
source "$COMMON_DIR/task-utils.sh"

json_escape() {
  printf '%s' "$1" | jq -Rsa .
}

# =============================================================================
# JSON Output
# =============================================================================

output_json() {
  local repo_root=$(get_repo_root)
  local developer=$(get_developer "$repo_root")
  local tasks_dir=$(get_tasks_dir "$repo_root")
  local journal_file=$(get_active_journal_file "$repo_root")
  local journal_lines=0
  local journal_relative=""

  if [[ -n "$journal_file" ]]; then
    journal_lines=$(count_lines "$journal_file")
    journal_relative="$DIR_WORKFLOW/$DIR_WORKSPACE/$developer/$(basename "$journal_file")"
  fi

  local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
  local git_status=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  local is_clean="true"
  [[ "$git_status" != "0" ]] && is_clean="false"

  # Build commits JSON
  local commits_json="["
  local first=true
  while IFS= read -r line; do
    local hash=$(echo "$line" | cut -d' ' -f1)
    local msg=$(echo "$line" | cut -d' ' -f2-)
    msg=$(echo "$msg" | sed 's/"/\\"/g')
    if [[ "$first" == "true" ]]; then
      first=false
    else
      commits_json+=","
    fi
    commits_json+="{\"hash\":\"$hash\",\"message\":\"$msg\"}"
  done < <(git log --oneline -5 2>/dev/null || echo "")
  commits_json+="]"

  # Build tasks JSON
  local tasks_json="["
  local warnings_json="["
  first=true
  if [[ -d "$tasks_dir" ]]; then
    for d in "$tasks_dir"/*/; do
      if [[ -d "$d" ]] && [[ "$(basename "$d")" != "archive" ]]; then
        local dir_name=$(basename "$d")
        local task_json="$d/$FILE_TASK_JSON"
        local name="$dir_name"
        local status="unknown"
        local task_warning_lines=""

        if [[ -f "$task_json" ]]; then
          name=$(resolve_task_name "$task_json")
          status=$(resolve_task_status "$task_json")
          task_warning_lines=$(collect_task_schema_warnings "$task_json" "$dir_name")
          if [[ "$status" == "completed" ]]; then
            task_warning_lines="${task_warning_lines}"$'\n'"WARNING [$dir_name] completed task still lives in active tasks"
          fi
        else
          task_warning_lines="WARNING [$dir_name] missing task.json"
        fi

        if [[ "$first" == "true" ]]; then
          first=false
        else
          tasks_json+=","
        fi
        tasks_json+="{\"dir\":\"$dir_name\",\"name\":$(json_escape "$name"),\"status\":$(json_escape "$status")}"

        while IFS= read -r warning; do
          [[ -z "$warning" ]] && continue
          if [[ "$warnings_json" != "[" ]]; then
            warnings_json+=","
          fi
          warnings_json+=$(json_escape "$warning")
        done <<< "$task_warning_lines"
      fi
    done
  fi
  tasks_json+="]"
  warnings_json+="]"

  cat << EOF
{
  "developer": "$developer",
  "git": {
    "branch": "$branch",
    "isClean": $is_clean,
    "uncommittedChanges": $git_status,
    "recentCommits": $commits_json
  },
  "tasks": {
    "active": $tasks_json,
    "directory": "$DIR_WORKFLOW/$DIR_TASKS",
    "warnings": $warnings_json
  },
  "journal": {
    "file": "$journal_relative",
    "lines": $journal_lines,
    "nearLimit": $([ "$journal_lines" -gt 1800 ] && echo "true" || echo "false")
  }
}
EOF
}

# =============================================================================
# Text Output
# =============================================================================

output_text() {
  local repo_root=$(get_repo_root)
  local developer=$(get_developer "$repo_root")

  echo "========================================"
  echo "SESSION CONTEXT"
  echo "========================================"
  echo ""

  echo "## DEVELOPER"
  if [[ -z "$developer" ]]; then
    echo "ERROR: Not initialized. Run: ./$DIR_WORKFLOW/$DIR_SCRIPTS/init-developer.sh <name>"
    exit 1
  fi
  echo "Name: $developer"
  echo ""

  echo "## GIT STATUS"
  echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
  local status_count=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$status_count" == "0" ]]; then
    echo "Working directory: Clean"
  else
    echo "Working directory: $status_count uncommitted change(s)"
    echo ""
    echo "Changes:"
    git status --short 2>/dev/null | head -10
  fi
  echo ""

  echo "## RECENT COMMITS"
  git log --oneline -5 2>/dev/null || echo "(no commits)"
  echo ""

  echo "## CURRENT TASK"
  local current_task=$(get_current_task "$repo_root")
  if [[ -n "$current_task" ]]; then
    local current_task_dir="$repo_root/$current_task"
    local task_json="$current_task_dir/$FILE_TASK_JSON"
    echo "Path: $current_task"

    if [[ -f "$task_json" ]]; then
      if command -v jq &> /dev/null; then
        local t_name=$(resolve_task_name "$task_json")
        local t_status=$(resolve_task_status "$task_json")
        local t_created=$(jq -r '.createdAt // .created // "unknown"' "$task_json")
        local t_desc=$(jq -r '.description // .requirement // ""' "$task_json")
        echo "Name: $t_name"
        echo "Status: $t_status"
        echo "Created: $t_created"
        if [[ -n "$t_desc" ]]; then
          echo "Description: $t_desc"
        fi
        while IFS= read -r warning; do
          [[ -z "$warning" ]] && continue
          echo "$warning"
        done < <(collect_task_schema_warnings "$task_json" "$(basename "$current_task_dir")")
      fi
    else
      echo "WARNING [$(basename "$current_task_dir")] missing task.json"
    fi

    # Check for prd.md
    if [[ -f "$current_task_dir/prd.md" ]]; then
      echo ""
      echo "[!] This task has prd.md - read it for task details"
    fi
  else
    echo "(none)"
  fi
  echo ""

  echo "## ACTIVE TASKS"
  local tasks_dir=$(get_tasks_dir "$repo_root")
  local task_count=0
  if [[ -d "$tasks_dir" ]]; then
    for d in "$tasks_dir"/*/; do
      if [[ -d "$d" ]] && [[ "$(basename "$d")" != "archive" ]]; then
        local dir_name=$(basename "$d")
        local t_json="$d/$FILE_TASK_JSON"
        local status="unknown"
        local assignee="-"
        local warnings=()
        if [[ -f "$t_json" ]] && command -v jq &> /dev/null; then
          status=$(resolve_task_status "$t_json")
          assignee=$(jq -r '.assignee // "-"' "$t_json")
          while IFS= read -r warning; do
            [[ -z "$warning" ]] && continue
            warnings+=("$warning")
          done < <(collect_task_schema_warnings "$t_json" "$dir_name")
          if [[ "$status" == "completed" ]]; then
            warnings+=("WARNING [$dir_name] completed task still lives in active tasks")
          fi
        else
          warnings+=("WARNING [$dir_name] missing task.json")
        fi
        echo "- $dir_name/ ($status) @$assignee"
        local warning
        for warning in "${warnings[@]}"; do
          echo "  $warning"
        done
        ((task_count++)) || true
      fi
    done
  fi
  if [[ $task_count -eq 0 ]]; then
    echo "(no active tasks)"
  fi
  echo "Total: $task_count active task(s)"
  echo ""

  echo "## MY TASKS (Assigned to me)"
  local my_task_count=0
  if [[ -d "$tasks_dir" ]]; then
    for d in "$tasks_dir"/*/; do
      if [[ -d "$d" ]] && [[ "$(basename "$d")" != "archive" ]]; then
        local t_json="$d/$FILE_TASK_JSON"
        if [[ -f "$t_json" ]] && command -v jq &> /dev/null; then
          local assignee=$(jq -r '.assignee // ""' "$t_json")
          local status=$(resolve_task_status "$t_json")
          if [[ "$assignee" == "$developer" ]] && [[ "$status" != "done" ]]; then
            local title=$(resolve_task_title "$t_json")
            local priority=$(jq -r '.priority // "P2"' "$t_json")
            echo "- [$priority] $title ($status)"
            ((my_task_count++)) || true
          fi
        fi
      fi
    done
  fi
  if [[ $my_task_count -eq 0 ]]; then
    echo "(no tasks assigned to you)"
  fi
  echo ""

  echo "## JOURNAL FILE"
  local journal_file=$(get_active_journal_file "$repo_root")
  if [[ -n "$journal_file" ]]; then
    local lines=$(count_lines "$journal_file")
    local relative="$DIR_WORKFLOW/$DIR_WORKSPACE/$developer/$(basename "$journal_file")"
    echo "Active file: $relative"
    echo "Line count: $lines / 2000"
    if [[ "$lines" -gt 1800 ]]; then
      echo "[!] WARNING: Approaching 2000 line limit!"
    fi
  else
    echo "No journal file found"
  fi
  echo ""

  echo "## OPEN ISSUES"
  local issues_dir="$repo_root/$DIR_WORKFLOW/$DIR_ISSUES"
  local issue_count=0
  if [[ -d "$issues_dir" ]]; then
    for f in "$issues_dir"/[0-9][0-9][0-9][0-9]-*.md; do
      [[ ! -f "$f" ]] && continue
      local i_status
      i_status=$(grep -m1 '^status:' "$f" 2>/dev/null | sed 's/^status:[[:space:]]*//')
      [[ "$i_status" == "closed" ]] && continue
      local i_id i_title i_milestone i_labels
      i_id=$(grep -m1 '^id:' "$f" 2>/dev/null | sed 's/^id:[[:space:]]*//')
      i_title=$(grep -m1 '^title:' "$f" 2>/dev/null | sed 's/^title:[[:space:]]*//')
      i_milestone=$(grep -m1 '^milestone:' "$f" 2>/dev/null | sed 's/^milestone:[[:space:]]*//')
      i_labels=$(awk '
        /^labels:/ { capture=1; next }
        capture && /^  - / { sub(/^  - /, ""); gsub(/"/, ""); print; next }
        capture { exit }
      ' "$f" | paste -sd ',' - | sed 's/,/, /g')
      local ms_str=""
      [[ -n "$i_milestone" && "$i_milestone" != "null" ]] && ms_str=" [$i_milestone]"
      local lbl_str=""
      [[ -n "$i_labels" ]] && lbl_str=" {$i_labels}"
      echo "- #${i_id} ${i_title}${ms_str}${lbl_str}"
      issue_count=$((issue_count + 1))
    done
  fi
  if [[ $issue_count -eq 0 ]]; then
    echo "(no open issues)"
  fi
  echo "Total: $issue_count open issue(s)"
  echo ""

  echo "## PATHS"
  echo "Workspace: $DIR_WORKFLOW/$DIR_WORKSPACE/$developer/"
  echo "Tasks: $DIR_WORKFLOW/$DIR_TASKS/"
  echo "Issues: $DIR_WORKFLOW/$DIR_ISSUES/"
  echo "Spec: $DIR_WORKFLOW/$DIR_SPEC/"
  echo ""

  echo "========================================"
}

# =============================================================================
# Main Entry
# =============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-}" in
    --json|-j)
      output_json
      ;;
    --help|-h)
      echo "Get Session Context for AI Agent"
      echo ""
      echo "Usage:"
      echo "  $0           Output context in text format"
      echo "  $0 --json    Output context in JSON format"
      ;;
    *)
      output_text
      ;;
  esac
fi
