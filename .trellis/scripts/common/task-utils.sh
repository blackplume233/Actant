#!/bin/bash
# Task utility functions
#
# Usage: source this file in other scripts
#   source "$(dirname "$0")/common/task-utils.sh"
#
# Provides:
#   is_safe_task_path      - Validate task path is safe to operate on
#   find_task_by_name      - Find task directory by name
#   archive_task_dir       - Archive task to monthly directory
#   validate_task_schema   - Validate task.json against Trellis minimum schema
#   resolve_task_base_branch - Resolve PR base branch with safe fallback order

# Ensure dependencies are loaded
if ! type get_repo_root &>/dev/null; then
  echo "Error: paths.sh must be sourced before task-utils.sh" >&2
  exit 1
fi

TASK_REQUIRED_FIELDS=(
  "id"
  "name"
  "title"
  "status"
  "dev_type"
  "branch"
  "base_branch"
  "current_phase"
  "createdAt"
  "completedAt"
)

TASK_ALLOWED_STATUSES=(
  "planning"
  "in_progress"
  "review"
  "completed"
  "archived"
)

task_field_raw() {
  local task_json="$1"
  local field="$2"

  jq -r --arg field "$field" '
    if has($field) then
      .[$field]
    else
      "__TASK_FIELD_MISSING__"
    end
  ' "$task_json" 2>/dev/null
}

task_field_or_empty() {
  local task_json="$1"
  local field="$2"
  local value

  value=$(task_field_raw "$task_json" "$field")
  if [[ "$value" == "__TASK_FIELD_MISSING__" ]] || [[ "$value" == "null" ]]; then
    echo ""
  else
    echo "$value"
  fi
}

task_has_field() {
  local task_json="$1"
  local field="$2"

  jq -e --arg field "$field" 'has($field)' "$task_json" >/dev/null 2>&1
}

task_missing_required_fields() {
  local task_json="$1"
  local field

  for field in "${TASK_REQUIRED_FIELDS[@]}"; do
    if ! task_has_field "$task_json" "$field"; then
      echo "$field"
    fi
  done
}

is_valid_task_status() {
  local status="$1"
  local allowed

  for allowed in "${TASK_ALLOWED_STATUSES[@]}"; do
    if [[ "$status" == "$allowed" ]]; then
      return 0
    fi
  done

  return 1
}

task_status_warning() {
  local task_json="$1"
  local status

  status=$(task_field_or_empty "$task_json" "status")
  if [[ -z "$status" ]]; then
    echo "missing status"
    return 0
  fi

  if ! is_valid_task_status "$status"; then
    echo "unknown status '$status'"
  fi
}

validate_task_schema() {
  local task_json="$1"
  local label="${2:-$task_json}"
  local quiet="${3:-false}"
  local failed=0
  local missing_fields=()
  local status_warning=""
  local field

  if [[ ! -f "$task_json" ]]; then
    [[ "$quiet" != "true" ]] && echo "Task schema error [$label]: task.json not found" >&2
    return 1
  fi

  if ! jq empty "$task_json" >/dev/null 2>&1; then
    [[ "$quiet" != "true" ]] && echo "Task schema error [$label]: invalid JSON" >&2
    return 1
  fi

  while IFS= read -r field; do
    [[ -z "$field" ]] && continue
    missing_fields+=("$field")
  done < <(task_missing_required_fields "$task_json")

  if [[ "${#missing_fields[@]}" -gt 0 ]]; then
    failed=1
    if [[ "$quiet" != "true" ]]; then
      echo "Task schema error [$label]: missing required fields: ${missing_fields[*]}" >&2
    fi
  fi

  status_warning=$(task_status_warning "$task_json")
  if [[ -n "$status_warning" ]]; then
    failed=1
    if [[ "$quiet" != "true" ]]; then
      echo "Task schema error [$label]: ${status_warning}" >&2
    fi
  fi

  return "$failed"
}

collect_task_schema_warnings() {
  local task_json="$1"
  local label="${2:-$task_json}"
  local warnings=()
  local field
  local status_warning=""

  while IFS= read -r field; do
    [[ -z "$field" ]] && continue
    warnings+=("schema drift: missing ${field}")
  done < <(task_missing_required_fields "$task_json")

  status_warning=$(task_status_warning "$task_json")
  if [[ -n "$status_warning" ]]; then
    warnings+=("schema drift: ${status_warning}")
  fi

  local warning
  for warning in "${warnings[@]}"; do
    echo "WARNING [$label] $warning"
  done
}

