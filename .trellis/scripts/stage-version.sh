#!/bin/bash
# Stage Version Script
#
# Automates version staging: creates a versioned snapshot under docs/stage/<version>/
# containing architecture docs, changelog, and GitHub release metadata.
# Also syncs issue status changes.
#
# Usage:
#   stage-version.sh init <version>            — Create stage directory and metadata
#   stage-version.sh changelog <version>       — Generate changelog from git + issues
#   stage-version.sh tag <version>             — Create git tag
#   stage-version.sh release <version>         — Create GitHub release via gh CLI
#   stage-version.sh sync-issues <version>     — Update issues related to this version
#   stage-version.sh status <version>          — Show stage status
#   stage-version.sh list                      — List all staged versions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/paths.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

REPO_ROOT=$(get_repo_root)
STAGE_DIR="$REPO_ROOT/docs/stage"
ISSUES_DIR="$REPO_ROOT/$DIR_WORKFLOW/issues"

# =============================================================================
# Helpers
# =============================================================================

ensure_version() {
  local version="$1"
  if [[ -z "$version" ]]; then
    echo -e "${RED}Error: version is required${NC}" >&2
    echo "Usage: stage-version.sh <command> <version>" >&2
    exit 1
  fi
  # Normalize: accept both "0.1.0" and "v0.1.0"
  if [[ "$version" != v* ]]; then
    version="v$version"
  fi
  echo "$version"
}

get_stage_dir() {
  local version="$1"
  echo "$STAGE_DIR/$version"
}

get_pkg_version() {
  local pkg="$REPO_ROOT/package.json"
  if [[ -f "$pkg" ]]; then
    node -e "console.log(JSON.parse(require('fs').readFileSync('$pkg','utf8')).version)" 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

get_previous_tag() {
  git -C "$REPO_ROOT" describe --tags --abbrev=0 2>/dev/null || echo ""
}

get_issue_count() {
  local status="${1:-open}"
  local count=0
  for f in "$ISSUES_DIR"/[0-9][0-9][0-9][0-9]-*.json; do
    [[ ! -f "$f" ]] && continue
    local s
    s=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$f','utf8')).status)" 2>/dev/null)
    [[ "$s" == "$status" ]] && count=$((count + 1))
  done
  echo "$count"
}

collect_issues_by_label() {
  local label="$1"
  local status="${2:-closed}"
  for f in "$ISSUES_DIR"/[0-9][0-9][0-9][0-9]-*.json; do
    [[ ! -f "$f" ]] && continue
    node -e "
      const d = JSON.parse(require('fs').readFileSync('$f','utf8'));
      if (d.status === '$status' && (d.labels || []).includes('$label')) {
        console.log('#' + d.id + ' ' + d.title);
      }
    " 2>/dev/null
  done
}

# =============================================================================
# Command: pre-check
# =============================================================================

cmd_precheck() {
  echo -e "${BOLD}Pre-stage Quality Check${NC}"
  echo ""

  local pass=0
  local fail=0
  local warn=0

  # 1. Dirty working tree check
  local dirty
  dirty=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | head -20)
  if [[ -n "$dirty" ]]; then
    echo -e "  ${YELLOW}⚠${NC}  Dirty working tree (uncommitted changes)"
    warn=$((warn + 1))
  else
    echo -e "  ${GREEN}✓${NC}  Clean working tree"
    pass=$((pass + 1))
  fi

  # 2. Lint
  echo -e "  ${CYAN}…${NC}  Running lint..."
  if pnpm lint --quiet 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC}  pnpm lint"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC}  pnpm lint"
    fail=$((fail + 1))
  fi

  # 3. Type check
  echo -e "  ${CYAN}…${NC}  Running type-check..."
  if pnpm type-check 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC}  pnpm type-check"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC}  pnpm type-check"
    fail=$((fail + 1))
  fi

  # 4. Tests (incremental)
  echo -e "  ${CYAN}…${NC}  Running tests..."
  if pnpm test:changed 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC}  pnpm test:changed"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC}  pnpm test:changed"
    fail=$((fail + 1))
  fi

  echo ""
  echo -e "  ${BOLD}Result:${NC} ${GREEN}$pass passed${NC}, ${RED}$fail failed${NC}, ${YELLOW}$warn warnings${NC}"

  if [[ $fail -gt 0 ]]; then
    echo -e "  ${RED}Stage blocked. Fix failures before proceeding.${NC}"
    return 1
  fi

  if [[ $warn -gt 0 ]]; then
    echo -e "  ${YELLOW}Warnings present. Consider committing changes first.${NC}"
  fi

  return 0
}

