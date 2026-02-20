#!/bin/bash
# Issue Management Script (GitHub-style)
#
# Lightweight local issue tracker modeled after GitHub Issues.
# Issues are for discussions, ideas, bug reports, design proposals,
# side-branch thinking — anything outside the main task pipeline.
#
# Design principles (following GitHub):
#   - Status is binary: open / closed (not a workflow pipeline)
#   - All categorization via labels (no rigid type/priority enums)
#   - Body is rich markdown (not a one-line description)
#   - Comments form a discussion thread
#   - Close reasons: completed / not-planned / duplicate
#
# Usage:
#   issue.sh create "<title>" [options]
#   issue.sh list [filters]
#   issue.sh show <id>
#   issue.sh edit <id> [fields]
#   issue.sh close <id> [--as completed|not-planned|duplicate] [--ref <id>]
#   issue.sh reopen <id>
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
source "$SCRIPT_DIR/common/paths.sh"
source "$SCRIPT_DIR/common/developer.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

REPO_ROOT=$(get_repo_root)
ISSUES_DIR="$REPO_ROOT/$DIR_WORKFLOW/issues"
COUNTER_FILE="$ISSUES_DIR/.counter"

# =============================================================================
# Well-known Labels (convention, not enforced)
#
# Type:     bug, feature, enhancement, question, discussion, rfc, chore, docs
# Priority: priority:P0, priority:P1, priority:P2, priority:P3
# Area:     core, cli, api, mcp, shared, acp
# Meta:     duplicate, wontfix, blocked, good-first-issue
# =============================================================================

# =============================================================================
# Helpers
# =============================================================================

ensure_issues_dir() {
  [[ ! -d "$ISSUES_DIR" ]] && mkdir -p "$ISSUES_DIR"
  [[ ! -f "$COUNTER_FILE" ]] && echo "0" > "$COUNTER_FILE"
}

next_id() {
  ensure_issues_dir
  local counter_val max_file_id next
  counter_val=$(cat "$COUNTER_FILE")

  # Scan existing files for the actual maximum ID to prevent conflicts
  max_file_id=0
  for f in "$ISSUES_DIR"/[0-9][0-9][0-9][0-9]-*.json; do
    [[ ! -f "$f" ]] && continue
    local fid
    fid=$(basename "$f" | grep -o '^[0-9]\+' | sed 's/^0*//')
    [[ -z "$fid" ]] && fid=0
    (( fid > max_file_id )) && max_file_id=$fid
  done

  local base=$(( counter_val > max_file_id ? counter_val : max_file_id ))
  next=$((base + 1))

  # Check for file name collision before committing
  local padded
  padded=$(printf "%04d" "$next")
  while ls "$ISSUES_DIR"/${padded}-*.json >/dev/null 2>&1; do
    next=$((next + 1))
    padded=$(printf "%04d" "$next")
  done

  echo "$next" > "$COUNTER_FILE"
  echo "$next"
}

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//'
}

find_issue_file() {
  local id="$1"
  local padded
  padded=$(printf "%04d" "$id")
  find "$ISSUES_DIR" -maxdepth 1 -name "${padded}-*.json" -type f 2>/dev/null | head -1
}

get_author() {
  local author
  author=$(get_developer "$REPO_ROOT")
  echo "${author:-unknown}"
}

# Label display: color-code well-known labels
format_label() {
  local l="$1"
  case "$l" in
    bug)              printf "${RED}bug${NC}" ;;
    feature)          printf "${GREEN}feature${NC}" ;;
    enhancement)      printf "${CYAN}enhancement${NC}" ;;
    question)         printf "${MAGENTA}question${NC}" ;;
    discussion)       printf "${BLUE}discussion${NC}" ;;
    rfc)              printf "${YELLOW}rfc${NC}" ;;
    priority:P0)      printf "${RED}P0${NC}" ;;
    priority:P1)      printf "${YELLOW}P1${NC}" ;;
    priority:P2)      printf "${CYAN}P2${NC}" ;;
    priority:P3)      printf "${GRAY}P3${NC}" ;;
    duplicate)        printf "${GRAY}duplicate${NC}" ;;
    wontfix)          printf "${GRAY}wontfix${NC}" ;;
    blocked)          printf "${RED}blocked${NC}" ;;
    *)                printf "${GRAY}${l}${NC}" ;;
  esac
}

format_labels() {
  local filepath="$1"
  local labels
  labels=$(jq -r '.labels[]' "$filepath" 2>/dev/null)
  local result=""
  while IFS= read -r l; do
    [[ -z "$l" ]] && continue
    [[ -n "$result" ]] && result+=", "
    result+=$(format_label "$l")
  done <<< "$labels"
  echo -e "$result"
}

# =============================================================================
# Command: create
# =============================================================================