resolve_repo_default_branch() {
  local repo_root="${1:-$(get_repo_root)}"
  local origin_head=""

  origin_head=$(git -C "$repo_root" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [[ -n "$origin_head" ]]; then
    echo "${origin_head#origin/}"
    return 0
  fi

  if git -C "$repo_root" show-ref --verify --quiet refs/heads/master || \
     git -C "$repo_root" show-ref --verify --quiet refs/remotes/origin/master; then
    echo "master"
    return 0
  fi

  if git -C "$repo_root" show-ref --verify --quiet refs/heads/main || \
     git -C "$repo_root" show-ref --verify --quiet refs/remotes/origin/main; then
    echo "main"
    return 0
  fi

  git -C "$repo_root" branch --show-current 2>/dev/null || echo "main"
}

resolve_task_base_branch() {
  local task_json="$1"
  local repo_root="${2:-$(get_repo_root)}"
  local base_branch=""

  base_branch=$(task_field_or_empty "$task_json" "base_branch")
  if [[ -n "$base_branch" ]]; then
    echo "$base_branch"
    return 0
  fi

  resolve_repo_default_branch "$repo_root"
}

resolve_task_name() {
  local task_json="$1"
  local name=""

  name=$(task_field_or_empty "$task_json" "name")
  if [[ -n "$name" ]]; then
    echo "$name"
    return 0
  fi

  name=$(task_field_or_empty "$task_json" "id")
  if [[ -n "$name" ]]; then
    echo "$name"
    return 0
  fi

  echo "unknown"
}

resolve_task_title() {
  local task_json="$1"
  local title=""

  title=$(task_field_or_empty "$task_json" "title")
  if [[ -n "$title" ]]; then
    echo "$title"
    return 0
  fi

  title=$(task_field_or_empty "$task_json" "requirement")
  if [[ -n "$title" ]]; then
    echo "$title"
    return 0
  fi

  resolve_task_name "$task_json"
}

resolve_task_status() {
  local task_json="$1"
  local status=""

  status=$(task_field_or_empty "$task_json" "status")
  if [[ -n "$status" ]]; then
    echo "$status"
  else
    echo "unknown"
  fi
}

# =============================================================================
# Path Safety
# =============================================================================

# Check if a relative task path is safe to operate on
# Args: task_path (relative), repo_root
# Returns: 0 if safe, 1 if dangerous
# Outputs: error message to stderr if unsafe
is_safe_task_path() {
  local task_path="$1"
  local repo_root="${2:-$(get_repo_root)}"

  # Check empty or null
  if [[ -z "$task_path" ]] || [[ "$task_path" = "null" ]]; then
    echo "Error: empty or null task path" >&2
    return 1
  fi

  # Reject absolute paths
  if [[ "$task_path" = /* ]]; then
    echo "Error: absolute path not allowed: $task_path" >&2
    return 1
  fi

  # Reject ".", "..", paths starting with "./" or "../", or containing ".."
  if [[ "$task_path" = "." ]] || [[ "$task_path" = ".." ]] || \
     [[ "$task_path" = "./" ]] || [[ "$task_path" == ./* ]] || \
     [[ "$task_path" == *".."* ]]; then
    echo "Error: path traversal not allowed: $task_path" >&2
    return 1
  fi

  # Final check: ensure resolved path is not the repo root
  local abs_path="${repo_root}/${task_path}"
  if [[ -e "$abs_path" ]]; then
    local resolved=$(realpath "$abs_path" 2>/dev/null)
    local root_resolved=$(realpath "$repo_root" 2>/dev/null)
    if [[ "$resolved" = "$root_resolved" ]]; then
      echo "Error: path resolves to repo root: $task_path" >&2
      return 1
    fi
  fi

  return 0
}

# =============================================================================
# Task Lookup
# =============================================================================

# Find task directory by name (exact or suffix match)
# Args: task_name, tasks_dir
# Returns: absolute path to task directory, or empty if not found
find_task_by_name() {
  local task_name="$1"
  local tasks_dir="$2"

  if [[ -z "$task_name" ]] || [[ -z "$tasks_dir" ]]; then
    return 1
  fi

  # Try exact match first
  local task_dir=$(find "$tasks_dir" -maxdepth 1 -type d -name "${task_name}" 2>/dev/null | head -1)

  # Try suffix match (e.g., "my-task" matches "01-21-my-task")
  if [[ -z "$task_dir" ]]; then
    task_dir=$(find "$tasks_dir" -maxdepth 1 -type d -name "*-${task_name}" 2>/dev/null | head -1)
  fi

  if [[ -n "$task_dir" ]] && [[ -d "$task_dir" ]]; then
    echo "$task_dir"
    return 0
  fi

  return 1
}

# =============================================================================
# Archive Operations
# =============================================================================

# Archive a task directory to archive/{YYYY-MM}/
# Args: task_dir_abs, [repo_root]
# Returns: 0 on success, 1 on error
# Outputs: archive destination path
archive_task_dir() {
  local task_dir_abs="$1"
  local repo_root="${2:-$(get_repo_root)}"

  if [[ ! -d "$task_dir_abs" ]]; then
    echo "Error: task directory not found: $task_dir_abs" >&2
    return 1
  fi

  # Get tasks directory (parent of the task)
  local tasks_dir=$(dirname "$task_dir_abs")
  local archive_dir="$tasks_dir/archive"
  local year_month=$(date +%Y-%m)
  local month_dir="$archive_dir/$year_month"

  # Create archive directory
  mkdir -p "$month_dir"

  # Move task to archive
  local task_name=$(basename "$task_dir_abs")
  mv "$task_dir_abs" "$month_dir/"

  # Output the destination
  echo "$month_dir/$task_name"
  return 0
}

# Complete archive workflow: archive directory
# Args: task_dir_abs, [repo_root]
# Returns: 0 on success
# Outputs: lines with status info
archive_task_complete() {
  local task_dir_abs="$1"
  local repo_root="${2:-$(get_repo_root)}"

  if [[ ! -d "$task_dir_abs" ]]; then
    echo "Error: task directory not found: $task_dir_abs" >&2
    return 1
  fi

  # Archive the directory
  local archive_dest
  if archive_dest=$(archive_task_dir "$task_dir_abs" "$repo_root"); then
    echo "archived_to:$archive_dest"
    return 0
  fi

  return 1
}