# =============================================================================
# Command: metrics
# =============================================================================

cmd_metrics() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  [[ ! -d "$stage_dir" ]] && { echo -e "${RED}Error: stage dir not found. Run 'init' first.${NC}" >&2; exit 1; }

  echo -e "${BLUE}Generating metrics & dependency snapshots for ${BOLD}$version${NC}${BLUE}...${NC}"

  node "$SCRIPT_DIR/gen-metrics-snapshot.mjs" "$stage_dir"
  echo -e "${GREEN}✓ Metrics generated in docs/stage/$version/${NC}"
}

# =============================================================================
# Command: test-report
# =============================================================================

cmd_test_report() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  [[ ! -d "$stage_dir" ]] && { echo -e "${RED}Error: stage dir not found. Run 'init' first.${NC}" >&2; exit 1; }

  echo -e "${BLUE}Running tests and capturing report for ${BOLD}$version${NC}${BLUE}...${NC}"

  local report_file="$stage_dir/test-report.json"

  # Run vitest with JSON reporter
  local test_output
  local exit_code=0
  test_output=$(cd "$REPO_ROOT" && pnpm test -- --reporter=json 2>/dev/null) || exit_code=$?

  if [[ -n "$test_output" ]] && echo "$test_output" | node -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))" 2>/dev/null; then
    echo "$test_output" | node -e "
      const raw = require('fs').readFileSync('/dev/stdin', 'utf8');
      const data = JSON.parse(raw);
      const report = {
        date: new Date().toISOString(),
        exitCode: $exit_code,
        numTotalTests: data.numTotalTests || 0,
        numPassedTests: data.numPassedTests || 0,
        numFailedTests: data.numFailedTests || 0,
        numPendingTests: data.numPendingTests || 0,
        numTotalTestSuites: data.numTotalTestSuites || 0,
        numPassedTestSuites: data.numPassedTestSuites || 0,
        numFailedTestSuites: data.numFailedTestSuites || 0,
        success: data.success || false,
        testResults: (data.testResults || []).map(r => ({
          name: r.name.replace(/.*packages./, 'packages/'),
          status: r.status,
          tests: r.assertionResults ? r.assertionResults.length : 0,
        })),
      };
      require('fs').writeFileSync('$report_file', JSON.stringify(report, null, 2) + '\n');
      console.log('Tests: ' + report.numPassedTests + ' passed, ' + report.numFailedTests + ' failed, ' + report.numPendingTests + ' skipped');
    "
    echo -e "${GREEN}✓ Test report saved: docs/stage/$version/test-report.json${NC}"
  else
    # Fallback: capture raw output
    node -e "
      const report = {
        date: new Date().toISOString(),
        exitCode: $exit_code,
        raw: true,
        success: $exit_code === 0,
      };
      require('fs').writeFileSync('$report_file', JSON.stringify(report, null, 2) + '\n');
    "
    if [[ $exit_code -eq 0 ]]; then
      echo -e "${GREEN}✓ Tests passed (raw report saved)${NC}"
    else
      echo -e "${YELLOW}⚠ Tests had issues (exit code $exit_code, raw report saved)${NC}"
    fi
  fi
}

# =============================================================================
# Command: bump
# =============================================================================

cmd_bump() {
  local bump_type="${1:-patch}"
  local pkg="$REPO_ROOT/package.json"

  [[ ! -f "$pkg" ]] && { echo -e "${RED}Error: package.json not found${NC}" >&2; exit 1; }

  local current
  current=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$pkg','utf8')).version)" 2>/dev/null)

  if [[ -z "$current" ]]; then
    echo -e "${RED}Error: cannot read version from package.json${NC}" >&2
    exit 1
  fi

  # Parse semver
  local major minor patch
  IFS='.' read -r major minor patch <<< "$current"

  case "$bump_type" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *)
      echo -e "${RED}Error: bump type must be major, minor, or patch${NC}" >&2
      exit 1
      ;;
  esac

  local new_version="$major.$minor.$patch"

  echo -e "${BLUE}Bumping version: ${BOLD}$current${NC}${BLUE} → ${BOLD}$new_version${NC}${BLUE} ($bump_type)${NC}"

  # Update root package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$pkg', 'utf8'));
    pkg.version = '$new_version';
    fs.writeFileSync('$pkg', JSON.stringify(pkg, null, 2) + '\n');
  "

  echo -e "${GREEN}✓ package.json updated to $new_version${NC}"
  echo -e "  Run ${CYAN}stage-version.sh init $new_version${NC} to stage this version"
}