cmd_create() {
  local title=""
  local labels=()
  local body=""
  local body_file=""
  local milestone=""
  local related_files=()
  local related_issues=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label|-l)      labels+=("$2");          shift 2 ;;
      --body|-b)       body="$2";               shift 2 ;;
      --body-file)     body_file="$2";           shift 2 ;;
      --milestone|-m)  milestone="$2";           shift 2 ;;
      --file|-f)       related_files+=("$2");    shift 2 ;;
      --related|-r)    related_issues+=("$2");   shift 2 ;;
      # Convenience aliases that map to labels
      --bug)           labels+=("bug");          shift ;;
      --feature)       labels+=("feature");      shift ;;
      --enhancement)   labels+=("enhancement");  shift ;;
      --question)      labels+=("question");     shift ;;
      --discussion)    labels+=("discussion");   shift ;;
      --rfc)           labels+=("rfc");          shift ;;
      --chore)         labels+=("chore");        shift ;;
      --priority|-p)   labels+=("priority:$2");  shift 2 ;;
      -*)
        echo -e "${RED}Error: Unknown option $1${NC}" >&2
        exit 1 ;;
      *)
        [[ -z "$title" ]] && title="$1"
        shift ;;
    esac
  done

  if [[ -z "$title" ]]; then
    echo -e "${RED}Error: title is required${NC}" >&2
    echo "" >&2
    echo "Usage: issue.sh create \"<title>\" [options]" >&2
    echo "" >&2
    echo "Type shortcuts:  --bug  --feature  --enhancement  --question  --discussion  --rfc  --chore" >&2
    echo "Priority:        --priority P0|P1|P2|P3" >&2
    echo "Labels:          --label <name> (repeatable)" >&2
    echo "Body:            --body \"<markdown>\" | --body-file <path>" >&2
    echo "Milestone:       --milestone near-term|mid-term|long-term" >&2
    echo "Relations:       --file <path>  --related <issue-id> (repeatable)" >&2
    exit 1
  fi

  # Read body from file if specified
  if [[ -n "$body_file" ]]; then
    if [[ ! -f "$body_file" ]]; then
      echo -e "${RED}Error: body file not found: $body_file${NC}" >&2
      exit 1
    fi
    body=$(cat "$body_file")
  fi

  ensure_issues_dir

  local id
  id=$(next_id)
  local padded
  padded=$(printf "%04d" "$id")
  local slug
  slug=$(slugify "$title")
  # Truncate slug to avoid absurdly long filenames
  slug=$(echo "$slug" | cut -c1-60)
  local filename="${padded}-${slug}.json"
  local filepath="$ISSUES_DIR/$filename"
  local today
  today=$(date +%Y-%m-%dT%H:%M:%S)
  local author
  author=$(get_author)

  # Build JSON arrays (handle empty arrays safely)
  local labels_json="[]"
  if [[ ${#labels[@]} -gt 0 ]]; then
    labels_json=$(printf '%s\n' "${labels[@]}" | jq -R . | jq -s 'unique')
  fi
  local files_json="[]"
  if [[ ${#related_files[@]} -gt 0 ]]; then
    files_json=$(printf '%s\n' "${related_files[@]}" | jq -R . | jq -s .)
  fi
  local issues_json="[]"
  if [[ ${#related_issues[@]} -gt 0 ]]; then
    issues_json=$(printf '%s\n' "${related_issues[@]}" | jq -R 'tonumber' | jq -s .)
  fi

  jq -n \
    --argjson id "$id" \
    --arg title "$title" \
    --arg body "$body" \
    --argjson labels "$labels_json" \
    --arg milestone "$milestone" \
    --arg author "$author" \
    --argjson relatedFiles "$files_json" \
    --argjson relatedIssues "$issues_json" \
    --arg createdAt "$today" \
    '{
      id: $id,
      title: $title,
      status: "open",
      labels: $labels,
      milestone: (if $milestone == "" then null else $milestone end),
      body: $body,
      author: $author,
      assignees: [],
      relatedFiles: $relatedFiles,
      relatedIssues: $relatedIssues,
      taskRef: null,
      githubRef: null,
      closedAs: null,
      comments: [],
      createdAt: $createdAt,
      updatedAt: $createdAt,
      closedAt: null
    }' > "$filepath"

  echo -e "${GREEN}Created #${id}: ${title}${NC}" >&2
  if [[ ${#labels[@]} -gt 0 ]]; then
    echo -e "  Labels: $(format_labels "$filepath")" >&2
  fi
  echo "$id"
}

# =============================================================================
# Command: list
# =============================================================================

cmd_list() {
  local filter_label=""
  local filter_milestone=""
  local filter_assignee=""
  local show_closed=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --label|-l)     filter_label="$2";     shift 2 ;;
      --milestone|-m) filter_milestone="$2"; shift 2 ;;
      --assignee|-a)  filter_assignee="$2";  shift 2 ;;
      --closed)       show_closed=true;      shift ;;
      --all)          show_closed=true;      shift ;;
      # Convenience: --priority P1 filters by label priority:P1
      --priority|-p)  filter_label="priority:$2"; shift 2 ;;
      --bug)          filter_label="bug";          shift ;;
      --feature)      filter_label="feature";      shift ;;
      --question)     filter_label="question";     shift ;;
      --discussion)   filter_label="discussion";   shift ;;
      --rfc)          filter_label="rfc";          shift ;;
      *)              shift ;;
    esac
  done

  ensure_issues_dir

  local count=0
  local tmpfile
  tmpfile=$(mktemp)

  for f in "$ISSUES_DIR"/*.json; do
    [[ ! -f "$f" ]] && continue

    local status
    status=$(jq -r '.status' "$f")

    # Default: hide closed
    if [[ "$show_closed" == "false" ]] && [[ "$status" == "closed" ]]; then
      continue
    fi

    # Label filter
    if [[ -n "$filter_label" ]]; then
      local has_label
      has_label=$(jq --arg l "$filter_label" 'any(.labels[]; . == $l)' "$f")
      [[ "$has_label" != "true" ]] && continue
    fi

    # Milestone filter
    if [[ -n "$filter_milestone" ]]; then
      local ms
      ms=$(jq -r '.milestone // ""' "$f")
      [[ "$ms" != "$filter_milestone" ]] && continue
    fi

    # Assignee filter
    if [[ -n "$filter_assignee" ]]; then
      local has_assignee
      has_assignee=$(jq --arg a "$filter_assignee" 'any(.assignees[]; . == $a)' "$f")
      [[ "$has_assignee" != "true" ]] && continue
    fi

    local id title milestone
    id=$(jq -r '.id' "$f")
    title=$(jq -r '.title' "$f")
    milestone=$(jq -r '.milestone // ""' "$f")

    # Sort key: priority label weight (P0=0..P3=3, no priority=5) then id
    local pweight=5
    for pw in 0 1 2 3; do
      local has_p
      has_p=$(jq --arg l "priority:P${pw}" 'any(.labels[]; . == $l)' "$f")
      if [[ "$has_p" == "true" ]]; then
        pweight=$pw
        break
      fi
    done

    echo "${pweight}$(printf '%04d' "$id")|$id|$status|$milestone|$f|$title" >> "$tmpfile"
  done

  if [[ ! -s "$tmpfile" ]]; then
    echo "  (no matching issues)"
    rm -f "$tmpfile"
    return
  fi

  local sorted
  sorted=$(mktemp)
  sort "$tmpfile" > "$sorted"

  while IFS='|' read -r _sort id status milestone filepath title; do
    local status_icon
    if [[ "$status" == "open" ]]; then
      status_icon="${GREEN}○${NC}"
    else
      local closed_as
      closed_as=$(jq -r '.closedAs // "completed"' "$filepath")
      case "$closed_as" in
        completed)   status_icon="${MAGENTA}●${NC}" ;;
        not-planned) status_icon="${GRAY}⊘${NC}" ;;
        duplicate)   status_icon="${GRAY}≡${NC}" ;;
        *)           status_icon="${GRAY}●${NC}" ;;
      esac
    fi

    local labels_str
    labels_str=$(format_labels "$filepath")
    local ms_str=""
    [[ -n "$milestone" ]] && ms_str=" ${GRAY}[${milestone}]${NC}"
    local comments_count
    comments_count=$(jq '.comments | length' "$filepath")
    local comment_str=""
    [[ "$comments_count" -gt 0 ]] && comment_str=" ${GRAY}(${comments_count})${NC}"

    printf "  %b ${BOLD}#%-4s${NC} %s%b%b\n" "$status_icon" "$id" "$title" "$ms_str" "$comment_str"
    if [[ -n "$labels_str" ]]; then
      printf "         %b\n" "$labels_str"
    fi
    ((count++))
  done < "$sorted"

  echo ""
  echo "  $count issue(s)"

  rm -f "$tmpfile" "$sorted"
}

# =============================================================================
# Command: show
# =============================================================================

cmd_show() {
  local id="$1"

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local title status body author milestone created updated closed
  local closed_as comments_count task_ref github_ref
  title=$(jq -r '.title' "$filepath")
  status=$(jq -r '.status' "$filepath")
  body=$(jq -r '.body // ""' "$filepath")
  author=$(jq -r '.author // "-"' "$filepath")
  milestone=$(jq -r '.milestone // "-"' "$filepath")
  created=$(jq -r '.createdAt' "$filepath")
  updated=$(jq -r '.updatedAt' "$filepath")
  closed=$(jq -r '.closedAt // "-"' "$filepath")
  closed_as=$(jq -r '.closedAs // "-"' "$filepath")
  comments_count=$(jq '.comments | length' "$filepath")
  task_ref=$(jq -r '.taskRef // "-"' "$filepath")
  github_ref=$(jq -r '.githubRef // empty | .url // empty' "$filepath" 2>/dev/null)

  local status_display
  if [[ "$status" == "open" ]]; then
    status_display="${GREEN}Open${NC}"
  else
    status_display="${MAGENTA}Closed${NC} (${closed_as})"
  fi

  echo ""
  echo -e "  ${BOLD}#${id}: ${title}${NC}"
  echo -e "  ─────────────────────────────────────────"
  echo -e "  Status:     $status_display"
  echo -e "  Labels:     $(format_labels "$filepath")"
  echo -e "  Milestone:  ${milestone}"
  echo -e "  Author:     ${author}"

  local assignees_str
  assignees_str=$(jq -r '.assignees | join(", ")' "$filepath")
  echo -e "  Assignees:  ${assignees_str:--}"

  if [[ "$task_ref" != "-" ]]; then
    echo -e "  Task:       ${task_ref}"
  fi
  if [[ -n "$github_ref" ]]; then
    echo -e "  GitHub:     ${CYAN}${github_ref}${NC}"
  fi
  echo -e "  Created:    ${created}"
  [[ "$updated" != "$created" ]] && echo -e "  Updated:    ${updated}"
  [[ "$closed" != "-" ]] && echo -e "  Closed:     ${closed}"
  echo ""

  # Related files
  local files_count
  files_count=$(jq '.relatedFiles | length' "$filepath")
  if [[ "$files_count" -gt 0 ]]; then
    echo -e "  ${CYAN}Related Files:${NC}"
    jq -r '.relatedFiles[] | "    - " + .' "$filepath"
    echo ""
  fi

  # Related issues
  local issues_count
  issues_count=$(jq '.relatedIssues | length' "$filepath")
  if [[ "$issues_count" -gt 0 ]]; then
    echo -e "  ${CYAN}Related:${NC} $(jq -r '.relatedIssues | map("#" + tostring) | join(", ")' "$filepath")"
    echo ""
  fi

  # Body
  if [[ -n "$body" ]]; then
    echo -e "  ${CYAN}───────── Body ─────────${NC}"
    echo "$body" | sed 's/^/  /'
    echo ""
  fi

  # Comments
  if [[ "$comments_count" -gt 0 ]]; then
    echo -e "  ${CYAN}───────── Comments (${comments_count}) ─────────${NC}"
    jq -r '.comments[] | "  \(.author) on \(.date):\n  \(.text)\n"' "$filepath"
  fi
}

# =============================================================================
# Command: edit
# =============================================================================

cmd_edit() {
  local id="$1"
  shift || true

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)
  local changed=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title)
        jq --arg v "$2" --arg d "$now" '.title = $v | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  Title → ${2}"
        changed=true; shift 2 ;;
      --body|-b)
        jq --arg v "$2" --arg d "$now" '.body = $v | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  Body updated"
        changed=true; shift 2 ;;
      --body-file)
        local content
        content=$(cat "$2")
        jq --arg v "$content" --arg d "$now" '.body = $v | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  Body updated from $2"
        changed=true; shift 2 ;;
      --milestone|-m)
        local ms_val="$2"
        if [[ "$ms_val" == "none" ]] || [[ "$ms_val" == "" ]]; then
          jq --arg d "$now" '.milestone = null | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
        else
          jq --arg v "$ms_val" --arg d "$now" '.milestone = $v | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
        fi
        mv "${filepath}.tmp" "$filepath"
        echo -e "  Milestone → ${ms_val}"
        changed=true; shift 2 ;;
      --assign|-a)
        jq --arg v "$2" --arg d "$now" \
          'if (.assignees | index($v)) then . else .assignees += [$v] | .updatedAt = $d end' \
          "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  Assignee + ${2}"
        changed=true; shift 2 ;;
      --unassign)
        jq --arg v "$2" --arg d "$now" '.assignees -= [$v] | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  Assignee - ${2}"
        changed=true; shift 2 ;;
      --add-file)
        jq --arg v "$2" --arg d "$now" \
          'if (.relatedFiles | index($v)) then . else .relatedFiles += [$v] | .updatedAt = $d end' \
          "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  File + ${2}"
        changed=true; shift 2 ;;
      --add-related)
        jq --argjson v "$2" --arg d "$now" \
          'if (.relatedIssues | index($v)) then . else .relatedIssues += [$v] | .updatedAt = $d end' \
          "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  Related + #${2}"
        changed=true; shift 2 ;;
      *)
        echo -e "${RED}Error: Unknown option $1${NC}" >&2; exit 1 ;;
    esac
  done

  if [[ "$changed" == "true" ]]; then
    local title
    title=$(jq -r '.title' "$filepath")
    echo -e "${GREEN}Updated #${id}: ${title}${NC}"
  else
    echo "Usage: issue.sh edit <id> [--title <t>] [--body <md>] [--body-file <path>]" >&2
    echo "       [--milestone <m>] [--assign <user>] [--unassign <user>]" >&2
    echo "       [--add-file <path>] [--add-related <id>]" >&2
  fi
}

# =============================================================================
# Command: label
# =============================================================================

cmd_label() {
  local id="$1"
  shift || true

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)
  local changed=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --add|-a)
        jq --arg v "$2" --arg d "$now" \
          'if (.labels | index($v)) then . else .labels += [$v] | .updatedAt = $d end' \
          "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  + $(format_label "$2")"
        changed=true; shift 2 ;;
      --remove|-r)
        jq --arg v "$2" --arg d "$now" '.labels -= [$v] | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
        mv "${filepath}.tmp" "$filepath"
        echo -e "  - ${2}"
        changed=true; shift 2 ;;
      *)
        echo -e "${RED}Error: Unknown option $1. Use --add or --remove${NC}" >&2; exit 1 ;;
    esac
  done

  if [[ "$changed" == "true" ]]; then
    echo -e "  Labels: $(format_labels "$filepath")"
  fi
}

# =============================================================================
# Command: close
# =============================================================================

cmd_close() {
  local id="$1"
  shift || true

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local closed_as="completed"
  local ref_id=""
  local reason=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --as)     closed_as="$2"; shift 2 ;;
      --ref)    ref_id="$2";    shift 2 ;;
      --reason) reason="$2";    shift 2 ;;
      *)        shift ;;
    esac
  done

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)
  local author
  author=$(get_author)

  # Add closing comment
  local comment_text="Closed as ${closed_as}"
  [[ -n "$reason" ]] && comment_text+=": ${reason}"
  [[ -n "$ref_id" ]] && comment_text+=" (ref #${ref_id})"

  jq --arg ca "$closed_as" --arg d "$now" \
    --arg text "$comment_text" --arg author "$author" \
    '.status = "closed" | .closedAs = $ca | .closedAt = $d | .updatedAt = $d
     | .comments += [{ text: $text, date: $d, author: $author }]' \
    "$filepath" > "${filepath}.tmp"
  mv "${filepath}.tmp" "$filepath"

  # If duplicate, add cross-reference
  if [[ "$closed_as" == "duplicate" ]] && [[ -n "$ref_id" ]]; then
    jq --argjson v "$ref_id" \
      'if (.relatedIssues | index($v)) then . else .relatedIssues += [$v] end' \
      "$filepath" > "${filepath}.tmp"
    mv "${filepath}.tmp" "$filepath"
  fi

  local title
  title=$(jq -r '.title' "$filepath")
  local status_icon
  case "$closed_as" in
    completed)   status_icon="${MAGENTA}●${NC}" ;;
    not-planned) status_icon="${GRAY}⊘${NC}" ;;
    duplicate)   status_icon="${GRAY}≡${NC}" ;;
  esac
  echo -e "${status_icon} Closed #${id}: ${title} ${GRAY}(${closed_as})${NC}"
}

# =============================================================================
# Command: reopen
# =============================================================================

cmd_reopen() {
  local id="$1"

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)
  local author
  author=$(get_author)

  jq --arg d "$now" --arg author "$author" \
    '.status = "open" | .closedAt = null | .closedAs = null | .updatedAt = $d
     | .comments += [{ text: "Reopened", date: $d, author: $author }]' \
    "$filepath" > "${filepath}.tmp"
  mv "${filepath}.tmp" "$filepath"

  local title
  title=$(jq -r '.title' "$filepath")
  echo -e "${GREEN}○ Reopened #${id}: ${title}${NC}"
}

# =============================================================================
# Command: comment
# =============================================================================

cmd_comment() {
  local id="$1"
  local text="$2"

  if [[ -z "$id" ]] || [[ -z "$text" ]]; then
    echo -e "${RED}Error: issue ID and comment text required${NC}" >&2
    echo "Usage: issue.sh comment <id> \"<text>\"" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)
  local author
  author=$(get_author)

  jq --arg text "$text" --arg date "$now" --arg author "$author" --arg d "$now" \
    '.comments += [{ text: $text, date: $date, author: $author }] | .updatedAt = $d' \
    "$filepath" > "${filepath}.tmp"
  mv "${filepath}.tmp" "$filepath"

  local count
  count=$(jq '.comments | length' "$filepath")
  echo -e "${GREEN}Comment added to #${id} (${count} total)${NC}"
}

# =============================================================================
# Command: promote (Issue → Task)
# =============================================================================

cmd_promote() {
  local id="$1"
  shift || true

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local slug_override=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --slug|-s) slug_override="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  local title slug existing_ref
  title=$(jq -r '.title' "$filepath")
  slug=$(slugify "$title" | cut -c1-40)
  existing_ref=$(jq -r '.taskRef // ""' "$filepath")

  [[ -n "$slug_override" ]] && slug="$slug_override"

  if [[ -n "$existing_ref" ]]; then
    echo -e "${YELLOW}#${id} already promoted → ${existing_ref}${NC}" >&2
    exit 1
  fi

  # Extract priority label for task
  local priority="P2"
  for p in P0 P1 P2 P3; do
    local has
    has=$(jq --arg l "priority:${p}" 'any(.labels[]; . == $l)' "$filepath")
    if [[ "$has" == "true" ]]; then
      priority="$p"
      break
    fi
  done

  echo -e "${BLUE}Promoting #${id} → Task...${NC}" >&2
  local task_path
  task_path=$("$SCRIPT_DIR/task.sh" create "$title" --slug "$slug" --priority "$priority")

  if [[ -z "$task_path" ]]; then
    echo -e "${RED}Error: failed to create task${NC}" >&2
    exit 1
  fi

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)
  local author
  author=$(get_author)

  jq --arg ref "$task_path" --arg d "$now" --arg author "$author" \
    '.taskRef = $ref | .updatedAt = $d
     | .comments += [{ text: ("Promoted to task: " + $ref), date: $d, author: $author }]' \
    "$filepath" > "${filepath}.tmp"
  mv "${filepath}.tmp" "$filepath"

  echo -e "${GREEN}#${id} → ${task_path}${NC}" >&2
  echo "$task_path"
}

# =============================================================================
# Command: search
# =============================================================================

cmd_search() {
  local query="$1"

  if [[ -z "$query" ]]; then
    echo -e "${RED}Error: search query required${NC}" >&2
    exit 1
  fi

  ensure_issues_dir

  local count=0
  local query_lower
  query_lower=$(echo "$query" | tr '[:upper:]' '[:lower:]')

  for f in "$ISSUES_DIR"/*.json; do
    [[ ! -f "$f" ]] && continue

    local content
    content=$(jq -r '[.title, .body, (.labels | join(" ")), (.comments[].text // empty)] | join(" ")' "$f" 2>/dev/null)
    local content_lower
    content_lower=$(echo "$content" | tr '[:upper:]' '[:lower:]')

    if echo "$content_lower" | grep -q "$query_lower"; then
      local id status title
      id=$(jq -r '.id' "$f")
      status=$(jq -r '.status' "$f")
      title=$(jq -r '.title' "$f")

      local status_icon
      [[ "$status" == "open" ]] && status_icon="${GREEN}○${NC}" || status_icon="${GRAY}●${NC}"

      printf "  %b ${BOLD}#%-4s${NC} %s\n" "$status_icon" "$id" "$title"
      printf "         %b\n" "$(format_labels "$f")"
      ((count++))
    fi
  done

  echo ""
  echo "  $count result(s) for \"$query\""
}

# =============================================================================
# Command: export (output GitHub-compatible JSON for MCP tools)
# =============================================================================

cmd_export() {
  local id="$1"
  shift || true

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local owner="" repo="" mode="create"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --owner|-o)  owner="$2";  shift 2 ;;
      --repo|-r)   repo="$2";   shift 2 ;;
      --update)    mode="update"; shift ;;
      *) shift ;;
    esac
  done

  if [[ "$mode" == "create" ]]; then
    # For mcp__github__create_issue
    local base_json
    base_json=$(jq '{
      title: .title,
      body: (
        .body
        + (if (.relatedFiles | length) > 0 then
            "\n\n---\n**Related Files**: " + (.relatedFiles | join(", "))
          else "" end)
        + (if .milestone then "\n**Milestone**: " + .milestone else "" end)
        + "\n\n> Synced from local issue #" + (.id | tostring)
      ),
      labels: .labels,
      assignees: .assignees
    }' "$filepath")

    if [[ -n "$owner" ]] && [[ -n "$repo" ]]; then
      echo "$base_json" | jq --arg o "$owner" --arg r "$repo" '. + {owner: $o, repo: $r}'
    else
      echo "$base_json"
    fi

  elif [[ "$mode" == "update" ]]; then
    # For mcp__github__update_issue — requires existing githubRef
    local gh_number
    gh_number=$(jq -r '.githubRef.number // empty' "$filepath" 2>/dev/null)
    local gh_owner gh_repo
    gh_owner=$(jq -r '.githubRef.owner // empty' "$filepath" 2>/dev/null)
    gh_repo=$(jq -r '.githubRef.repo // empty' "$filepath" 2>/dev/null)

    [[ -n "$owner" ]] && gh_owner="$owner"
    [[ -n "$repo" ]] && gh_repo="$repo"

    if [[ -z "$gh_number" ]]; then
      echo -e "${RED}Error: issue #${id} has no GitHub link. Use 'link' first or export without --update.${NC}" >&2
      exit 1
    fi

    local state
    state=$(jq -r 'if .status == "open" then "open" else "closed" end' "$filepath")

    jq --arg state "$state" --arg o "$gh_owner" --arg r "$gh_repo" '{
      owner: $o,
      repo: $r,
      issue_number: .githubRef.number,
      title: .title,
      body: (
        .body
        + (if (.relatedFiles | length) > 0 then
            "\n\n---\n**Related Files**: " + (.relatedFiles | join(", "))
          else "" end)
        + (if .milestone then "\n**Milestone**: " + .milestone else "" end)
        + "\n\n> Synced from local issue #" + (.id | tostring)
      ),
      state: $state,
      labels: .labels,
      assignees: .assignees
    }' "$filepath"
  fi
}

# =============================================================================
# Command: import-github (create local issue from GitHub issue data via stdin)
# =============================================================================

cmd_import_github() {
  local owner="" repo="" gh_number=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --owner|-o)   owner="$2";     shift 2 ;;
      --repo|-r)    repo="$2";      shift 2 ;;
      --number|-n)  gh_number="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  # Read JSON from stdin
  local input
  input=$(cat)

  if [[ -z "$input" ]]; then
    echo -e "${RED}Error: no JSON input. Pipe GitHub issue data via stdin.${NC}" >&2
    echo "Usage: echo '<json>' | issue.sh import-github [--owner <o>] [--repo <r>]" >&2
    exit 1
  fi

  # Extract fields from GitHub issue JSON (MCP response format)
  local title body state gh_url
  title=$(echo "$input" | jq -r '.title // empty')
  body=$(echo "$input" | jq -r '.body // ""')
  state=$(echo "$input" | jq -r '.state // "open"')

  if [[ -z "$owner" ]]; then
    owner=$(echo "$input" | jq -r '.repository.owner.login // .owner // empty')
  fi
  if [[ -z "$repo" ]]; then
    repo=$(echo "$input" | jq -r '.repository.name // .repo // empty')
  fi
  if [[ -z "$gh_number" ]]; then
    gh_number=$(echo "$input" | jq -r '.number // empty')
  fi
  gh_url=$(echo "$input" | jq -r '.html_url // .url // empty')

  if [[ -z "$title" ]]; then
    echo -e "${RED}Error: could not extract title from input JSON${NC}" >&2
    exit 1
  fi

  # Check for duplicate by githubRef
  if [[ -n "$gh_number" ]] && [[ -n "$owner" ]] && [[ -n "$repo" ]]; then
    for f in "$ISSUES_DIR"/*.json; do
      [[ ! -f "$f" ]] && continue
      local existing_ref
      existing_ref=$(jq -r '.githubRef.number // empty' "$f" 2>/dev/null)
      local existing_owner
      existing_owner=$(jq -r '.githubRef.owner // empty' "$f" 2>/dev/null)
      local existing_repo
      existing_repo=$(jq -r '.githubRef.repo // empty' "$f" 2>/dev/null)
      if [[ "$existing_ref" == "$gh_number" ]] && [[ "$existing_owner" == "$owner" ]] && [[ "$existing_repo" == "$repo" ]]; then
        local eid
        eid=$(jq -r '.id' "$f")
        echo -e "${YELLOW}Already imported as local #${eid}${NC}" >&2
        echo "$eid"
        return
      fi
    done
  fi

  ensure_issues_dir

  local id
  id=$(next_id)
  local padded
  padded=$(printf "%04d" "$id")
  local slug
  slug=$(slugify "$title" | cut -c1-60)
  local filename="${padded}-${slug}.json"
  local filepath="$ISSUES_DIR/$filename"
  local today
  today=$(date +%Y-%m-%dT%H:%M:%S)
  local author
  author=$(get_author)

  # Map GitHub labels
  local labels_json
  labels_json=$(echo "$input" | jq '[.labels[]? | if type == "object" then .name else . end] // []')

  # Map GitHub assignees
  local assignees_json
  assignees_json=$(echo "$input" | jq '[.assignees[]? | if type == "object" then .login else . end] // []')

  # Build githubRef
  local github_ref="null"
  if [[ -n "$gh_number" ]] && [[ -n "$owner" ]] && [[ -n "$repo" ]]; then
    github_ref=$(jq -n --arg o "$owner" --arg r "$repo" --argjson n "$gh_number" --arg u "${gh_url:-}" \
      '{owner: $o, repo: $r, number: $n, url: (if $u == "" then "https://github.com/\($o)/\($r)/issues/\($n)" else $u end), syncedAt: now | todate}')
  fi

  local issue_status="open"
  [[ "$state" == "closed" ]] && issue_status="closed"

  jq -n \
    --argjson id "$id" \
    --arg title "$title" \
    --arg body "$body" \
    --arg status "$issue_status" \
    --argjson labels "$labels_json" \
    --argjson assignees "$assignees_json" \
    --arg author "$author" \
    --argjson githubRef "$github_ref" \
    --arg createdAt "$today" \
    '{
      id: $id,
      title: $title,
      status: $status,
      labels: $labels,
      milestone: null,
      body: $body,
      author: $author,
      assignees: $assignees,
      relatedFiles: [],
      relatedIssues: [],
      taskRef: null,
      githubRef: $githubRef,
      closedAs: (if $status == "closed" then "completed" else null end),
      comments: [],
      createdAt: $createdAt,
      updatedAt: $createdAt,
      closedAt: (if $status == "closed" then $createdAt else null end)
    }' > "$filepath"

  echo -e "${GREEN}Imported #${id}: ${title}${NC}" >&2
  if [[ -n "$gh_url" ]]; then
    echo -e "  GitHub: ${CYAN}${gh_url}${NC}" >&2
  fi
  echo "$id"
}

# =============================================================================
# Command: link / unlink (associate local issue ↔ GitHub issue)
# =============================================================================

cmd_link() {
  local id="$1"
  shift || true

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    echo "Usage: issue.sh link <id> --owner <o> --repo <r> --number <n> [--url <url>]" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local owner="" repo="" number="" url=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --owner|-o)   owner="$2";  shift 2 ;;
      --repo|-r)    repo="$2";   shift 2 ;;
      --number|-n)  number="$2"; shift 2 ;;
      --url|-u)     url="$2";    shift 2 ;;
      --github|-g)
        # Accept "owner/repo#number" shorthand
        local ref="$2"
        owner=$(echo "$ref" | sed 's|/.*||')
        repo=$(echo "$ref" | sed 's|.*/||; s|#.*||')
        number=$(echo "$ref" | sed 's|.*#||')
        shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$owner" ]] || [[ -z "$repo" ]] || [[ -z "$number" ]]; then
    echo -e "${RED}Error: --owner, --repo, --number required (or --github owner/repo#number)${NC}" >&2
    exit 1
  fi

  [[ -z "$url" ]] && url="https://github.com/${owner}/${repo}/issues/${number}"

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)

  jq --arg o "$owner" --arg r "$repo" --argjson n "$number" --arg u "$url" --arg d "$now" \
    '.githubRef = {owner: $o, repo: $r, number: $n, url: $u, syncedAt: $d} | .updatedAt = $d' \
    "$filepath" > "${filepath}.tmp"
  mv "${filepath}.tmp" "$filepath"

  echo -e "${GREEN}Linked #${id} → ${CYAN}${url}${NC}"
}

