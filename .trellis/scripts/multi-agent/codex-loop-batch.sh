#!/bin/bash
# =============================================================================
# Codex Loop Batch: Sequential Multi-Todo Execution
# =============================================================================
# Reads a todos JSON file and runs codex-loop-live.sh for each entry,
# writing batch-progress.json after every state change so that a Cursor
# assistant can poll the file and sync TodoWrite in real time.
#
# Usage:
#   ./.trellis/scripts/multi-agent/codex-loop-batch.sh --todos-file <path>
#
# Options:
#   --todos-file <path>       Path to the todos JSON file (required)
#   --continue-on-failure     Continue to next todo when one fails
#   --dry-run                 Preview execution plan without running
#   --help                    Show this help
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"
source "$SCRIPT_DIR/../common/worktree.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_batch() { echo -e "${CYAN}[BATCH]${NC} $1"; }
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

PROJECT_ROOT="$(get_repo_root)"
LIVE_SCRIPT="$SCRIPT_DIR/codex-loop-live.sh"
WORKTREE_CONFIG="$(get_worktree_config "$PROJECT_ROOT")"

TODOS_FILE=""
CONTINUE_ON_FAILURE=0
DRY_RUN=0

# =============================================================================
# Argument Parsing
# =============================================================================

show_usage() {
  cat <<'EOF'
Usage:
  ./.trellis/scripts/multi-agent/codex-loop-batch.sh --todos-file <path>

Options:
  --todos-file <path>       Path to the todos JSON file (required)
  --continue-on-failure     Continue to next todo when one fails
  --dry-run                 Preview execution plan without running
  --help                    Show this help

Todos JSON format:
  {
    "verify": ["pnpm type-check"],
    "todos": [
      {
        "name": "task-name",
        "todo_id": "cursor-todo-id",
        "type": "backend",
        "requirement": "What this task should accomplish",
        "task_dir": ".trellis/tasks/03-20-task-name",
        "rounds": 5
      }
    ]
  }
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --todos-file)
        TODOS_FILE="$2"
        shift 2
        ;;
      --continue-on-failure)
        CONTINUE_ON_FAILURE=1
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      --help|-h)
        show_usage
        exit 0
        ;;
      *)
        log_error "Unknown argument: $1"
        show_usage
        exit 1
        ;;
    esac
  done
}