# =============================================================================
# Command: unstage
# =============================================================================

cmd_unstage() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  if [[ ! -d "$stage_dir" ]]; then
    echo -e "${RED}Stage $version not found${NC}"
    exit 1
  fi

  local file_count
  file_count=$(find "$stage_dir" -type f 2>/dev/null | wc -l | tr -d ' ')

  echo -e "${YELLOW}Removing stage $version ($file_count files)${NC}"

  rm -rf "$stage_dir"

  echo -e "${GREEN}✓ Stage $version removed${NC}"
}

# =============================================================================
# Command: latest
# =============================================================================

cmd_latest() {
  if [[ ! -d "$STAGE_DIR" ]]; then
    echo -e "${YELLOW}No stages found${NC}"
    return
  fi

  local latest_ver=""
  local latest_dir=""
  for d in "$STAGE_DIR"/v*/; do
    [[ ! -d "$d" ]] && continue
    latest_dir="$d"
    latest_ver=$(basename "$d")
  done

  if [[ -z "$latest_ver" ]]; then
    echo -e "${YELLOW}No stages found${NC}"
    return
  fi

  echo -e "${BOLD}Latest Stage: ${GREEN}$latest_ver${NC}"

  if [[ -f "$latest_dir/metadata.json" ]]; then
    node -e "
      const d = JSON.parse(require('fs').readFileSync('$latest_dir/metadata.json', 'utf8'));
      console.log('  Date:    ' + (d.date || 'N/A'));
      console.log('  Commit:  ' + (d.commit || 'N/A'));
      console.log('  Branch:  ' + (d.branch || 'N/A'));
      if (d.issuesOpen !== undefined) console.log('  Issues:  ' + (d.issuesOpen || 0) + ' open, ' + (d.issuesClosed || 0) + ' closed');
      if (d.githubRelease) console.log('  Release: ' + d.githubRelease);
    " 2>/dev/null
  fi

  local items=()
  [[ -f "$latest_dir/architecture.md" ]] && items+=("arch")
  [[ -f "$latest_dir/changelog.md" ]] && items+=("changelog")
  [[ -f "$latest_dir/api-surface.json" ]] && items+=("api")
  [[ -f "$latest_dir/config-schemas.json" ]] && items+=("config")
  [[ -f "$latest_dir/metrics.json" ]] && items+=("metrics")
  [[ -f "$latest_dir/dependencies.json" ]] && items+=("deps")
  [[ -f "$latest_dir/test-report.json" ]] && items+=("tests")
  [[ -f "$latest_dir/issue-snapshot.json" ]] && items+=("issues")

  echo -e "  Artifacts: [${items[*]}]"
}

# =============================================================================
# Command: init
# =============================================================================

cmd_init() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  echo -e "${BLUE}Initializing stage ${BOLD}$version${NC}${BLUE}...${NC}"

  mkdir -p "$stage_dir"

  # Write version metadata
  local date_now
  date_now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local pkg_version
  pkg_version=$(get_pkg_version)
  local branch
  branch=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "unknown")
  local commit_hash
  commit_hash=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  local prev_tag
  prev_tag=$(get_previous_tag)

  cat > "$stage_dir/metadata.json" << EOF
{
  "version": "$version",
  "packageVersion": "$pkg_version",
  "date": "$date_now",
  "branch": "$branch",
  "commit": "$commit_hash",
  "previousTag": "$prev_tag",
  "issuesOpen": $(get_issue_count "open"),
  "issuesClosed": $(get_issue_count "closed"),
  "staged": true
}
EOF

  echo -e "${GREEN}✓ Stage directory created: docs/stage/$version/${NC}"
  echo -e "  ${CYAN}metadata.json${NC} — version metadata"
  echo -e "  Next: generate architecture.md, changelog.md, then tag + release"
}

# =============================================================================
# Command: changelog
# =============================================================================

