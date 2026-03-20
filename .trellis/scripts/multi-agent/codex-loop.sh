#!/bin/bash
# =============================================================================
# Codex Ralph Loop: Implement -> Check -> Retry
# =============================================================================
# Usage:
#   ./.trellis/scripts/multi-agent/codex-loop.sh \
#     --name <task-name> \
#     --type <backend|frontend|fullstack|test|docs> \
#     --requirement "<requirement>"
#
# This script:
# 1. Creates a Trellis task directory (or reuses an existing one)
# 2. Creates an isolated worktree on a `codex/` branch
# 3. Runs Codex implement/check passes in a loop
# 4. Uses worktree.yaml verify commands as the quality gate when configured
# 5. Writes status and logs into the task directory
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/paths.sh"
source "$SCRIPT_DIR/../common/worktree.sh"
source "$SCRIPT_DIR/../common/developer.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

PROJECT_ROOT="$(get_repo_root)"
TASK_HELPER="$PROJECT_ROOT/.trellis/scripts/task.sh"
CODEX_BIN="${CODEX_BIN:-$(command -v codex || true)}"
DEFAULT_MODEL="gpt-5.4"
DEFAULT_SANDBOX="workspace-write"
DEFAULT_APPROVAL="never"
DEFAULT_MAX_ROUNDS=3

TASK_NAME=""
TASK_SLUG=""
DEV_TYPE=""
REQUIREMENT=""
TASK_DIR_INPUT=""
MODEL="$DEFAULT_MODEL"
SANDBOX="$DEFAULT_SANDBOX"
APPROVAL="$DEFAULT_APPROVAL"
MAX_ROUNDS="$DEFAULT_MAX_ROUNDS"
ENABLE_SEARCH=0
DRY_RUN=0

WORKTREE_PATH=""
TASK_DIR_REL=""
TASK_DIR_ABS=""
TASK_JSON=""
WORKTREE_TASK_DIR=""
STATUS_FILE=""
LAST_FEEDBACK_FILE=""
LOOP_LOG_DIR=""
BRANCH=""
BASE_BRANCH=""
DEV_ENV_FILE=""
VERIFY_MODE=""
NO_PROGRESS_ROUNDS=0

hash_stream() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    cksum | awk '{print $1}'
  fi
}

collect_git_changed_files() {
  {
    git -C "$WORKTREE_PATH" diff --name-only 2>/dev/null
    git -C "$WORKTREE_PATH" diff --cached --name-only 2>/dev/null
    git -C "$WORKTREE_PATH" ls-files --others --exclude-standard 2>/dev/null
  } | awk 'NF' | sort -u
}

collect_task_artifact_files() {
  [[ -d "$WORKTREE_TASK_DIR" ]] || return 0

  find "$WORKTREE_TASK_DIR" -type f \
    ! -path "$WORKTREE_TASK_DIR/codex-loop/*" \
    ! -name '*.log' \
    | sed "s#^$WORKTREE_PATH/##" \
    | sort
}

compute_task_artifact_signature() {
  [[ -d "$WORKTREE_TASK_DIR" ]] || {
    printf 'none\n'
    return 0
  }

  {
    while IFS= read -r rel; do
      [[ -n "$rel" ]] || continue
      local abs="$WORKTREE_PATH/$rel"
      [[ -f "$abs" ]] || continue
      printf '%s\t' "$rel"
      hash_stream < "$abs"
    done < <(collect_task_artifact_files)
  } | hash_stream
}

compute_progress_signature() {
  {
    printf 'git-diff\n'
    git -C "$WORKTREE_PATH" diff --stat 2>/dev/null || true
    printf 'git-cached\n'
    git -C "$WORKTREE_PATH" diff --cached --stat 2>/dev/null || true
    printf 'git-untracked\n'
    collect_git_changed_files || true
    printf 'task-artifacts\n'
    compute_task_artifact_signature
  } | hash_stream
}

