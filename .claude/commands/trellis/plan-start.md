# Plan & Start Session

Enhanced version of `trellis:start` — adds a **Plan Phase** before execution.
First builds a structured plan document for user review, then executes confirmed tasks through the standard trellis workflow.

---

## Operation Types

| Marker | Meaning | Executor |
|--------|---------|----------|
| `[AI]` | Bash scripts or Task calls executed by AI | You (AI) |
| `[USER]` | Decisions or slash commands by user | User |
| `[COLLAB]` | AI proposes, user confirms/adjusts | Both |

---

## Phase 0: Initialization `[AI]`

Same as `/trellis:start`:

### Step 0.1: Understand Development Workflow

```bash
cat .trellis/workflow.md
```

**Follow the instructions in workflow.md** — it contains core principles, file system structure, and best practices.

### Step 0.2: Get Current Context

```bash
./.trellis/scripts/get-context.sh
```

This shows: developer identity, git status, current task (if any), active tasks.

### Step 0.3: Read Guidelines Index

```bash
cat .trellis/spec/frontend/index.md
cat .trellis/spec/backend/index.md
cat .trellis/spec/guides/index.md
```

### Step 0.4: Report Ready Status

Report what you learned, then:

> Initialization complete. Please describe your task — I'll create a plan for us to review before starting.

---

## Phase 1: Plan Construction `[COLLAB]`

### Step 1.1: Gather Requirements `[AI]`

When user describes their task:

1. Ask **clarifying questions** if the scope is unclear
2. Classify the task type (frontend / backend / fullstack / docs / infra)
3. Identify affected areas of the codebase

### Step 1.2: Research Codebase `[AI]`

Call Research Agent:

```
Task(
  subagent_type: "research",
  prompt: "Analyze the codebase for this task:

  Task: <user's task description>
  Type: <frontend/backend/fullstack>

  Please find:
  1. Relevant spec files in .trellis/spec/
  2. Existing code patterns to follow (2-3 examples)
  3. Files that will need modification
  4. Potential risks and dependencies
  5. Suggested task slug name

  Output:
  ## Relevant Specs
  - <path>: <why relevant>

  ## Code Patterns Found
  - <pattern>: <example file>

  ## Files to Modify
  - <path>: <what change>

  ## Risks
  - <risk>: <mitigation>

  ## Suggested Task Name
  - <slug>",
  model: "opus"
)
```

### Step 1.3: Generate Plan Document `[AI]`

Create a plan file at the Cursor plans directory.

The plan document uses the following format:

```markdown
---
name: <Plan Title>
overview: <One-line description of what this plan achieves>
todos:
  - id: <kebab-case-id>
    content: "<Priority>: <Task description>"
    status: pending
  - id: <kebab-case-id>
    content: "<Priority>: <Task description>"
    status: pending
isProject: false
---

# <Plan Title>

<Brief context paragraph>

---

## 一、背景分析

<Why this task is needed>

## 二、方案设计

<Technical approach, architecture decisions>

## 三、实施计划

### Phase 1: <Phase Name>

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 1 | <task> | P0 | - | <effort> |

### Phase 2: <Phase Name>

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 2 | <task> | P1 | Phase 1 | <effort> |

## 四、影响范围

### Files to Modify
- `<path>`: <what changes>

### New Files
- `<path>`: <purpose>

### Risk Assessment
- <risk>: <mitigation>

## 五、验收标准

- [ ] <Criterion 1>
- [ ] <Criterion 2>

## 六、相关参考

- <spec/code/doc references>
```

**Plan Document Rules:**

- **Todos in frontmatter** map 1:1 to actionable implementation steps
- **Priority levels**: P0 (must-have), P1 (important), P2 (nice-to-have)
- **Status values**: `pending`, `in_progress`, `completed`
- **Dependencies** must be explicit — no circular references

### Step 1.4: Present Plan to User `[COLLAB]`

Output the plan summary and ask user to review:

- **Approve**: "LGTM" or "approved" to start execution
- **Adjust**: Tell me what to change
- **Reject**: "reject" to start over

### Step 1.5: Iterate on Plan `[COLLAB]`

If user requests changes, update plan and re-present.

**Important**: Do NOT proceed to Phase 2 until user explicitly approves.

---

## Phase 2: Execute Plan `[AI]`

Once the user approves, execute using the standard trellis task workflow.

### Step 2.1: Create Task from Plan `[AI]`

