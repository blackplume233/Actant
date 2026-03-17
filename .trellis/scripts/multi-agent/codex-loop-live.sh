#!/bin/bash
# =============================================================================
# Codex Loop Live Wrapper
# =============================================================================
# Runs codex-loop.sh and continuously forwards task status plus recent log
# activity to stdout, so the current UI never goes silent during loop execution.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"

PROJECT_ROOT="$(get_repo_root)"
INNER_SCRIPT="$SCRIPT_DIR/codex-loop.sh"
POLL_INTERVAL="${CODEX_LOOP_LIVE_POLL_INTERVAL:-2}"
HEARTBEAT_INTERVAL="${CODEX_LOOP_LIVE_HEARTBEAT_INTERVAL:-15}"

BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_live() { echo -e "${BLUE}[LIVE]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

ORIGINAL_ARGS=("$@")
HAS_DRY_RUN=0

for arg in "${ORIGINAL_ARGS[@]:-}"; do
  if [[ "$arg" == "--dry-run" ]]; then
    HAS_DRY_RUN=1
    break
  fi
done

if [[ ! -x "$INNER_SCRIPT" ]]; then
  log_error "Inner loop script not found or not executable: $INNER_SCRIPT"
  exit 1
fi

extract_preview_field() {
  local field="$1"
  local text="$2"
  printf '%s\n' "$text" | sed -n "s/^${field}:[[:space:]]*//p" | head -1
}

latest_log_file() {
  local loop_dir="$1"
  local candidate=""
  local candidate_mtime=0
  local file
  while IFS= read -r file; do
    [[ -f "$file" ]] || continue
    local mtime=0
    mtime=$(stat -f '%m' "$file" 2>/dev/null || stat -c '%Y' "$file" 2>/dev/null || echo 0)
    if [[ "$mtime" =~ ^[0-9]+$ ]] && (( mtime >= candidate_mtime )); then
      candidate="$file"
      candidate_mtime="$mtime"
    fi
  done < <(find "$loop_dir" -type f \( -name 'implement.log' -o -name 'check.log' -o -name 'verify.log' \) 2>/dev/null)

  printf '%s\n' "$candidate"
}

last_non_empty_line() {
  local file="$1"
  awk 'NF { last=$0 } END { print last }' "$file" 2>/dev/null
}

print_feedback_excerpt() {
  local feedback_file="$1"
  [[ -f "$feedback_file" ]] || return 0
  log_live "latest feedback updated:"
  sed -n '1,12p' "$feedback_file"
}

run_preview() {
  local preview_output=""
  set +e
  preview_output=$("$INNER_SCRIPT" "${ORIGINAL_ARGS[@]}" --dry-run 2>&1)
  local rc=$?
  set -e

  printf '%s\n' "$preview_output"
  return "$rc"
}

if [[ $HAS_DRY_RUN -eq 1 ]]; then
  exec "$INNER_SCRIPT" "${ORIGINAL_ARGS[@]}"
fi

PREVIEW_OUTPUT="$(run_preview)" || exit $?

TASK_DIR_REL="$(extract_preview_field "Task dir" "$PREVIEW_OUTPUT")"
WORKTREE_PATH="$(extract_preview_field "Worktree" "$PREVIEW_OUTPUT")"
BRANCH="$(extract_preview_field "Branch" "$PREVIEW_OUTPUT")"
VERIFY_MODE="$(extract_preview_field "Verify mode" "$PREVIEW_OUTPUT")"

if [[ -z "$TASK_DIR_REL" ]]; then
  log_error "Failed to determine task directory from dry-run preview."
  exit 1
fi

if [[ "$TASK_DIR_REL" = /* ]]; then
  TASK_DIR_ABS="$TASK_DIR_REL"
else
  TASK_DIR_ABS="$PROJECT_ROOT/$TASK_DIR_REL"
fi

LOOP_DIR="$TASK_DIR_ABS/codex-loop"
STATUS_FILE="$LOOP_DIR/status.json"
FEEDBACK_FILE="$LOOP_DIR/last-feedback.md"
RUN_LOG="$LOOP_DIR/live-wrapper.log"
mkdir -p "$LOOP_DIR"

log_live "starting codex loop with live reporting"
log_live "task=$TASK_DIR_REL branch=${BRANCH:-unknown} verify=${VERIFY_MODE:-unknown}"
if [[ -n "$WORKTREE_PATH" ]]; then
  log_live "worktree=$WORKTREE_PATH"
fi

"$INNER_SCRIPT" "${ORIGINAL_ARGS[@]}" > >(tee -a "$RUN_LOG") 2> >(tee -a "$RUN_LOG" >&2) &
LOOP_PID=$!

LAST_STATUS_SIG=""
LAST_FEEDBACK_MTIME=""
LAST_ACTIVE_LOG=""
LAST_ACTIVE_LINE=""
LAST_HEARTBEAT_AT=0

while kill -0 "$LOOP_PID" 2>/dev/null; do
  now=$(date +%s)
  emitted=0

  if [[ -f "$STATUS_FILE" ]]; then
    status_sig="$(jq -r '[.state, (.round|tostring), .detail, .updated_at, .verify_mode] | @tsv' "$STATUS_FILE" 2>/dev/null || true)"
    if [[ -n "$status_sig" && "$status_sig" != "$LAST_STATUS_SIG" ]]; then
      state="$(jq -r '.state // "unknown"' "$STATUS_FILE" 2>/dev/null || echo "unknown")"
      round="$(jq -r '.round // 0' "$STATUS_FILE" 2>/dev/null || echo "0")"
      detail="$(jq -r '.detail // ""' "$STATUS_FILE" 2>/dev/null || echo "")"
      changed_count="$(jq -r '(.changed_files // []) | length' "$STATUS_FILE" 2>/dev/null || echo "0")"
      artifact_count="$(jq -r '(.task_artifacts // []) | length' "$STATUS_FILE" 2>/dev/null || echo "0")"
      log_live "status: state=$state round=$round changed_files=$changed_count task_artifacts=$artifact_count detail=${detail:-none}"
      LAST_STATUS_SIG="$status_sig"
      LAST_HEARTBEAT_AT="$now"
      emitted=1
    fi
  fi

  if [[ -f "$FEEDBACK_FILE" ]]; then
    feedback_mtime="$(stat -f '%m' "$FEEDBACK_FILE" 2>/dev/null || stat -c '%Y' "$FEEDBACK_FILE" 2>/dev/null || echo "")"
    if [[ -n "$feedback_mtime" && "$feedback_mtime" != "$LAST_FEEDBACK_MTIME" ]]; then
      print_feedback_excerpt "$FEEDBACK_FILE"
      LAST_FEEDBACK_MTIME="$feedback_mtime"
      LAST_HEARTBEAT_AT="$now"
      emitted=1
    fi
  fi

  active_log="$(latest_log_file "$LOOP_DIR")"
  if [[ -n "$active_log" && -f "$active_log" ]]; then
    active_line="$(last_non_empty_line "$active_log")"
    if [[ -n "$active_line" ]]; then
      active_sig="${active_log}|${active_line}"
      if [[ "$active_sig" != "${LAST_ACTIVE_LOG}|${LAST_ACTIVE_LINE}" ]]; then
        log_live "$(basename "$active_log"): $active_line"
        LAST_ACTIVE_LOG="$active_log"
        LAST_ACTIVE_LINE="$active_line"
        LAST_HEARTBEAT_AT="$now"
        emitted=1
      fi
    fi
  fi

    if [[ $emitted -eq 0 && $LAST_HEARTBEAT_AT -gt 0 && $((now - LAST_HEARTBEAT_AT)) -ge $HEARTBEAT_INTERVAL ]]; then
      if [[ -f "$STATUS_FILE" ]]; then
        state="$(jq -r '.state // "unknown"' "$STATUS_FILE" 2>/dev/null || echo "unknown")"
        round="$(jq -r '.round // 0' "$STATUS_FILE" 2>/dev/null || echo "0")"
        detail="$(jq -r '.detail // ""' "$STATUS_FILE" 2>/dev/null || echo "")"
        changed_count="$(jq -r '(.changed_files // []) | length' "$STATUS_FILE" 2>/dev/null || echo "0")"
        artifact_count="$(jq -r '(.task_artifacts // []) | length' "$STATUS_FILE" 2>/dev/null || echo "0")"
        log_live "heartbeat: state=$state round=$round changed_files=$changed_count task_artifacts=$artifact_count detail=${detail:-none}"
      else
        log_live "heartbeat: waiting for loop status file"
      fi
    LAST_HEARTBEAT_AT="$now"
  fi

  sleep "$POLL_INTERVAL"
done

set +e
wait "$LOOP_PID"
LOOP_RC=$?
set -e

if [[ -f "$STATUS_FILE" ]]; then
  final_state="$(jq -r '.state // "unknown"' "$STATUS_FILE" 2>/dev/null || echo "unknown")"
  final_round="$(jq -r '.round // 0' "$STATUS_FILE" 2>/dev/null || echo "0")"
  final_detail="$(jq -r '.detail // ""' "$STATUS_FILE" 2>/dev/null || echo "")"
  log_live "final: state=$final_state round=$final_round detail=${final_detail:-none}"
fi

if [[ -f "$FEEDBACK_FILE" ]]; then
  print_feedback_excerpt "$FEEDBACK_FILE"
fi

if [[ $LOOP_RC -ne 0 ]]; then
  log_warn "codex loop exited with code $LOOP_RC"
fi

exit "$LOOP_RC"