validate_args() {
  [[ -n "$TODOS_FILE" ]] || { log_error "--todos-file is required"; exit 1; }

  if [[ "$TODOS_FILE" != /* ]]; then
    TODOS_FILE="$PROJECT_ROOT/$TODOS_FILE"
  fi

  [[ -f "$TODOS_FILE" ]] || { log_error "Todos file not found: $TODOS_FILE"; exit 1; }
  [[ -x "$LIVE_SCRIPT" ]] || { log_error "codex-loop-live.sh not found or not executable: $LIVE_SCRIPT"; exit 1; }
  command -v jq >/dev/null 2>&1 || { log_error "jq is required"; exit 1; }
}

# =============================================================================
# Progress File Management
# =============================================================================

PROGRESS_FILE=""
TOTAL_TODOS=0
ORIGINAL_VERIFY_BLOCK=""

init_progress_file() {
  PROGRESS_FILE="$(dirname "$TODOS_FILE")/batch-progress.json"

  TOTAL_TODOS=$(jq '.todos | length' "$TODOS_FILE")

  local results="[]"
  local i
  for (( i=0; i<TOTAL_TODOS; i++ )); do
    local name todo_id task_dir
    name=$(jq -r ".todos[$i].name // \"\"" "$TODOS_FILE")
    todo_id=$(jq -r ".todos[$i].todo_id // \"\"" "$TODOS_FILE")
    task_dir=$(jq -r ".todos[$i].task_dir // \"\"" "$TODOS_FILE")

    results=$(echo "$results" | jq \
      --arg name "$name" \
      --arg todo_id "$todo_id" \
      --arg task_dir "$task_dir" \
      '. + [{
        name: $name,
        todo_id: $todo_id,
        state: "pending",
        round: 0,
        task_dir: $task_dir
      }]')
  done

  jq -n \
    --argjson total "$TOTAL_TODOS" \
    --arg updated_at "$(date -Iseconds)" \
    --argjson results "$results" \
    '{
      total: $total,
      current_index: -1,
      updated_at: $updated_at,
      results: $results
    }' > "$PROGRESS_FILE"
}

update_progress() {
  local index="$1"
  local state="$2"
  local round="${3:-0}"

  jq \
    --argjson idx "$index" \
    --arg state "$state" \
    --argjson round "$round" \
    --arg updated_at "$(date -Iseconds)" \
    '.current_index = $idx
     | .updated_at = $updated_at
     | .results[$idx].state = $state
     | .results[$idx].round = $round' \
    "$PROGRESS_FILE" > "${PROGRESS_FILE}.tmp"
  mv "${PROGRESS_FILE}.tmp" "$PROGRESS_FILE"
}

# =============================================================================
# Verify Configuration
# =============================================================================

backup_verify_config() {
  ORIGINAL_VERIFY_BLOCK=$(awk '
    /^verify:/ { found=1; print; next }
    found && /^[[:space:]]+-/ { print; next }
    found && /^[[:space:]]*#/ { print; next }
    found { exit }
  ' "$WORKTREE_CONFIG" 2>/dev/null || true)
}

apply_verify_config() {
  local -a verify_cmds
  readarray -t verify_cmds < <(jq -r '.verify[]? // empty' "$TODOS_FILE" 2>/dev/null)

  [[ ${#verify_cmds[@]} -gt 0 ]] || return 0

  log_batch "applying batch-level verify config to worktree.yaml"

  local new_block="verify:"
  local cmd
  for cmd in "${verify_cmds[@]}"; do
    new_block+=$'\n'"  - $cmd"
  done

  if grep -q '^verify:' "$WORKTREE_CONFIG"; then
    local tmp_config="${WORKTREE_CONFIG}.tmp"
    awk -v block="$new_block" '
      /^verify:/ {
        print block
        skip=1
        next
      }
      skip && /^[[:space:]]+(- |#)/ { next }
      skip { skip=0 }
      { print }
    ' "$WORKTREE_CONFIG" > "$tmp_config"
    mv "$tmp_config" "$WORKTREE_CONFIG"
  else
    printf '\n%s\n' "$new_block" >> "$WORKTREE_CONFIG"
  fi
}

restore_verify_config() {
  local -a verify_cmds
  readarray -t verify_cmds < <(jq -r '.verify[]? // empty' "$TODOS_FILE" 2>/dev/null)

  [[ ${#verify_cmds[@]} -gt 0 ]] || return 0

  log_batch "restoring original worktree.yaml verify config"

  if [[ -n "$ORIGINAL_VERIFY_BLOCK" ]]; then
    local tmp_config="${WORKTREE_CONFIG}.tmp"
    awk -v block="$ORIGINAL_VERIFY_BLOCK" '
      /^verify:/ {
        print block
        skip=1
        next
      }
      skip && /^[[:space:]]+(- |#)/ { next }
      skip { skip=0 }
      { print }
    ' "$WORKTREE_CONFIG" > "$tmp_config"
    mv "$tmp_config" "$WORKTREE_CONFIG"
  else
    local tmp_config="${WORKTREE_CONFIG}.tmp"
    awk '
      /^verify:/ { skip=1; next }
      skip && /^[[:space:]]+(- |#)/ { next }
      skip { skip=0 }
      { print }
    ' "$WORKTREE_CONFIG" > "$tmp_config"
    mv "$tmp_config" "$WORKTREE_CONFIG"
  fi
}

# =============================================================================
# Dry Run
# =============================================================================

print_dry_run() {
  log_batch "=== DRY RUN ==="
  log_batch "todos file: $TODOS_FILE"
  log_batch "progress file: $PROGRESS_FILE"
  log_batch "total todos: $TOTAL_TODOS"
  log_batch "continue on failure: $CONTINUE_ON_FAILURE"
  echo

  local -a verify_cmds
  readarray -t verify_cmds < <(jq -r '.verify[]? // empty' "$TODOS_FILE" 2>/dev/null)
  if [[ ${#verify_cmds[@]} -gt 0 ]]; then
    log_batch "batch verify commands:"
    local cmd
    for cmd in "${verify_cmds[@]}"; do
      echo "  - $cmd"
    done
    echo
  fi

  local i
  for (( i=0; i<TOTAL_TODOS; i++ )); do
    local name type requirement rounds task_dir todo_id
    name=$(jq -r ".todos[$i].name // \"\"" "$TODOS_FILE")
    todo_id=$(jq -r ".todos[$i].todo_id // \"\"" "$TODOS_FILE")
    type=$(jq -r ".todos[$i].type // \"backend\"" "$TODOS_FILE")
    requirement=$(jq -r ".todos[$i].requirement // \"\"" "$TODOS_FILE")
    rounds=$(jq -r ".todos[$i].rounds // 3" "$TODOS_FILE")
    task_dir=$(jq -r ".todos[$i].task_dir // \"\"" "$TODOS_FILE")

    log_batch "[$((i+1))/$TOTAL_TODOS] $name"
    echo "  todo_id:     ${todo_id:-(none)}"
    echo "  type:        $type"
    echo "  rounds:      $rounds"
    echo "  task_dir:    ${task_dir:-(auto)}"
    echo "  requirement: ${requirement:0:120}..."
    echo

    if [[ -n "$task_dir" ]]; then
      "$LIVE_SCRIPT" \
        --name "$name" \
        --type "$type" \
        --requirement "$requirement" \
        --task-dir "$task_dir" \
        --rounds "$rounds" \
        --dry-run 2>&1 | sed 's/^/  /' || true
    else
      "$LIVE_SCRIPT" \
        --name "$name" \
        --type "$type" \
        --requirement "$requirement" \
        --rounds "$rounds" \
        --dry-run 2>&1 | sed 's/^/  /' || true
    fi
    echo
  done

  log_batch "=== END DRY RUN ==="
}

# =============================================================================
# Single Todo Execution
# =============================================================================

run_single_todo() {
  local index="$1"
  local name type requirement rounds task_dir todo_id
  name=$(jq -r ".todos[$index].name // \"\"" "$TODOS_FILE")
  todo_id=$(jq -r ".todos[$index].todo_id // \"\"" "$TODOS_FILE")
  type=$(jq -r ".todos[$index].type // \"backend\"" "$TODOS_FILE")
  requirement=$(jq -r ".todos[$index].requirement // \"\"" "$TODOS_FILE")
  rounds=$(jq -r ".todos[$index].rounds // 3" "$TODOS_FILE")
  task_dir=$(jq -r ".todos[$index].task_dir // \"\"" "$TODOS_FILE")

  log_batch "[$((index+1))/$TOTAL_TODOS] starting: $name (todo_id=${todo_id:-(none)})"
  update_progress "$index" "running" 0

  local -a cmd
  cmd=(
    "$LIVE_SCRIPT"
    --name "$name"
    --type "$type"
    --requirement "$requirement"
    --rounds "$rounds"
  )

  if [[ -n "$task_dir" ]]; then
    cmd+=(--task-dir "$task_dir")
  fi

  set +e
  "${cmd[@]}"
  local rc=$?
  set -e

  if [[ $rc -eq 0 ]]; then
    local final_round=0
    local status_file=""

    if [[ -n "$task_dir" ]]; then
      if [[ "$task_dir" = /* ]]; then
        status_file="$task_dir/codex-loop/status.json"
      else
        status_file="$PROJECT_ROOT/$task_dir/codex-loop/status.json"
      fi
    fi

    if [[ -f "$status_file" ]]; then
      final_round=$(jq -r '.round // 0' "$status_file" 2>/dev/null || echo 0)
    fi

    update_progress "$index" "passed" "$final_round"
    log_ok "[$((index+1))/$TOTAL_TODOS] passed: $name (round $final_round)"
    return 0
  else
    local final_state="failed"
    local final_round=0
    local status_file=""

    if [[ -n "$task_dir" ]]; then
      if [[ "$task_dir" = /* ]]; then
        status_file="$task_dir/codex-loop/status.json"
      else
        status_file="$PROJECT_ROOT/$task_dir/codex-loop/status.json"
      fi
    fi

    if [[ -f "$status_file" ]]; then
      final_state=$(jq -r '.state // "failed"' "$status_file" 2>/dev/null || echo "failed")
      final_round=$(jq -r '.round // 0' "$status_file" 2>/dev/null || echo 0)
    fi

    update_progress "$index" "$final_state" "$final_round"
    log_error "[$((index+1))/$TOTAL_TODOS] $final_state: $name (round $final_round, exit=$rc)"
    return 1
  fi
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
  echo
  log_batch "========== BATCH SUMMARY =========="

  local passed=0 failed=0 stalled=0 skipped=0
  local i
  for (( i=0; i<TOTAL_TODOS; i++ )); do
    local state name todo_id
    state=$(jq -r ".results[$i].state" "$PROGRESS_FILE")
    name=$(jq -r ".results[$i].name" "$PROGRESS_FILE")
    todo_id=$(jq -r ".results[$i].todo_id // \"\"" "$PROGRESS_FILE")

    local icon="?"
    case "$state" in
      passed)  icon="✓"; passed=$((passed+1)) ;;
      failed)  icon="✗"; failed=$((failed+1)) ;;
      stalled) icon="⊘"; stalled=$((stalled+1)) ;;
      pending) icon="-"; skipped=$((skipped+1)) ;;
      *)       icon="?"; skipped=$((skipped+1)) ;;
    esac

    local id_display=""
    [[ -z "$todo_id" ]] || id_display=" (todo_id=$todo_id)"
    log_batch "  [$icon] $name — $state$id_display"
  done

  echo
  log_batch "passed=$passed failed=$failed stalled=$stalled skipped=$skipped total=$TOTAL_TODOS"
  log_batch "progress file: $PROGRESS_FILE"
  log_batch "==================================="

  if [[ $failed -gt 0 || $stalled -gt 0 ]]; then
    return 1
  fi
  return 0
}

# =============================================================================
# Main
# =============================================================================

main() {
  parse_args "$@"
  validate_args

  init_progress_file

  if [[ $DRY_RUN -eq 1 ]]; then
    print_dry_run
    exit 0
  fi

  backup_verify_config
  apply_verify_config

  trap 'restore_verify_config' EXIT

  local batch_failed=0
  local i
  for (( i=0; i<TOTAL_TODOS; i++ )); do
    if ! run_single_todo "$i"; then
      batch_failed=1
      if [[ $CONTINUE_ON_FAILURE -eq 0 ]]; then
        log_warn "stopping batch (use --continue-on-failure to skip failures)"

        local j
        for (( j=i+1; j<TOTAL_TODOS; j++ )); do
          update_progress "$j" "skipped" 0
        done

        break
      fi
    fi
  done

  print_summary
  local summary_rc=$?

  if [[ $batch_failed -eq 1 ]]; then
    exit 1
  fi
  exit $summary_rc
}

main "$@"
