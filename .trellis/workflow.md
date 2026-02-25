# Development Workflow

> Based on [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

---

## Table of Contents

1. [Quick Start (Do This First)](#quick-start-do-this-first)
2. [Workflow Overview](#workflow-overview)
3. [Session Start Process](#session-start-process)
4. [Development Process](#development-process)
5. [Session End](#session-end)
6. [File Descriptions](#file-descriptions)
7. [Best Practices](#best-practices)

---

## Quick Start (Do This First)

### Step 0: Initialize Developer Identity (First Time Only)

> **Multi-developer support**: Each developer/Agent needs to initialize their identity first.
> **Actant Agent model**: AI 开发者本质上是一个 Actant Agent 实例——拥有身份、workspace 和生命周期。

```bash
# Check if already initialized
./.trellis/scripts/get-developer.sh

# If not initialized, run:
./.trellis/scripts/init-developer.sh <your-name>
# Example: ./.trellis/scripts/init-developer.sh actant-cursor-agent
```

This creates:
- `.trellis/.developer` - Your identity file (gitignored, not committed)
- `.trellis/workspace/<your-name>/` - Your personal workspace directory

**Naming conventions (Actant Agent identity)**:

| Agent 类型 | 推荐名称 | 说明 |
|-----------|---------|------|
| Cursor AI | `actant-cursor-agent` | 使用 `/trellis-plan-start` 启动会话 |
| Claude Code | `actant-claude-agent` | 使用 `/trellis:plan-start` 启动会话 |
| Human developer | `actant-<your-name>` | e.g., `actant-john-doe` |
| Task-scoped agent | `actant-<platform>-<task>` | e.g., `actant-cursor-refactor`, `actant-claude-qa` |

> **理念**: 每个 AI 开发者会话对应一个 Actant Agent 实例。身份初始化后，通过 `/trellis-plan-start`（Cursor）或 `/trellis:plan-start`（Claude Code）启动 plan-first 工作流，确保先规划再执行。

### Step 1: Understand Current Context

```bash
# Get full context in one command
./.trellis/scripts/get-context.sh

# Or check manually:
./.trellis/scripts/get-developer.sh      # Your identity
./.trellis/scripts/task.sh list          # Active tasks
git status && git log --oneline -10      # Git state
```

### Step 2: Read Project Guidelines [MANDATORY]

**CRITICAL**: Read guidelines before writing any code:

```bash
# Read frontend guidelines index (if applicable)
cat .trellis/spec/frontend/index.md

# Read backend guidelines index (if applicable)
cat .trellis/spec/backend/index.md
```

**Why read both?**
- Understand the full project architecture
- Know coding standards for the entire codebase
- See how frontend and backend interact
- Learn the overall code quality requirements

### Step 3: Before Coding - Read Specific Guidelines (Required)

Based on your task, read the **detailed** guidelines:

**Frontend Task**:
```bash
cat .trellis/spec/frontend/hook-guidelines.md      # For hooks
cat .trellis/spec/frontend/component-guidelines.md # For components
cat .trellis/spec/frontend/type-safety.md          # For types
```

**Backend Task**:
```bash
cat .trellis/spec/backend/database-guidelines.md   # For DB operations
cat .trellis/spec/backend/type-safety.md           # For types
cat .trellis/spec/backend/logging-guidelines.md    # For logging
```

---

## Workflow Overview

### Core Principles

1. **Read Before Write** - Understand context before starting
2. **Follow Standards** - [!] **MUST read `.trellis/spec/` guidelines before coding**
3. **Incremental Development** - Complete one task at a time
4. **Record Promptly** - Update tracking files immediately after completion
5. **Document Limits** - [!] **Max 2000 lines per journal document**

### File System

```
.trellis/
|-- .developer           # Developer identity (gitignored)
|-- scripts/
|   |-- common/              # Shared utilities
|   |   |-- paths.sh         # Path utilities
|   |   |-- developer.sh     # Developer management
|   |   \-- git-context.sh   # Git context implementation
|   |-- init-developer.sh    # Initialize developer identity
|   |-- get-developer.sh     # Get current developer name
|   |-- task.sh              # Manage tasks (active work)
|   |-- issue.sh             # Manage issues (backlog)
|   |-- get-context.sh       # Get session context
|   \-- add-session.sh       # One-click session recording
|-- workspace/           # Developer workspaces
|   |-- index.md         # Workspace index + Session template
|   \-- {developer}/     # Per-developer directories
|       |-- index.md     # Personal index (with @@@auto markers)
|       \-- journal-N.md # Journal files (sequential numbering)
|-- tasks/               # Task tracking (active work)
|   \-- {MM}-{DD}-{name}/
|       \-- task.json
|-- issues/              # Issue tracking (backlog)
|   |-- .counter         # Auto-increment ID counter
|   \-- {NNNN}-{slug}.md    # Obsidian Markdown issue files (YAML frontmatter + wikilinks + body)
|-- roadmap.md           # Product roadmap — 当前/后续优先级，与 Issues/Tasks 对齐
|-- spec/                # [!] MUST READ before coding
|   |-- index.md                 # Spec overview (hierarchy: spec > impl)
|   |-- config-spec.md           # [PRIMARY] Configuration specification
|   |-- api-contracts.md         # [PRIMARY] Interface contracts
|   |-- frontend/        # Frontend implementation guidelines
|   |   |-- index.md               # Start here - guidelines index
|   |   \-- *.md                   # Topic-specific docs
|   |-- backend/         # Backend implementation guidelines
|   |   |-- index.md               # Start here - guidelines index
|   |   \-- *.md                   # Topic-specific docs
|   \-- guides/          # Thinking guides
|       |-- index.md                      # Guides index
|       |-- cross-layer-thinking-guide.md # Pre-implementation checklist
|       \-- *.md                          # Other guides
\-- workflow.md             # This document
```

---

## Session Start Process

### Step 1: Get Session Context

Use the unified context script:

```bash
# Get all context in one command
./.trellis/scripts/get-context.sh

# Or get JSON format
./.trellis/scripts/get-context.sh --json
```

### Step 2: Read Development Guidelines [!] REQUIRED

**[!] CRITICAL: MUST read guidelines before writing any code**

Based on what you'll develop, read the corresponding guidelines:

**Frontend Development** (if applicable):
```bash
# Read index first, then specific docs based on task
cat .trellis/spec/frontend/index.md
```

**Backend Development** (if applicable):
```bash
# Read index first, then specific docs based on task
cat .trellis/spec/backend/index.md
```

**Cross-Layer Features**:
```bash
# For features spanning multiple layers
cat .trellis/spec/guides/cross-layer-thinking-guide.md
```

### Step 3: Select Task to Develop

Use the task management script:

```bash
# List active tasks
./.trellis/scripts/task.sh list

# Create new task (creates directory with task.json)
./.trellis/scripts/task.sh create "<title>" --slug <task-name>
```

---

## Development Process

### Task Development Flow

```
1. Create or select task
   \-> ./.trellis/scripts/task.sh create "<title>" --slug <name> or list

2. Write code according to guidelines
   \-> Read .trellis/spec/ docs relevant to your task
   \-> For cross-layer: read .trellis/spec/guides/

3. Self-test
   \-> Run project's lint/test commands (see spec docs)
   \-> Manual feature testing

4. Commit code
   \-> git add <files>
   \-> git commit -m "type(scope): description"
       Format: feat/fix/docs/refactor/test/chore

5. Record session (one command)
   \-> ./.trellis/scripts/add-session.sh --title "Title" --commit "hash"
```

### Code Quality Checklist

**Must pass before commit**:
- [OK] Lint checks pass (project-specific command)
- [OK] Type checks pass (if applicable)
- [OK] Manual feature testing passes

**Doc sync (config / interface changes)**:
- [OK] If configuration fields, schemas, or environment variables changed → update `spec/config-spec.md`
- [OK] If RPC methods, CLI commands, error codes, or public APIs changed → update `spec/api-contracts.md`

**Endurance test sync (功能变更时必选)**:
- [OK] If changes affect agent lifecycle, state machine, communication, or process management → update `*.endurance.test.ts` per `spec/endurance-testing.md`
- [OK] If existing endurance tests break due to interface changes → fix them in the same commit
- [OK] Quick regression passes: `ENDURANCE_DURATION_MS=5000 pnpm test:endurance`

**Project-specific checks**:
- See `.trellis/spec/frontend/quality-guidelines.md` for frontend
- See `.trellis/spec/backend/quality-guidelines.md` for backend

---

## Session End

### One-Click Session Recording

After code is committed, use:

```bash
./.trellis/scripts/add-session.sh \
  --title "Session Title" \
  --commit "abc1234" \
  --summary "Brief summary"
```

This automatically:
1. Detects current journal file
2. Creates new file if 2000-line limit exceeded
3. Appends session content
4. Updates index.md (sessions count, history table)

### Pre-end Checklist

Use `/trellis:finish-work` command to run through:
1. [OK] All code committed, commit message follows convention
2. [OK] Session recorded via `add-session.sh`
3. [OK] No lint/test errors
4. [OK] Working directory clean (or WIP noted)
5. [OK] Spec docs updated if needed
6. [OK] Config/interface changes → `spec/config-spec.md` / `spec/api-contracts.md` updated
7. [OK] Endurance tests synced if lifecycle/state/communication changed → `spec/endurance-testing.md`

---

## File Descriptions

### 1. workspace/ - Developer Workspaces

**Purpose**: Record each AI Agent session's work content

**Structure** (Multi-developer support):
```
workspace/
|-- index.md              # Main index (Active Developers table)
\-- {developer}/          # Per-developer directory
    |-- index.md          # Personal index (with @@@auto markers)
    \-- journal-N.md      # Journal files (sequential: 1, 2, 3...)
```

**When to update**:
- [OK] End of each session
- [OK] Complete important task
- [OK] Fix important bug

### 2. spec/ - Development Guidelines

**Purpose**: Documented standards for consistent development

**Structure** (Multi-doc format):
```
spec/
|-- frontend/           # Frontend docs (if applicable)
|   |-- index.md        # Start here
|   \-- *.md            # Topic-specific docs
|-- backend/            # Backend docs (if applicable)
|   |-- index.md        # Start here
|   \-- *.md            # Topic-specific docs
\-- guides/             # Thinking guides
    |-- index.md        # Start here
    \-- *.md            # Guide-specific docs
```

**When to update**:
- [OK] New pattern discovered
- [OK] Bug fixed that reveals missing guidance
- [OK] New convention established

### 3. Tasks - Active Work Tracking

Each task is a directory containing `task.json`:

```
tasks/
|-- 01-21-my-task/
|   \-- task.json
\-- archive/
    \-- 2026-01/
        \-- 01-15-old-task/
            \-- task.json
```

**Commands**:
```bash
./.trellis/scripts/task.sh create "<title>" [--slug <name>]   # Create task directory
./.trellis/scripts/task.sh archive <name>  # Archive to archive/{year-month}/
./.trellis/scripts/task.sh list            # List active tasks
./.trellis/scripts/task.sh list-archive    # List archived tasks
```

### 4. roadmap.md - Product Roadmap

**Purpose**: Single source of truth for "what we're doing now" and "what we do next". Aligns with Issues and Tasks.

**When to update**:
- [OK] When starting or completing a task (update "当前进行中" / "后续优先")
- [OK] When reprioritizing or closing issues
- [OK] When planning a release or milestone

See `docs/planning/roadmap.md` for structure and maintenance notes.

### 5. Issues - Backlog Tracking (GitHub-first)

> **核心原则：GitHub Issues 是 Issue 的唯一真相源（Single Source of Truth）。**
> 本地 `.trellis/issues/` 中的 Markdown 文件是 GitHub Issues 的缓存/镜像，Issue 编号（`id` 字段）**必须**与 GitHub Issue 编号一致。

Issues are Obsidian-style Markdown files mirroring GitHub Issues. Each file uses YAML frontmatter for structured metadata, `[[wikilinks]]` for related issue navigation, and rich Markdown body + comments.

```
issues/
|-- .counter                 # Tracks highest GitHub issue number
|-- 0120-windows-daemon...   # Open issue — GitHub #120
|-- 0121-pi-agent...         # Open issue — GitHub #121
\-- archive/                 # Closed issues (auto-archived on close)
    |-- 0022-processwatcher.md
    |-- 0043-unified-component-management.md
    \-- ...
```

**Issue 编号规则**:
- `id` 字段 = GitHub Issue number（不再使用本地自增序号）
- 文件名格式: `NNNN-slug.md`，其中 `NNNN` = 零填充的 GitHub Issue number
- `.counter` 记录当前最大 GitHub Issue number，供新建时参考
- `githubRef` 字段格式: `"blackplume233/Actant#N"`

**归档机制（Archive）**:

> **已关闭的 issue 自动归档到 `issues/archive/`，避免污染 AI Agent 的上下文窗口。**

- `issue close <id>` 关闭后**自动**将文件移至 `issues/archive/`
- `issue close <id> --no-archive` 关闭但保留在 issues 根目录（少见场景）
- `issue reopen <id>` 会自动从 archive 恢复到 issues 根目录
- `issue archive --all` 批量归档所有已关闭 issue
- `issue archive <id>` 手动归档单个已关闭 issue
- `issue show <id>` / `issue search` 仍可查阅归档 issue（自动跨目录搜索）
- **归档不影响 GitHub**：归档仅是本地文件位置变化，GitHub Issue 状态不变

**Issue vs Task**:

| Concept | Issue | Task |
|---------|-------|------|
| Purpose | Backlog — what needs doing (synced with GitHub) | Active work — what's being done now |
| Lifecycle | open → (promote) → in-progress → closed → **archived** | planning → in_progress → review → completed |
| Storage | Single Markdown file per issue (mirrors GitHub) | Directory with task.json, prd.md, jsonl contexts |
| Transition | `issue.sh promote <id>` creates a Task | `task.sh archive <name>` archives completed Task |

**Workflow**: GitHub Issue (idea) → **local cache** → **promote** → Task (active work) → **close** → **archive** → Done

**创建 Issue 的标准流程（GitHub-first）**:
```bash
# 1. 在 GitHub 上创建 Issue（推荐使用 gh CLI）
gh issue create -t "<title>" -b "<body>" -l "feature"
# → 获得 GitHub Issue #N

# 2. 本地创建对应的缓存文件
./.trellis/scripts/issue.sh create "<title>" --id N --feature --priority P1
# 或通过 pull 自动导入
./.trellis/scripts/issue.sh pull N
```

**查询与管理（修改操作自动同步到 GitHub）**:
```bash
./.trellis/scripts/issue.sh list [--milestone mid-term] [--priority P1] [--rfc]
./.trellis/scripts/issue.sh show <id>
./.trellis/scripts/issue.sh edit <id> --assign actant-cursor-agent --milestone mid-term  # ← auto-sync
./.trellis/scripts/issue.sh label <id> --add rfc --remove question               # ← auto-sync
./.trellis/scripts/issue.sh comment <id> "Design doc completed"                  # ← auto-sync
./.trellis/scripts/issue.sh close <id> --as completed                            # ← auto-sync + auto-archive
./.trellis/scripts/issue.sh reopen <id>                                          # ← auto-restore from archive
./.trellis/scripts/issue.sh archive --all                                        # Archive all closed issues
./.trellis/scripts/issue.sh promote <id>       # → Creates Task from Issue
./.trellis/scripts/issue.sh search "memory"
./.trellis/scripts/issue.sh stats
```

**同步与 Dirty 跟踪**:
```bash
./.trellis/scripts/issue.sh sync <id>          # 手动推送单个 issue 到 GitHub
./.trellis/scripts/issue.sh sync --all         # 推送所有 dirty issues
./.trellis/scripts/issue.sh check-dirty        # 检查是否有未同步的 issue
./.trellis/scripts/issue.sh check-dirty --strict  # 有 dirty 则 exit 1（用于 commit 前检查）
./.trellis/scripts/issue.sh pull <number>      # 从 GitHub 拉取到本地
```

> **Dirty 机制**: 每次修改操作（edit/label/close/reopen/comment）会自动标记为 dirty
> 并尝试通过 `gh` CLI 推送到 GitHub。若网络不可用，issue 保持 dirty 状态直到手动同步。
> **commit 前务必运行 `check-dirty`** 确认所有变更已同步。

**Status**: `open` / `closed` (binary, like GitHub)
**Close reasons**: `completed` / `not-planned` / `duplicate`
**Labels** (convention, not enforced):
- Type: `bug` `feature` `enhancement` `question` `discussion` `rfc` `chore` `docs`
- Priority: `priority:P0` `priority:P1` `priority:P2` `priority:P3`
- Area: `core` `cli` `api` `mcp` `shared` `acp`
- Meta: `duplicate` `wontfix` `blocked` `good-first-issue`
**Milestones**: `near-term` | `mid-term` | `long-term`

### 6. GitHub Integration

> **GitHub 是 Issue 的权威来源**。本地 `.trellis/issues/` 文件是 Obsidian 兼容的缓存，便于离线浏览和图谱导航。

**Architecture**:
```
┌──────────┐   gh CLI / MCP   ┌───────────┐   local cache   ┌─────────────┐
│  GitHub  │ ←──────────────→ │  AI Agent  │ ──────────────→ │ Local .md   │
│  Issues  │  (source of truth)│ (Orchestrator) │             │ (mirror)    │
└──────────┘                  └───────────┘                  └─────────────┘
```

**从 GitHub 拉取到本地**:
```bash
./.trellis/scripts/issue.sh pull <number>     # 拉取单个 GitHub Issue → 本地缓存
```

**从本地推送到 GitHub（自动或手动）**:
```bash
# 修改操作会自动尝试同步，如果失败则标记为 dirty
./.trellis/scripts/issue.sh sync <id>         # 手动推送单个 issue
./.trellis/scripts/issue.sh sync --all        # 推送所有 dirty issues
./.trellis/scripts/issue.sh check-dirty       # 检查未同步的 issue
```

**Dirty 跟踪流程**:
```
┌──────────┐   mutation    ┌──────────┐   auto-sync   ┌──────────┐
│  Local   │ ────────────→ │  Dirty   │ ────────────→ │  GitHub  │
│  Edit    │               │  Mark    │  (gh CLI)     │  Updated │
└──────────┘               └──────────┘               └──────────┘
                                │ if sync fails            ↑
                                ▼                          │
                           ┌──────────┐   manual sync  ────┘
                           │  Stays   │  (issue sync)
                           │  Dirty   │
                           └──────────┘
```

**Commit 前检查**:
```bash
# 在 git commit 之前确保所有 issue 变更已同步
./.trellis/scripts/issue.sh check-dirty --strict  # 有 dirty → exit 1
./.trellis/scripts/issue.sh sync --all            # 全部推送
```

**GitHub CLI 常用命令**:
```bash
gh issue list --state open                    # 列出所有 open issues
gh issue view <number>                        # 查看详情
gh issue create -t "title" -b "body" -l bug   # 创建新 issue
gh issue close <number>                       # 关闭 issue
gh issue comment <number> -b "comment"        # 添加评论
```

---

## Best Practices

### [OK] DO - Should Do

1. **Before session start**:
   - Run `./.trellis/scripts/get-context.sh` for full context
   - [!] **MUST read** relevant `.trellis/spec/` docs

2. **During development**:
   - [!] **Follow** `.trellis/spec/` guidelines
   - For cross-layer features, use `/trellis:check-cross-layer`
   - Develop only one task at a time
   - Run lint and tests frequently
   - [!] If changing config schemas or external interfaces, update `spec/config-spec.md` / `spec/api-contracts.md` in the **same commit**

3. **After development complete**:
   - Use `/trellis:finish-work` for completion checklist
   - After fix bug, use `/trellis:break-loop` for deep analysis
   - Human commits after testing passes
   - Use `add-session.sh` to record progress

### [X] DON'T - Should Not Do

1. [!] **Don't** skip reading `.trellis/spec/` guidelines
2. [!] **Don't** let journal single file exceed 2000 lines
3. **Don't** develop multiple unrelated tasks simultaneously
4. **Don't** commit code with lint/test errors
5. **Don't** forget to update spec docs after learning something
6. [!] **Don't** execute `git commit` - AI should not commit code

---

## Quick Reference

### Must-read Before Development

| Task Type | Must-read Document |
|-----------|-------------------|
| Frontend work | `frontend/index.md` → relevant docs |
| Backend work | `backend/index.md` → relevant docs |
| Cross-Layer Feature | `guides/cross-layer-thinking-guide.md` |

### Commit Convention

```bash
git commit -m "type(scope): description"
```

**Type**: feat, fix, docs, refactor, test, chore
**Scope**: Module name (e.g., auth, api, ui)

### Common Commands

```bash
# Session management
./.trellis/scripts/get-context.sh    # Get full context
./.trellis/scripts/add-session.sh    # Record session

# Task management (active work)
./.trellis/scripts/task.sh list      # List tasks
./.trellis/scripts/task.sh create "<title>" # Create task

# Issue management (GitHub-first — mutations auto-sync)
gh issue list --state open                              # List open GitHub issues
gh issue create -t "<title>" -b "<body>" -l "feature"   # Create on GitHub first
./.trellis/scripts/issue.sh pull <number>               # Pull GitHub → local cache
./.trellis/scripts/issue.sh list [filters]              # List local cached issues
./.trellis/scripts/issue.sh show <id>                   # Show local details
./.trellis/scripts/issue.sh edit <id> [fields]          # Edit (auto-syncs to GitHub)
./.trellis/scripts/issue.sh close <id> --as completed   # Close (auto-syncs)
./.trellis/scripts/issue.sh sync --all                  # Push all dirty issues
./.trellis/scripts/issue.sh check-dirty --strict        # Pre-commit: ensure all synced
./.trellis/scripts/issue.sh promote <id>                # Issue → Task

# Slash commands
/trellis:finish-work          # Pre-commit checklist
/trellis:break-loop           # Post-debug analysis
/trellis:check-cross-layer    # Cross-layer verification
/qa-loop [scope] [options]    # QA cyclic verification loop (test→fix→retest until 100% pass)
```

---

## Summary

Following this workflow ensures:
- [OK] Continuity across multiple sessions
- [OK] Consistent code quality
- [OK] Trackable progress
- [OK] Knowledge accumulation in spec docs
- [OK] Transparent team collaboration

**Core Philosophy**: Read before write, follow standards, record promptly, capture learnings