show_usage() {
  cat <<'EOF'
Usage:
  ./.trellis/scripts/multi-agent/codex-loop.sh \
    --name <task-name> \
    --type <backend|frontend|fullstack|test|docs> \
    --requirement "<requirement>"

Options:
  --task-dir <dir>         Reuse an existing task directory
  --rounds <n>             Maximum implement/check rounds (default: 3)
  --model <model>          Codex model (default: gpt-5.4)
  --sandbox <mode>         Codex sandbox mode (default: workspace-write)
  --approval <policy>      Codex approval policy (default: never)
  --search                 Enable Codex web search during exec runs
  --dry-run                Print the planned setup and exit
  --help                   Show this help

Examples:
  ./.trellis/scripts/multi-agent/codex-loop.sh \
    --name hub-bootstrap \
    --type backend \
    --requirement "Make CLI-first hub/bootstrap usable for self-hosting"

  ./.trellis/scripts/multi-agent/codex-loop.sh \
    --task-dir .trellis/tasks/03-17-hub-bootstrap \
    --name hub-bootstrap \
    --type backend \
    --requirement "Continue the bootstrap loop"
EOF
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
}

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/--*/-/g' \
    | sed 's/^-//' \
    | sed 's/-$//'
}

update_status() {
  local state="$1"
  local round="$2"
  local detail="$3"
  local changed_files
  local task_artifacts
  local progress_signature
  changed_files=$(collect_git_changed_files | jq -R . | jq -s .)
  task_artifacts=$(collect_task_artifact_files | jq -R . | jq -s .)
  progress_signature=$(compute_progress_signature)

  jq -n \
    --arg state "$state" \
    --arg round "$round" \
    --arg branch "$BRANCH" \
    --arg task_dir "$TASK_DIR_REL" \
    --arg worktree "$WORKTREE_PATH" \
    --arg model "$MODEL" \
    --arg detail "$detail" \
    --arg verify_mode "$VERIFY_MODE" \
    --arg progress_signature "$progress_signature" \
    --arg updated_at "$(date -Iseconds)" \
    --argjson changed_files "${changed_files:-[]}" \
    --argjson task_artifacts "${task_artifacts:-[]}" \
    '{
      state: $state,
      round: ($round | tonumber),
      branch: $branch,
      task_dir: $task_dir,
      worktree_path: $worktree,
      model: $model,
      verify_mode: $verify_mode,
      detail: $detail,
      changed_files: $changed_files,
      task_artifacts: $task_artifacts,
      progress_signature: $progress_signature,
      updated_at: $updated_at
    }' > "$STATUS_FILE"
}

strip_ansi_stream() {
  sed -E $'s/\x1B\\[[0-9;]*[[:alpha:]]//g'
}

append_excerpt_block() {
  local title="$1"
  local file="$2"
  local limit="$3"
  local output_file="$4"

  [[ -f "$file" ]] || return 0

  {
    echo "## $title"
    echo
    echo '```text'
    strip_ansi_stream < "$file" | sed -n "1,${limit}p"
    echo '```'
    echo
  } >> "$output_file"
}