cmd_changelog() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")
  local changelog="$stage_dir/changelog.md"

  [[ ! -d "$stage_dir" ]] && { echo -e "${RED}Error: stage dir not found. Run 'init' first.${NC}" >&2; exit 1; }

  echo -e "${BLUE}Generating changelog for ${BOLD}$version${NC}${BLUE}...${NC}"

  local prev_tag
  prev_tag=$(get_previous_tag)
  local date_now
  date_now=$(date +"%Y-%m-%d")
  local range=""

  if [[ -n "$prev_tag" ]]; then
    range="${prev_tag}..HEAD"
    echo -e "  Range: $prev_tag → HEAD"
  else
    range="HEAD"
    echo -e "  Range: initial → HEAD (no previous tag)"
  fi

  # Collect git log (|| true to prevent exit on no matches)
  local feat_commits fix_commits refactor_commits docs_commits test_commits chore_commits
  feat_commits=$(git -C "$REPO_ROOT" log $range --pretty=format:"- %s (%h)" --grep="^feat" 2>/dev/null) || feat_commits=""
  fix_commits=$(git -C "$REPO_ROOT" log $range --pretty=format:"- %s (%h)" --grep="^fix" 2>/dev/null) || fix_commits=""
  refactor_commits=$(git -C "$REPO_ROOT" log $range --pretty=format:"- %s (%h)" --grep="^refactor" 2>/dev/null) || refactor_commits=""
  docs_commits=$(git -C "$REPO_ROOT" log $range --pretty=format:"- %s (%h)" --grep="^docs" 2>/dev/null) || docs_commits=""
  test_commits=$(git -C "$REPO_ROOT" log $range --pretty=format:"- %s (%h)" --grep="^test" 2>/dev/null) || test_commits=""
  chore_commits=$(git -C "$REPO_ROOT" log $range --pretty=format:"- %s (%h)" --grep="^chore" 2>/dev/null) || chore_commits=""

  # Collect closed issues for this version
  local closed_features closed_bugs closed_enhancements
  closed_features=$(collect_issues_by_label "feature" "closed")
  closed_bugs=$(collect_issues_by_label "bug" "closed")
  closed_enhancements=$(collect_issues_by_label "enhancement" "closed")

  # Collect open issues
  local open_issues=""
  for f in "$ISSUES_DIR"/[0-9][0-9][0-9][0-9]-*.json; do
    [[ ! -f "$f" ]] && continue
    node -e "
      const d = JSON.parse(require('fs').readFileSync('$f','utf8'));
      if (d.status === 'open') {
        console.log('- #' + d.id + ' ' + d.title + (d.milestone ? ' [' + d.milestone + ']' : ''));
      }
    " 2>/dev/null
  done > /tmp/actant_open_issues.tmp
  open_issues=$(cat /tmp/actant_open_issues.tmp 2>/dev/null || echo "")
  rm -f /tmp/actant_open_issues.tmp

  # Write changelog
  {
    echo "# Changelog — $version"
    echo ""
    echo "> **日期**: $date_now"
    if [[ -n "$prev_tag" ]]; then
      echo "> **变更范围**: $prev_tag → $version"
    else
      echo "> **变更范围**: 初始版本"
    fi
    echo ""
    echo "---"
    echo ""

    if [[ -n "$feat_commits" ]]; then
      echo "## ✨ 新功能 (Features)"
      echo ""
      echo "$feat_commits"
      echo ""
    fi

    if [[ -n "$fix_commits" ]]; then
      echo "## 🐛 修复 (Fixes)"
      echo ""
      echo "$fix_commits"
      echo ""
    fi

    if [[ -n "$refactor_commits" ]]; then
      echo "## ♻️ 重构 (Refactoring)"
      echo ""
      echo "$refactor_commits"
      echo ""
    fi

    if [[ -n "$docs_commits" ]]; then
      echo "## 📝 文档 (Documentation)"
      echo ""
      echo "$docs_commits"
      echo ""
    fi

    if [[ -n "$test_commits" ]]; then
      echo "## 🧪 测试 (Tests)"
      echo ""
      echo "$test_commits"
      echo ""
    fi

    if [[ -n "$chore_commits" ]]; then
      echo "## 🔧 杂项 (Chores)"
      echo ""
      echo "$chore_commits"
      echo ""
    fi

    echo "---"
    echo ""
    echo "## 📋 Issue 变更"
    echo ""

    if [[ -n "$closed_features" ]]; then
      echo "### 已完成的功能"
      echo ""
      echo "$closed_features" | while IFS= read -r line; do [[ -n "$line" ]] && echo "- $line"; done
      echo ""
    fi

    if [[ -n "$closed_bugs" ]]; then
      echo "### 已修复的缺陷"
      echo ""
      echo "$closed_bugs" | while IFS= read -r line; do [[ -n "$line" ]] && echo "- $line"; done
      echo ""
    fi

    if [[ -n "$closed_enhancements" ]]; then
      echo "### 已完成的增强"
      echo ""
      echo "$closed_enhancements" | while IFS= read -r line; do [[ -n "$line" ]] && echo "- $line"; done
      echo ""
    fi

    echo "### 待处理 (Open Issues)"
    echo ""
    if [[ -n "$open_issues" ]]; then
      echo "$open_issues"
    else
      echo "_无待处理 issue_"
    fi
    echo ""

    echo "---"
    echo ""
    echo "## 统计"
    echo ""
    echo "| 指标 | 数量 |"
    echo "|------|------|"
    local total_commits
    total_commits=$(git -C "$REPO_ROOT" log $range --oneline 2>/dev/null | wc -l | tr -d ' ')
    local files_changed
    if [[ -n "$prev_tag" ]]; then
      files_changed=$(git -C "$REPO_ROOT" diff --stat "$prev_tag" HEAD 2>/dev/null | tail -1 | grep -o '[0-9]\+ file' | grep -o '[0-9]\+' || echo "N/A")
    else
      files_changed=$(git -C "$REPO_ROOT" ls-files 2>/dev/null | wc -l | tr -d ' ')
    fi
    echo "| 提交总数 | $total_commits |"
    echo "| 变更文件 | $files_changed |"
    echo "| 已关闭 Issue | $(get_issue_count "closed") |"
    echo "| 待处理 Issue | $(get_issue_count "open") |"
  } > "$changelog"

  echo -e "${GREEN}✓ Changelog generated: docs/stage/$version/changelog.md${NC}"
}

