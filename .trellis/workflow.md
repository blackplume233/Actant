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

> **Multi-developer support**: Each developer/Agent needs to initialize their identity first

```bash
# Check if already initialized
./.trellis/scripts/get-developer.sh

# If not initialized, run:
./.trellis/scripts/init-developer.sh <your-name>
# Example: ./.trellis/scripts/init-developer.sh cursor-agent
```

This creates:
- `.trellis/.developer` - Your identity file (gitignored, not committed)
- `.trellis/workspace/<your-name>/` - Your personal workspace directory

**Naming suggestions**:
- Human developers: Use your name, e.g., `john-doe`
- Cursor AI: `cursor-agent` or `cursor-<task>`
- Claude Code: `claude-agent` or `claude-<task>`

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
|   \-- {NNNN}-{slug}.json  # Individual issue files
|-- roadmap.md           # Product roadmap — 当前/后续优先级，与 Issues/Tasks 对齐
|-- spec/                # [!] MUST READ before coding
|   |-- frontend/        # Frontend guidelines (if applicable)
|   |   |-- index.md               # Start here - guidelines index
|   |   \-- *.md                   # Topic-specific docs
|   |-- backend/         # Backend guidelines (if applicable)
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

See `.trellis/roadmap.md` for structure and maintenance notes.

### 5. Issues - Backlog Tracking

Issues are lightweight JSON files for tracking ideas, bugs, design proposals, and improvements.

```
issues/
|-- .counter                 # Auto-increment ID
|-- 0001-add-memory-layer.json
|-- 0002-fix-socket-timeout.json
\-- 0003-improve-cli-output.json
```

**Issue vs Task**:

| Concept | Issue | Task |
|---------|-------|------|
| Purpose | Backlog — what needs doing | Active work — what's being done now |
| Lifecycle | open → (promote) → in-progress → closed | planning → in_progress → review → completed |
| Storage | Single JSON file per issue | Directory with task.json, prd.md, jsonl contexts |
| Transition | `issue.sh promote <id>` creates a Task | `task.sh archive <name>` archives completed Task |

**Workflow**: Issue (idea) → **promote** → Task (active work) → **archive** → Done

**Commands**:
```bash
./.trellis/scripts/issue.sh create "<title>" --feature --priority P1 --milestone mid-term
./.trellis/scripts/issue.sh create "Bug title" --bug --priority P0 --label core
./.trellis/scripts/issue.sh create "Design question" --discussion --body "Should we..."
./.trellis/scripts/issue.sh list [--milestone mid-term] [--priority P1] [--rfc]
./.trellis/scripts/issue.sh show <id>
./.trellis/scripts/issue.sh edit <id> --assign cursor-agent --milestone mid-term
./.trellis/scripts/issue.sh label <id> --add rfc --remove question
./.trellis/scripts/issue.sh comment <id> "Design doc completed"
./.trellis/scripts/issue.sh close <id> --as completed
./.trellis/scripts/issue.sh close <id> --as duplicate --ref 3
./.trellis/scripts/issue.sh close <id> --as not-planned --reason "Out of scope"
./.trellis/scripts/issue.sh promote <id>       # → Creates Task from Issue
./.trellis/scripts/issue.sh search "memory"
./.trellis/scripts/issue.sh stats
```

**Status**: `open` / `closed` (binary, like GitHub)
**Close reasons**: `completed` / `not-planned` / `duplicate`
**Labels** (convention, not enforced):
- Type: `bug` `feature` `enhancement` `question` `discussion` `rfc` `chore` `docs`
- Priority: `priority:P0` `priority:P1` `priority:P2` `priority:P3`
- Area: `core` `cli` `api` `mcp` `shared` `acp`
- Meta: `duplicate` `wontfix` `blocked` `good-first-issue`
**Milestones**: `near-term` | `mid-term` | `long-term`

### 6. GitHub Sync (via MCP)

Local issues can sync with GitHub Issues when a GitHub MCP server is available (e.g., `@modelcontextprotocol/server-github`).