append_path_list() {
  local title="$1"
  local output_file="$2"
  shift 2

  {
    echo "## $title"
    if [[ $# -eq 0 ]]; then
      echo
      echo "- 无"
    else
      local item
      echo
      for item in "$@"; do
        [[ -n "$item" ]] || continue
        echo "- \`$item\`"
      done
    fi
    echo
  } >> "$output_file"
}

record_round_session() {
  local round="$1"
  local round_outcome="$2"
  local check_result="$3"
  local verify_result="$4"
  local detail="$5"
  local round_dir="$6"

  local content_file="$round_dir/session-record.md"
  local title="Codex Loop 第${round}轮 - ${TASK_NAME}"
  local summary="第${round}轮${round_outcome}。检查结果：${check_result}；Shell Verify：${verify_result}。${detail}"

  local changed_files=()
  local task_artifacts=()
  local path_item
  while IFS= read -r path_item; do
    changed_files+=("$path_item")
  done < <(collect_git_changed_files)
  while IFS= read -r path_item; do
    task_artifacts+=("$path_item")
  done < <(collect_task_artifact_files)

  {
    echo "## 轮次概览"
    echo
    echo "- 任务名称：\`$TASK_NAME\`"
    echo "- 任务目录：\`$TASK_DIR_REL\`"
    echo "- 分支：\`$BRANCH\`"
    echo "- 工作树：\`$WORKTREE_PATH\`"
    echo "- 轮次：\`$round / $MAX_ROUNDS\`"
    echo "- 本轮结论：$round_outcome"
    echo "- 检查结果：$check_result"
    echo "- Shell Verify：$verify_result"
    echo "- 说明：$detail"
    echo
  } > "$content_file"

  append_path_list "本轮变更文件" "$content_file" "${changed_files[@]}"
  append_path_list "任务产物" "$content_file" "${task_artifacts[@]}"
  append_excerpt_block "Implement 输出摘录" "$round_dir/implement-last.md" 80 "$content_file"
  append_excerpt_block "Check 输出摘录" "$round_dir/check-last.md" 120 "$content_file"
  append_excerpt_block "Shell Verify 摘录" "$round_dir/verify.log" 120 "$content_file"
  append_excerpt_block "最新反馈摘录" "$LAST_FEEDBACK_FILE" 120 "$content_file"

  if ! (
    cd "$PROJECT_ROOT"
    "$PROJECT_ROOT/.trellis/scripts/add-session.sh" \
      --title "$title" \
      --commit "-" \
      --lang zh \
      --summary "$summary" \
      --content-file "$content_file"
  ); then
    log_warn "Round $round/$MAX_ROUNDS: failed to record session"
    return 1
  fi

  log_info "Round $round/$MAX_ROUNDS: session recorded"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name|-n)
        TASK_NAME="$2"
        shift 2
        ;;
      --type|-t)
        DEV_TYPE="$2"
        shift 2
        ;;
      --requirement|-r)
        REQUIREMENT="$2"
        shift 2
        ;;
      --task-dir)
        TASK_DIR_INPUT="$2"
        shift 2
        ;;
      --rounds)
        MAX_ROUNDS="$2"
        shift 2
        ;;
      --model|-m)
        MODEL="$2"
        shift 2
        ;;
      --sandbox|-s)
        SANDBOX="$2"
        shift 2
        ;;
      --approval|-a)
        APPROVAL="$2"
        shift 2
        ;;
      --search)
        ENABLE_SEARCH=1
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
  [[ -n "$TASK_NAME" ]] || { log_error "--name is required"; exit 1; }
  [[ -n "$DEV_TYPE" ]] || { log_error "--type is required"; exit 1; }
  [[ -n "$REQUIREMENT" ]] || { log_error "--requirement is required"; exit 1; }
  [[ "$MAX_ROUNDS" =~ ^[0-9]+$ ]] || { log_error "--rounds must be an integer"; exit 1; }

  case "$DEV_TYPE" in
    backend|frontend|fullstack|test|docs) ;;
    *)
      log_error "Invalid --type: $DEV_TYPE"
      exit 1
      ;;
  esac

  TASK_SLUG="$(slugify "$TASK_NAME")"
  [[ -n "$TASK_SLUG" ]] || { log_error "--name must contain at least one alphanumeric character"; exit 1; }
}