# =============================================================================
# Command: tag
# =============================================================================

cmd_tag() {
  local version
  version=$(ensure_version "${1:-}")

  echo -e "${BLUE}Creating git tag ${BOLD}$version${NC}${BLUE}...${NC}"

  if git -C "$REPO_ROOT" tag -l "$version" | grep -q "$version"; then
    echo -e "${YELLOW}⚠ Tag $version already exists${NC}"
    return 0
  fi

  git -C "$REPO_ROOT" tag -a "$version" -m "Release $version"
  echo -e "${GREEN}✓ Tag $version created${NC}"
  echo -e "  Push with: git push origin $version"
}

# =============================================================================
# Command: release
# =============================================================================

cmd_release() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  [[ ! -d "$stage_dir" ]] && { echo -e "${RED}Error: stage dir not found. Run 'init' first.${NC}" >&2; exit 1; }

  echo -e "${BLUE}Creating GitHub release ${BOLD}$version${NC}${BLUE}...${NC}"

  if ! command -v gh &>/dev/null; then
    echo -e "${YELLOW}⚠ gh CLI not found. Skipping GitHub release.${NC}"
    echo -e "  Install: https://cli.github.com/"
    return 0
  fi

  local notes_file="$stage_dir/changelog.md"
  if [[ ! -f "$notes_file" ]]; then
    echo -e "${YELLOW}⚠ No changelog found. Run 'changelog' first.${NC}"
    return 1
  fi

  # Ensure tag exists
  if ! git -C "$REPO_ROOT" tag -l "$version" | grep -q "$version"; then
    echo -e "${YELLOW}Creating tag first...${NC}"
    cmd_tag "${version#v}"
  fi

  # Push tag
  echo -e "  Pushing tag..."
  git -C "$REPO_ROOT" push origin "$version" 2>/dev/null || true

  # Create release
  gh release create "$version" \
    --repo "blackplume233/AgentCraft" \
    --title "Actant $version" \
    --notes-file "$notes_file" \
    2>/dev/null && echo -e "${GREEN}✓ GitHub release $version created${NC}" \
    || echo -e "${YELLOW}⚠ Release creation failed (may already exist)${NC}"

  # Save GitHub release URL
  local release_url
  release_url=$(gh release view "$version" --repo "blackplume233/AgentCraft" --json url -q .url 2>/dev/null || echo "")
  if [[ -n "$release_url" ]]; then
    node -e "
      const fs = require('fs');
      const meta = JSON.parse(fs.readFileSync('$stage_dir/metadata.json','utf8'));
      meta.githubRelease = '$release_url';
      fs.writeFileSync('$stage_dir/metadata.json', JSON.stringify(meta, null, 2) + '\n');
    "
    echo -e "  ${CYAN}Release URL: $release_url${NC}"
  fi
}