**Architecture**: The AI Agent acts as orchestrator — `issue.sh` prepares/receives data, the Agent calls MCP tools for actual GitHub API communication.

```
┌─────────────┐     export     ┌───────────┐   mcp__github__   ┌──────────┐
│ Local Issue  │ ──────────────→│  AI Agent  │ ────────────────→ │  GitHub  │
│ (.json file) │ ←──────────────│ (MCP Hub)  │ ←──────────────── │  Issues  │
└─────────────┘  import-github └───────────┘   create/get/...  └──────────┘
```

**Push to GitHub** (local → remote):
```bash
# 1. Export local issue as MCP-ready JSON
./.trellis/scripts/issue.sh export <id> --owner <org> --repo <repo>
# 2. AI Agent calls mcp__github__create_issue with the exported JSON
# 3. Link local issue to the newly created GitHub issue
./.trellis/scripts/issue.sh link <id> --github <org>/<repo>#<number>
# 4. Later, push updates
./.trellis/scripts/issue.sh export <id> --update
# AI Agent calls mcp__github__update_issue with the JSON
```

**Pull from GitHub** (remote → local):
```bash
# 1. AI Agent calls mcp__github__get_issue to fetch GitHub issue data
# 2. Pipe the JSON into import-github
echo '<mcp_response_json>' | ./.trellis/scripts/issue.sh import-github
# Duplicate detection: if owner/repo#number already imported, skips and returns existing ID
```

**Manual Linking**:
```bash
# Link local issue to existing GitHub issue
./.trellis/scripts/issue.sh link <id> --github owner/repo#number
# Or with explicit params
./.trellis/scripts/issue.sh link <id> --owner <o> --repo <r> --number <n>
# Remove link
./.trellis/scripts/issue.sh unlink <id>
```

**MCP Tools Used** (from `@modelcontextprotocol/server-github`):

| Tool | Usage |
|------|-------|
| `mcp__github__create_issue` | Push new issue to GitHub |
| `mcp__github__update_issue` | Update existing linked issue |
| `mcp__github__get_issue` | Pull single issue from GitHub |
| `mcp__github__list_issues` | Pull multiple issues from GitHub |
| `mcp__github__search_issues` | Search GitHub issues |
| `mcp__github__add_issue_comment` | Sync comments |

**`githubRef` Field** (stored in issue JSON):
```json
{
  "githubRef": {
    "owner": "myorg",
    "repo": "myrepo",
    "number": 42,
    "url": "https://github.com/myorg/myrepo/issues/42",
    "syncedAt": "2026-02-20T10:30:00"
  }
}
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

# Issue management (backlog, discussions, ideas — GitHub-style)
./.trellis/scripts/issue.sh create "<title>" [options]  # Create issue
./.trellis/scripts/issue.sh list [filters]              # List open issues
./.trellis/scripts/issue.sh show <id>                   # Show details + body + comments
./.trellis/scripts/issue.sh edit <id> [fields]          # Edit fields
./.trellis/scripts/issue.sh label <id> --add/--remove   # Manage labels
./.trellis/scripts/issue.sh comment <id> "<text>"       # Add to discussion
./.trellis/scripts/issue.sh close <id> --as <reason>    # Close (completed/not-planned/duplicate)
./.trellis/scripts/issue.sh promote <id>                # Issue → Task
./.trellis/scripts/issue.sh search "<query>"            # Full-text search
./.trellis/scripts/issue.sh stats                       # Statistics
./.trellis/scripts/issue.sh export <id> [--owner/--repo] # Export for MCP push
./.trellis/scripts/issue.sh import-github               # Import from MCP pull (stdin)
./.trellis/scripts/issue.sh link <id> --github o/r#n    # Link to GitHub issue
./.trellis/scripts/issue.sh unlink <id>                 # Remove GitHub link

# Slash commands
/trellis:finish-work          # Pre-commit checklist
/trellis:break-loop           # Post-debug analysis
/trellis:check-cross-layer    # Cross-layer verification
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