prepare_task_dir() {
  if [[ $DRY_RUN -eq 1 && -z "$TASK_DIR_INPUT" ]]; then
    local date_prefix
    date_prefix=$(generate_task_date_prefix)
    TASK_DIR_REL="$DIR_WORKFLOW/$DIR_TASKS/${date_prefix}-${TASK_SLUG}"
    TASK_DIR_ABS="$PROJECT_ROOT/$TASK_DIR_REL"
    TASK_JSON="$TASK_DIR_ABS/$FILE_TASK_JSON"
    BASE_BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current)
    BRANCH="codex/$(basename "$TASK_DIR_REL")"
    LOOP_LOG_DIR="$TASK_DIR_ABS/codex-loop"
    STATUS_FILE="$LOOP_LOG_DIR/status.json"
    LAST_FEEDBACK_FILE="$LOOP_LOG_DIR/last-feedback.md"
    return
  fi

  if [[ -n "$TASK_DIR_INPUT" ]]; then
    if [[ "$TASK_DIR_INPUT" = /* ]]; then
      TASK_DIR_ABS="$TASK_DIR_INPUT"
      TASK_DIR_REL="${TASK_DIR_INPUT#$PROJECT_ROOT/}"
    else
      TASK_DIR_REL="$TASK_DIR_INPUT"
      TASK_DIR_ABS="$PROJECT_ROOT/$TASK_DIR_INPUT"
    fi

    [[ -d "$TASK_DIR_ABS" ]] || { log_error "Task directory not found: $TASK_DIR_ABS"; exit 1; }
  else
    TASK_DIR_REL=$("$TASK_HELPER" create "$REQUIREMENT" --slug "$TASK_SLUG" --assignee "$(get_developer "$PROJECT_ROOT")")
    "$TASK_HELPER" init-context "$TASK_DIR_REL" "$DEV_TYPE"
    TASK_DIR_ABS="$PROJECT_ROOT/$TASK_DIR_REL"
  fi

  TASK_JSON="$TASK_DIR_ABS/$FILE_TASK_JSON"
  [[ -f "$TASK_JSON" ]] || { log_error "task.json missing at $TASK_JSON"; exit 1; }

  if [[ ! -f "$TASK_DIR_ABS/prd.md" ]]; then
    cat > "$TASK_DIR_ABS/prd.md" <<EOF
# $TASK_SLUG

## Requirement

$REQUIREMENT

## Loop Goal

Use Codex implement/check rounds until the change is ready for the configured verification gate.
EOF
  fi

  BASE_BRANCH=$(jq -r '.base_branch // empty' "$TASK_JSON")
  if [[ -z "$BASE_BRANCH" || "$BASE_BRANCH" == "null" ]]; then
    BASE_BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current)
  fi

  BRANCH=$(jq -r '.branch // empty' "$TASK_JSON")
  if [[ -z "$BRANCH" || "$BRANCH" == "null" ]]; then
    BRANCH="codex/$(basename "$TASK_DIR_REL")"
  fi

  jq \
    --arg dev_type "$DEV_TYPE" \
    --arg branch "$BRANCH" \
    '.dev_type = $dev_type | .branch = $branch | .status = "in_progress" | .current_phase = 1' \
    "$TASK_JSON" > "${TASK_JSON}.tmp"
  mv "${TASK_JSON}.tmp" "$TASK_JSON"

  LOOP_LOG_DIR="$TASK_DIR_ABS/codex-loop"
  mkdir -p "$LOOP_LOG_DIR"
  STATUS_FILE="$LOOP_LOG_DIR/status.json"
  LAST_FEEDBACK_FILE="$LOOP_LOG_DIR/last-feedback.md"
}

create_or_reuse_worktree() {
  local worktree_base
  worktree_base=$(get_worktree_base_dir "$PROJECT_ROOT")
  mkdir -p "$worktree_base"
  worktree_base="$(cd "$worktree_base" && pwd)"
  WORKTREE_PATH="$worktree_base/$BRANCH"
  WORKTREE_TASK_DIR="$WORKTREE_PATH/$TASK_DIR_REL"

  if [[ -d "$WORKTREE_PATH/.git" || -f "$WORKTREE_PATH/.git" ]]; then
    log_info "Reusing existing worktree: $WORKTREE_PATH"
  else
    mkdir -p "$(dirname "$WORKTREE_PATH")"
    if git -C "$PROJECT_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
      git -C "$PROJECT_ROOT" worktree add "$WORKTREE_PATH" "$BRANCH"
    else
      git -C "$PROJECT_ROOT" worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BASE_BRANCH"
    fi

    while IFS= read -r item; do
      [[ -n "$item" ]] || continue
      if [[ -f "$PROJECT_ROOT/$item" ]]; then
        mkdir -p "$(dirname "$WORKTREE_PATH/$item")"
        cp "$PROJECT_ROOT/$item" "$WORKTREE_PATH/$item"
      fi
    done < <(get_worktree_copy_files "$PROJECT_ROOT")

    while IFS= read -r hook; do
      [[ -n "$hook" ]] || continue
      (cd "$WORKTREE_PATH" && eval "$hook")
    done < <(get_worktree_post_create_hooks "$PROJECT_ROOT")
  fi

  mkdir -p "$(dirname "$WORKTREE_TASK_DIR")"
  rm -rf "$WORKTREE_TASK_DIR"
  cp -R "$TASK_DIR_ABS" "$(dirname "$WORKTREE_TASK_DIR")/"

  mkdir -p "$WORKTREE_PATH/.trellis"
  echo "$TASK_DIR_REL" > "$WORKTREE_PATH/.trellis/.current-task"

  jq --arg path "$WORKTREE_PATH" '.worktree_path = $path' "$TASK_JSON" > "${TASK_JSON}.tmp"
  mv "${TASK_JSON}.tmp" "$TASK_JSON"
}

prepare_worktree_runtime() {
  DEV_ENV_FILE="$WORKTREE_PATH/.worktree-env.sh"

  if [[ -x /opt/homebrew/opt/node@22/bin/node ]]; then
    cat > "$DEV_ENV_FILE" <<'EOF'
export PATH=/opt/homebrew/opt/node@22/bin:$PATH
export ACTANT_BOOTSTRAP_NODE=/opt/homebrew/opt/node@22/bin/node
export ACTANT_BOOTSTRAP_COREPACK=/opt/homebrew/opt/node@22/bin/corepack
EOF
  fi

  if [[ -d "$PROJECT_ROOT/node_modules" && ! -e "$WORKTREE_PATH/node_modules" ]]; then
    ln -s "$PROJECT_ROOT/node_modules" "$WORKTREE_PATH/node_modules"
  fi

  shopt -s nullglob
  local pkg_nodes
  for pkg_nodes in "$PROJECT_ROOT"/packages/*/node_modules; do
    local pkg
    pkg=$(basename "$(dirname "$pkg_nodes")")
    mkdir -p "$WORKTREE_PATH/packages/$pkg"
    if [[ ! -e "$WORKTREE_PATH/packages/$pkg/node_modules" ]]; then
      ln -s "$pkg_nodes" "$WORKTREE_PATH/packages/$pkg/node_modules"
    fi
  done
  shopt -u nullglob

  git -C "$WORKTREE_PATH" config --worktree status.showUntrackedFiles no || true
}

collect_verify_commands() {
  local cmd
  VERIFY_COMMANDS=()
  while IFS= read -r cmd; do
    [[ -n "$cmd" ]] || continue
    VERIFY_COMMANDS+=("$cmd")
  done < <(get_worktree_verify_commands "$PROJECT_ROOT")

  if [[ ${#VERIFY_COMMANDS[@]} -gt 0 ]]; then
    VERIFY_MODE="shell"
  else
    VERIFY_MODE="codex-check"
  fi
}

write_implement_prompt() {
  local prompt_file="$1"
  local round="$2"
  cat > "$prompt_file" <<EOF
You are the implement worker for a Codex Ralph Loop.

Work only in this git worktree:
- $WORKTREE_PATH

Task:
- Name: $TASK_NAME
- Type: $DEV_TYPE
- Requirement: $REQUIREMENT
- Round: $round / $MAX_ROUNDS

Mandatory files to read first:
- .trellis/workflow.md
- .trellis/spec/backend/index.md (if backend/fullstack/test/docs touch backend code)
- .trellis/spec/guides/cross-layer-thinking-guide.md
- $TASK_DIR_REL/prd.md
- $TASK_DIR_REL/implement.jsonl
- $TASK_DIR_REL/check.jsonl

Constraints:
- Do not touch the main worktree at $PROJECT_ROOT
- Do not stop at analysis only
- Make concrete progress this round
- Before Node-based commands, run: source .worktree-env.sh 2>/dev/null || true
- Do not spend the whole round gathering context. After the required reads, move to either:
  1. a concrete code edit, or
  2. a concrete validation command whose failure directly informs the next edit
- If you find yourself only reading docs or code for too long, stop and act.
- This round is only successful if the git diff changes or you produce a concrete failing validation result and then react to it.

Previous verifier feedback:
EOF
  if [[ -f "$LAST_FEEDBACK_FILE" ]]; then
    cat "$LAST_FEEDBACK_FILE" >> "$prompt_file"
  else
    echo "- (none yet)" >> "$prompt_file"
  fi

  cat >> "$prompt_file" <<'EOF'

Expected output:
- What you changed this round
- What commands you ran
- What still blocks final verification, if anything
EOF
}

write_check_prompt() {
  local prompt_file="$1"
  local round="$2"
  cat > "$prompt_file" <<EOF
You are the check worker for a Codex Ralph Loop.

Work only in this git worktree:
- $WORKTREE_PATH

Task:
- Name: $TASK_NAME
- Requirement: $REQUIREMENT
- Round: $round / $MAX_ROUNDS

Your job:
1. Inspect the current git diff.
2. Read the relevant Trellis spec files.
3. Run the most relevant verification you can from this worktree.
4. Make only small self-fixes if the fix is obvious and tightly scoped.
5. End with exactly one marker:
   - CODEX_LOOP_CHECK_PASS
   - CODEX_LOOP_CHECK_FAIL

Environment note:
- Before Node-based commands, run: source .worktree-env.sh 2>/dev/null || true

Configured shell verify commands:
EOF

  if [[ ${#VERIFY_COMMANDS[@]} -gt 0 ]]; then
    local cmd
    for cmd in "${VERIFY_COMMANDS[@]}"; do
      echo "- $cmd" >> "$prompt_file"
    done
  else
    echo "- (none configured in .trellis/worktree.yaml; you must choose the most relevant checks)" >> "$prompt_file"
  fi

  cat >> "$prompt_file" <<'EOF'

Required report structure:
## Check Result
### Diff Summary
### Verification
### Self-fixes
### Remaining Problems
### Marker
EOF
}

run_codex_exec() {
  local prompt_file="$1"
  local log_file="$2"
  local last_message_file="$3"
  local -a cmd
  cmd=(
    "$CODEX_BIN"
    -a "$APPROVAL"
    exec
    -C "$WORKTREE_PATH"
    -m "$MODEL"
    -s "$SANDBOX"
  )

  if [[ $ENABLE_SEARCH -eq 1 ]]; then
    cmd+=(--search)
  fi

  cmd+=(
    -o "$last_message_file"
    -
  )

  "${cmd[@]}" < "$prompt_file" > "$log_file" 2>&1
}

run_shell_verify() {
  local round_dir="$1"
  local verify_log="$round_dir/verify.log"
  : > "$verify_log"

  local cmd
  local failed=0
  for cmd in "${VERIFY_COMMANDS[@]}"; do
    {
      echo ">>> $cmd"
      (
        cd "$WORKTREE_PATH"
        bash -lc "source .worktree-env.sh 2>/dev/null || true; $cmd"
      )
      echo
    } >> "$verify_log" 2>&1 || failed=1
  done

  if [[ $failed -eq 0 ]]; then
    return 0
  fi

  {
    echo "Shell verify failed."
    echo
    tail -n 120 "$verify_log"
  } > "$LAST_FEEDBACK_FILE"
  return 1
}

record_round_feedback() {
  local check_last_message="$1"
  {
    echo "Latest verifier result:"
    echo
    cat "$check_last_message"
  } > "$LAST_FEEDBACK_FILE"
}

mark_success() {
  jq '.status = "review" | .current_phase = 3' "$TASK_JSON" > "${TASK_JSON}.tmp"
  mv "${TASK_JSON}.tmp" "$TASK_JSON"
  update_status "passed" "$1" "Verification passed"
}

mark_failure() {
  update_status "$1" "$2" "$3"
}

print_plan_and_exit() {
  collect_verify_commands
  echo "Task dir:      $TASK_DIR_REL"
  echo "Branch:        $BRANCH"
  echo "Base branch:   $BASE_BRANCH"
  echo "Worktree:      $WORKTREE_PATH"
  echo "Model:         $MODEL"
  echo "Rounds:        $MAX_ROUNDS"
  echo "Verify mode:   $VERIFY_MODE"
  if [[ ${#VERIFY_COMMANDS[@]} -gt 0 ]]; then
    printf 'Verify cmds:   %s\n' "${VERIFY_COMMANDS[*]}"
  fi
  exit 0
}

main() {
  parse_args "$@"
  validate_args
  ensure_developer "$PROJECT_ROOT"
  require_command jq
  [[ -n "$CODEX_BIN" ]] || { log_error "codex CLI not found"; exit 1; }

  prepare_task_dir
  if [[ $DRY_RUN -eq 1 ]]; then
    local worktree_base
    worktree_base=$(get_worktree_base_dir "$PROJECT_ROOT")
    worktree_base="$(cd "$(dirname "$worktree_base")" && pwd)/$(basename "$worktree_base")"
    WORKTREE_PATH="$worktree_base/$BRANCH"
    collect_verify_commands
    print_plan_and_exit
  fi

  create_or_reuse_worktree
  prepare_worktree_runtime
  collect_verify_commands

  log_info "Task: $TASK_DIR_REL"
  log_info "Worktree: $WORKTREE_PATH"
  log_info "Branch: $BRANCH"
  log_info "Model: $MODEL"
  log_info "Verify mode: $VERIFY_MODE"

  update_status "running" 0 "Loop initialized"

  local round
  for (( round=1; round<=MAX_ROUNDS; round++ )); do
    local round_dir="$LOOP_LOG_DIR/round-$round"
    local before_signature after_signature
    local implement_prompt="$round_dir/implement-prompt.md"
    local implement_log="$round_dir/implement.log"
    local implement_last="$round_dir/implement-last.md"
    local check_prompt="$round_dir/check-prompt.md"
    local check_log="$round_dir/check.log"
    local check_last="$round_dir/check-last.md"

    mkdir -p "$round_dir"
    before_signature="$(compute_progress_signature)"
    update_status "running" "$round" "Implement round $round started"
    log_info "Round $round/$MAX_ROUNDS: implement started"

    write_implement_prompt "$implement_prompt" "$round"
    if ! run_codex_exec "$implement_prompt" "$implement_log" "$implement_last"; then
      mark_failure "failed" "$round" "Implement exec failed; see $implement_log"
      record_round_session "$round" "实现阶段失败" "未执行" "未执行" "Implement 执行失败，详见 $(basename "$implement_log")" "$round_dir" || true
      log_error "Implement round $round failed. See $implement_log"
      exit 1
    fi
    log_info "Round $round/$MAX_ROUNDS: implement finished"

    update_status "running" "$round" "Check round $round started"
    log_info "Round $round/$MAX_ROUNDS: check started"
    write_check_prompt "$check_prompt" "$round"
    if ! run_codex_exec "$check_prompt" "$check_log" "$check_last"; then
      mark_failure "failed" "$round" "Check exec failed; see $check_log"
      record_round_session "$round" "检查阶段失败" "未生成结果" "未执行" "Check 执行失败，详见 $(basename "$check_log")" "$round_dir" || true
      log_error "Check round $round failed. See $check_log"
      exit 1
    fi
    log_info "Round $round/$MAX_ROUNDS: check finished"

    record_round_feedback "$check_last"

    local check_pass=0
    if grep -q 'CODEX_LOOP_CHECK_PASS' "$check_last"; then
      check_pass=1
      log_info "Round $round/$MAX_ROUNDS: check marker PASS"
    else
      log_warn "Round $round/$MAX_ROUNDS: check marker FAIL"
    fi

    local shell_verify_pass=1
    if [[ "$VERIFY_MODE" == "shell" ]]; then
      update_status "running" "$round" "Shell verify round $round started"
      log_info "Round $round/$MAX_ROUNDS: shell verify started"
      if ! run_shell_verify "$round_dir"; then
        shell_verify_pass=0
        log_warn "Round $round/$MAX_ROUNDS: shell verify failed"
      else
        log_info "Round $round/$MAX_ROUNDS: shell verify passed"
      fi
    fi

    after_signature="$(compute_progress_signature)"
    if [[ "$before_signature" == "$after_signature" ]]; then
      NO_PROGRESS_ROUNDS=$((NO_PROGRESS_ROUNDS + 1))
    else
      NO_PROGRESS_ROUNDS=0
    fi

    local check_result="FAIL"
    if [[ $check_pass -eq 1 ]]; then
      check_result="PASS"
    fi

    local verify_result="未配置，已跳过"
    if [[ "$VERIFY_MODE" == "shell" ]]; then
      if [[ $shell_verify_pass -eq 1 ]]; then
        verify_result="通过"
      else
        verify_result="失败"
      fi
    fi

    if [[ $check_pass -eq 1 && $shell_verify_pass -eq 1 ]]; then
      mark_success "$round"
      record_round_session "$round" "已通过" "$check_result" "$verify_result" "本轮已通过全部检查门禁。" "$round_dir" || true
      log_success "Codex loop passed in round $round"
      echo "Status: $STATUS_FILE"
      echo "Worktree: $WORKTREE_PATH"
      exit 0
    fi

    if [[ $NO_PROGRESS_ROUNDS -ge 2 ]]; then
      mark_failure "stalled" "$round" "No diff progress across consecutive rounds"
      record_round_session "$round" "已停滞" "$check_result" "$verify_result" "连续两轮没有新的实质进展，loop 已停止。" "$round_dir" || true
      log_warn "Loop stalled after round $round. See $LAST_FEEDBACK_FILE"
      exit 1
    fi

    if [[ $round -eq $MAX_ROUNDS ]]; then
      mark_failure "failed" "$MAX_ROUNDS" "Reached max rounds without passing verification"
      record_round_session "$round" "未通过并结束" "$check_result" "$verify_result" "已达到最大轮数，仍未通过验证。" "$round_dir" || true
      log_error "Codex loop exhausted $MAX_ROUNDS rounds without passing."
      log_error "Last feedback: $LAST_FEEDBACK_FILE"
      exit 1
    fi

    update_status "running" "$round" "Round $round failed verification; retrying"
    record_round_session "$round" "未通过，准备重试" "$check_result" "$verify_result" "本轮未通过，下一轮将基于最新反馈继续修复。" "$round_dir" || true
    log_info "Round $round/$MAX_ROUNDS: retrying with latest feedback"
  done
}

main "$@"