# =============================================================================
# Command: sync-issues
# =============================================================================

cmd_sync_issues() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  [[ ! -d "$stage_dir" ]] && { echo -e "${RED}Error: stage dir not found. Run 'init' first.${NC}" >&2; exit 1; }

  echo -e "${BLUE}Syncing issues for ${BOLD}$version${NC}${BLUE}...${NC}"

  # Use dedicated node script for cross-platform reliability
  node "$SCRIPT_DIR/gen-issue-snapshot.mjs" "$version" "$stage_dir/issue-snapshot.json"

  # Sync to GitHub if gh is available
  if command -v gh &>/dev/null; then
    echo -e "  ${CYAN}Running GitHub issue sync...${NC}"
    local sync_script="$REPO_ROOT/$DIR_WORKFLOW/scripts/sync-github-issues.mjs"
    if [[ -f "$sync_script" ]]; then
      node "$sync_script" 2>&1 | tail -5
      echo -e "${GREEN}✓ GitHub issues synced${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ gh CLI not found. Skipping GitHub sync.${NC}"
  fi
}

# =============================================================================
# Command: status
# =============================================================================

cmd_status() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  if [[ ! -d "$stage_dir" ]]; then
    echo -e "${RED}Stage $version not found${NC}"
    exit 1
  fi

  echo -e "${BOLD}Stage $version Status${NC}"
  echo ""

  local c
  local checks=()

  for pair in \
    "metadata.json|metadata.json" \
    "architecture.md|architecture.md" \
    "api-surface.md + .json|api-surface.json" \
    "config-schemas.md + .json|config-schemas.json" \
    "changelog.md|changelog.md" \
    "metrics.json|metrics.json" \
    "dependencies.json|dependencies.json" \
    "test-report.json|test-report.json" \
    "issue-snapshot.json|issue-snapshot.json"; do
    local label="${pair%%|*}"
    local file="${pair##*|}"
    if [[ -f "$stage_dir/$file" ]]; then
      echo -e "  ${GREEN}✓${NC}  $label"
    else
      echo -e "  ${RED}✗${NC}  $label"
    fi
  done

  if git -C "$REPO_ROOT" tag -l "$version" | grep -q "$version"; then
    echo -e "  ${GREEN}✓${NC}  git tag $version"
  else
    echo -e "  ${RED}✗${NC}  git tag $version"
  fi

  if [[ -f "$stage_dir/metadata.json" ]]; then
    echo ""
    local gh_url
    gh_url=$(node -e "const d=JSON.parse(require('fs').readFileSync('$stage_dir/metadata.json','utf8'));console.log(d.githubRelease||'')" 2>/dev/null)
    if [[ -n "$gh_url" ]]; then
      echo -e "  ${CYAN}GitHub Release: $gh_url${NC}"
    fi
  fi
}

# =============================================================================
# Command: list
# =============================================================================

cmd_list() {
  echo -e "${BOLD}Staged Versions${NC}"
  echo ""

  if [[ ! -d "$STAGE_DIR" ]]; then
    echo -e "  ${YELLOW}No stages found${NC}"
    return
  fi

  for d in "$STAGE_DIR"/v*/; do
    [[ ! -d "$d" ]] && continue
    local ver
    ver=$(basename "$d")
    local date_str=""
    if [[ -f "$d/metadata.json" ]]; then
      date_str=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$d/metadata.json','utf8')).date||'')" 2>/dev/null)
    fi

    local items=()
    [[ -f "$d/architecture.md" ]] && items+=("arch")
    [[ -f "$d/changelog.md" ]] && items+=("changelog")
    [[ -f "$d/api-surface.json" ]] && items+=("api")
    [[ -f "$d/config-schemas.json" ]] && items+=("config")
    [[ -f "$d/metrics.json" ]] && items+=("metrics")
    [[ -f "$d/dependencies.json" ]] && items+=("deps")
    [[ -f "$d/test-report.json" ]] && items+=("tests")
    [[ -f "$d/issue-snapshot.json" ]] && items+=("issues")

    echo -e "  ${GREEN}$ver${NC}  ${GRAY}$date_str${NC}  [${items[*]}]"
  done
}