cmd_unlink() {
  local id="$1"

  if [[ -z "$id" ]]; then
    echo -e "${RED}Error: issue ID required${NC}" >&2
    exit 1
  fi

  local filepath
  filepath=$(find_issue_file "$id")
  if [[ -z "$filepath" ]] || [[ ! -f "$filepath" ]]; then
    echo -e "${RED}Error: issue #${id} not found${NC}" >&2
    exit 1
  fi

  local now
  now=$(date +%Y-%m-%dT%H:%M:%S)

  jq --arg d "$now" '.githubRef = null | .updatedAt = $d' "$filepath" > "${filepath}.tmp"
  mv "${filepath}.tmp" "$filepath"

  echo -e "${GREEN}Unlinked #${id} from GitHub${NC}"
}

# =============================================================================
# Command: stats
# =============================================================================

cmd_stats() {
  ensure_issues_dir

  local total=0 open=0 closed=0
  local completed=0 not_planned=0 dup=0

  # Collect label counts via jq (bash 3.2 compatible, no associative arrays)
  local all_labels_file
  all_labels_file=$(mktemp)

  for f in "$ISSUES_DIR"/*.json; do
    [[ ! -f "$f" ]] && continue
    total=$((total + 1))

    local status closed_as
    status=$(jq -r '.status' "$f")
    closed_as=$(jq -r '.closedAs // ""' "$f")

    if [[ "$status" == "open" ]]; then
      open=$((open + 1))
    else
      closed=$((closed + 1))
      case "$closed_as" in
        completed)   completed=$((completed + 1)) ;;
        not-planned) not_planned=$((not_planned + 1)) ;;
        duplicate)   dup=$((dup + 1)) ;;
      esac
    fi

    jq -r '.labels[]' "$f" 2>/dev/null >> "$all_labels_file"
  done

  echo -e "${BOLD}Issue Statistics${NC}"
  echo -e "────────────────────────────────"
  echo ""
  echo -e "  ${GREEN}○ Open${NC}      $open"
  echo -e "  ${MAGENTA}● Closed${NC}    $closed"
  if [[ $closed -gt 0 ]]; then
    echo -e "    completed:   $completed"
    echo -e "    not planned: $not_planned"
    echo -e "    duplicate:   $dup"
  fi
  echo -e "  ──────────"
  echo -e "  Total       $total"
  echo ""

  if [[ -s "$all_labels_file" ]]; then
    echo -e "  ${BOLD}Labels:${NC}"
    sort "$all_labels_file" | uniq -c | sort -rn | while read -r cnt label; do
      printf "    %b  %s\n" "$(format_label "$label")" "$cnt"
    done
    echo ""
  fi

  rm -f "$all_labels_file"
}

# =============================================================================
# Help
# =============================================================================

show_usage() {
  cat << 'EOF'
Issue Management (GitHub-style, with GitHub sync via MCP)

Usage:
  issue.sh create "<title>" [options]                   Create issue
  issue.sh list [filters]                               List open issues
  issue.sh show <id>                                    Show details
  issue.sh edit <id> [fields]                           Edit fields
  issue.sh label <id> --add <l> | --remove <l>          Manage labels
  issue.sh close <id> [--as completed|not-planned|duplicate] [--ref <id>]
  issue.sh reopen <id>                                  Reopen issue
  issue.sh comment <id> "<text>"                        Add comment
  issue.sh promote <id> [--slug <name>]                 Issue → Task
  issue.sh search "<query>"                             Full-text search
  issue.sh stats                                        Statistics

GitHub Sync (via MCP):
  issue.sh export <id> [--owner <o> --repo <r>]         Export for mcp__github__create_issue
  issue.sh export <id> --update                         Export for mcp__github__update_issue
  issue.sh import-github [--owner <o> --repo <r>]       Import from GitHub (pipe JSON via stdin)
  issue.sh link <id> --github owner/repo#number         Link local issue ↔ GitHub issue
  issue.sh link <id> --owner <o> --repo <r> --number <n>
  issue.sh unlink <id>                                  Remove GitHub link

Create options:
  --bug --feature --enhancement --question --discussion --rfc --chore
  --priority P0|P1|P2|P3       (adds label priority:Pn)
  --label <name>               (repeatable)
  --body "<markdown>"           Body text
  --body-file <path>           Body from file
  --milestone <name>           near-term | mid-term | long-term
  --file <path>                Related file (repeatable)
  --related <issue-id>         Related issue (repeatable)

List filters:
  --label <name>               --bug --feature --question --discussion --rfc
  --priority P0|P1|P2|P3       --milestone <name>    --assignee <name>
  --closed                     Include closed issues
  --all                        Same as --closed

Well-known labels:
  Type:     bug  feature  enhancement  question  discussion  rfc  chore  docs
  Priority: priority:P0  priority:P1  priority:P2  priority:P3
  Area:     core  cli  api  mcp  shared  acp
  Meta:     duplicate  wontfix  blocked  good-first-issue

Examples:
  issue.sh create "Socket timeout on Windows" --bug --priority P0 --label core
  issue.sh list --discussion
  issue.sh close 5 --as duplicate --ref 3

  # Push local issue #1 to GitHub:
  # 1. export → 2. AI calls mcp__github__create_issue → 3. link
  issue.sh export 1 --owner myorg --repo myrepo
  issue.sh link 1 --github myorg/myrepo#42

  # Pull GitHub issue into local:
  # 1. AI calls mcp__github__get_issue → 2. pipe JSON to import-github
  echo '<github_json>' | issue.sh import-github --owner myorg --repo myrepo
EOF
}

# =============================================================================
# Main
# =============================================================================

case "${1:-}" in
  create)         shift; cmd_create "$@" ;;
  list|ls)        shift; cmd_list "$@" ;;
  show)           cmd_show "$2" ;;
  edit)           shift; cmd_edit "$@" ;;
  label)          shift; cmd_label "$@" ;;
  close)          shift; cmd_close "$@" ;;
  reopen)         cmd_reopen "$2" ;;
  comment)        cmd_comment "$2" "$3" ;;
  promote)        shift; cmd_promote "$@" ;;
  search)         cmd_search "$2" ;;
  stats)          cmd_stats ;;
  export)         shift; cmd_export "$@" ;;
  import-github)  shift; cmd_import_github "$@" ;;
  link)           shift; cmd_link "$@" ;;
  unlink)         cmd_unlink "$2" ;;
  -h|--help|help) show_usage ;;
  *)              show_usage; exit 1 ;;
esac