```bash
TASK_DIR=$(./.trellis/scripts/task.sh create "<plan title>" --slug <plan-slug>)
```

### Step 2.2: Configure Context `[AI]`

```bash
./.trellis/scripts/task.sh init-context "$TASK_DIR" <type>

# Add specs found during research:
./.trellis/scripts/task.sh add-context "$TASK_DIR" implement "<path>" "<reason>"
./.trellis/scripts/task.sh add-context "$TASK_DIR" check "<path>" "<reason>"
```

### Step 2.3: Write PRD from Plan `[AI]`

Convert the approved plan into `prd.md` in the task directory:

```markdown
# <Plan Title>

## Goal
<From plan overview>

## Requirements
<From plan - section 二>

## Acceptance Criteria
<From plan - section 五>

## Implementation Plan
<From plan - section 三>

## Technical Notes
<From plan - section 二 technical approach>
```

### Step 2.4: Activate Task `[AI]`

```bash
./.trellis/scripts/task.sh start "$TASK_DIR"
```

### Step 2.5: Execute Todos Sequentially `[AI]`

For each todo in the plan (ordered by priority, respecting dependencies):

1. **Update todo status** to `in_progress` in the plan file
2. **Implement** the todo item:
   - For code tasks → call Implement Agent with specific scope
   - For config tasks → make changes directly
   - For doc tasks → write documentation
3. **Run quality checks** after each significant todo
4. **Update todo status** to `completed` in the plan file
5. **Report progress** to user

Implementation via sub-agents (specs auto-injected by hook):

```
Task(
  subagent_type: "implement",
  prompt: "Implement this specific todo:

  Todo: <todo content>
  Context: <relevant plan sections>

  Follow all specs injected into your context.
  Run lint and typecheck before finishing.",
  model: "opus"
)
```

Quality verification via sub-agents:

```
Task(
  subagent_type: "check",
  prompt: "Review code changes for this todo:

  Todo: <todo content>

  Fix any issues found directly.
  Ensure lint and typecheck pass.",
  model: "opus"
)
```

### Step 2.6: Final Quality Check `[AI]`

After all todos completed:

1. Run full lint and typecheck
2. Run incremental tests (`pnpm test:changed`)
3. Verify all acceptance criteria from the plan

### Step 2.7: Complete `[AI]`

1. Update all todo statuses in plan file
2. Report final summary (tasks completed, files modified, test/lint status)
3. Remind user to:
   - Test the changes
   - Commit when ready
   - Run `/trellis:record-session`

---

## Continuing a Plan

If user returns with an existing plan:

1. Read the plan file to check todo statuses
2. Identify next `pending` todo
3. Ask: "Continue from <next-todo>?"
4. If yes, resume from Step 2.5 at the appropriate todo

---

## Commands Reference

### User Commands `[USER]`

| Command | When to Use |
|---------|-------------|
| `/trellis:plan-start` | Plan-first session (this command) |
| `/trellis:start` | Quick start without planning |
| `/trellis:finish-work` | Before committing changes |
| `/trellis:record-session` | After completing a task |

### AI Scripts `[AI]`

| Script | Purpose |
|--------|---------|
| `get-context.sh` | Get session context |
| `task.sh create` | Create task directory |
| `task.sh init-context` | Initialize jsonl files |
| `task.sh add-context` | Add spec to jsonl |
| `task.sh start` | Set current task |
| `task.sh finish` | Clear current task |
| `task.sh archive` | Archive completed task |

### Sub Agents `[AI]`

| Agent | Purpose | Hook Injection |
|-------|---------|----------------|
| research | Analyze codebase for plan | No |
| implement | Write code per todo | Yes (implement.jsonl) |
| check | Review & fix per todo | Yes (check.jsonl) |
| debug | Fix specific issues | Yes (debug.jsonl) |

---

## When to Use This vs `/trellis:start`

| Scenario | Command |
|----------|---------|
| Quick bug fix, typo, small change | `/trellis:start` |
| New feature with unclear scope | `/trellis:plan-start` |
| Multi-phase refactoring | `/trellis:plan-start` |
| Cross-layer changes (frontend + backend) | `/trellis:plan-start` |
| Exploratory task (research first) | `/trellis:plan-start` |
| Continuing from a previous plan | `/trellis:plan-start` |

---

## Key Principles

> **Plan before you build.**
>
> The plan document is a contract between AI and user.
> No implementation starts until the plan is approved.
> Every todo in the plan maps to a concrete deliverable.