# =============================================================================
# Command: snapshot (API surface + config schemas)
# =============================================================================

cmd_snapshot() {
  local version
  version=$(ensure_version "${1:-}")
  local stage_dir
  stage_dir=$(get_stage_dir "$version")

  [[ ! -d "$stage_dir" ]] && { echo -e "${RED}Error: stage dir not found. Run 'init' first.${NC}" >&2; exit 1; }

  echo -e "${BLUE}Generating API surface & config schema snapshots for ${BOLD}$version${NC}${BLUE}...${NC}"

  node "$SCRIPT_DIR/gen-surface-snapshot.mjs" "$stage_dir"
  echo -e "${GREEN}✓ Snapshots generated in docs/stage/$version/${NC}"
}

# =============================================================================
# Command: diff
# =============================================================================

cmd_diff() {
  local v1="$1"
  local v2="$2"

  [[ -z "$v1" || -z "$v2" ]] && { echo -e "${RED}Usage: stage-version.sh diff <v1> <v2>${NC}" >&2; exit 1; }

  v1=$(ensure_version "$v1")
  v2=$(ensure_version "$v2")

  local dir1
  dir1=$(get_stage_dir "$v1")
  local dir2
  dir2=$(get_stage_dir "$v2")

  [[ ! -d "$dir1" ]] && { echo -e "${RED}Error: stage $v1 not found${NC}" >&2; exit 1; }
  [[ ! -d "$dir2" ]] && { echo -e "${RED}Error: stage $v2 not found${NC}" >&2; exit 1; }

  echo -e "${BLUE}Diffing ${BOLD}$v1${NC}${BLUE} → ${BOLD}$v2${NC}${BLUE}...${NC}"

  local output="$dir2/diff-from-$v1.md"
  node "$SCRIPT_DIR/diff-versions.mjs" "$v1" "$v2" --output "$output"
  echo -e "${GREEN}✓ Diff report: docs/stage/$v2/diff-from-$v1.md${NC}"
}

# =============================================================================
# Main
# =============================================================================

case "${1:-}" in
  pre-check)   cmd_precheck ;;
  init)        cmd_init "$2" ;;
  changelog)   cmd_changelog "$2" ;;
  snapshot)    cmd_snapshot "$2" ;;
  metrics)     cmd_metrics "$2" ;;
  test-report) cmd_test_report "$2" ;;
  tag)         cmd_tag "$2" ;;
  release)     cmd_release "$2" ;;
  sync-issues) cmd_sync_issues "$2" ;;
  diff)        cmd_diff "$2" "$3" ;;
  bump)        cmd_bump "$2" ;;
  unstage)     cmd_unstage "$2" ;;
  latest)      cmd_latest ;;
  status)      cmd_status "$2" ;;
  list)        cmd_list ;;
  *)
    echo -e "${BOLD}stage-version.sh${NC} — Version staging tool"
    echo ""
    echo "Staging:"
    echo "  pre-check                              Quality gate (lint, type-check, test)"
    echo "  init <version>                         Create stage directory"
    echo "  changelog <version>                    Generate changelog"
    echo "  snapshot <version>                     Generate API surface + config schemas"
    echo "  metrics <version>                      Generate code metrics + dependencies"
    echo "  test-report <version>                  Run tests and capture report"
    echo "  sync-issues <version>                  Snapshot and sync issues"
    echo ""
    echo "Publishing:"
    echo "  tag <version>                          Create git tag"
    echo "  release <version>                      Create GitHub release"
    echo ""
    echo "Comparison:"
    echo "  diff <v1> <v2>                         Diff API + config between versions"
    echo ""
    echo "Lifecycle:"
    echo "  bump <major|minor|patch>               Bump version in package.json"
    echo "  unstage <version>                      Remove a staged version"
    echo "  latest                                 Show latest staged version"
    echo "  status <version>                       Check stage completeness"
    echo "  list                                   List all staged versions"
    ;;
esac
