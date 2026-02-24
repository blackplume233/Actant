# Plan & Start Session

Enhanced version of `trellis-start` — adds a **Plan Phase** before execution.
First builds a structured plan document for user review, then executes confirmed tasks through the standard trellis workflow.

---

## Operation Types

| Marker | Meaning | Executor |
|--------|---------|----------|
| `[AI]` | Bash scripts or file reads executed by AI | You (AI) |
| `[USER]` | Decisions or slash commands by user | User |
| `[COLLAB]` | AI proposes, user confirms/adjusts | Both |

---

## Phase 0: Initialization `[AI]`

Same as `/trellis-start`:

### Step 0.1: Understand Trellis Workflow

```bash
cat .trellis/workflow.md
```

### Step 0.2: Initialize Developer Identity (Actant Agent)

Ensure your Actant Agent identity is initialized. Check if already set, if not, initialize:

```bash
./.trellis/scripts/get-developer.sh || ./.trellis/scripts/init-developer.sh cursor-agent
```

> **Actant Agent 身份**: AI 开发者是一个 Actant Agent 实例。Cursor AI 使用 `cursor-agent` 作为身份标识。

### Step 0.3: Get Current Status

```bash
./.trellis/scripts/get-context.sh
```

### Step 0.4: Read Project Guidelines

Read relevant spec docs based on context:

```bash
cat .trellis/spec/frontend/index.md
cat .trellis/spec/backend/index.md
cat .trellis/spec/guides/index.md
```

### Step 0.5: Check Active Tasks

```bash
./.trellis/scripts/task.sh list
```

### Step 0.6: Report Ready Status

Output initialization summary (same as trellis-start), then:

> Initialization complete. Please describe your task — I'll create a plan for us to review before starting.

---

## Phase 1: Plan Construction `[COLLAB]`

### Step 1.1: Gather Requirements `[AI]`

When user describes their task:

1. Ask **clarifying questions** if the scope is unclear
2. Classify the task type (frontend / backend / fullstack / docs / infra)
3. Identify affected areas of the codebase

### Step 1.2: Research Codebase `[AI]`

Perform deep analysis:

1. Search for relevant spec files in `.trellis/spec/`
2. Find existing code patterns (2-3 representative examples)
3. Identify files that need modification
4. Identify potential risks and dependencies

### Step 1.3: Generate Plan Document `[AI]`

Create a plan file at: `c:\Users\{user}\.cursor\plans\{slug}_{hash}.plan.md`

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
  # ... more todos
isProject: false
---

# <Plan Title>

<Brief context paragraph explaining the goal and scope>

---

## 一、背景分析

<Why this task is needed, what problem it solves>

## 二、方案设计

<Technical approach, architecture decisions, alternatives considered>

## 三、实施计划

### Phase 1: <Phase Name>

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 1 | <task> | P0 | - | <effort> |
| 2 | <task> | P1 | #1 | <effort> |

### Phase 2: <Phase Name>

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 3 | <task> | P1 | Phase 1 | <effort> |

## 四、影响范围

### Files to Modify
- `<path>`: <what changes>

### New Files
- `<path>`: <purpose>

### Risk Assessment
- <risk 1>: <mitigation>
- <risk 2>: <mitigation>

## 五、验收标准

- [ ] <Criterion 1>
- [ ] <Criterion 2>

## 六、相关参考

- <spec/code/doc references>
```

**Plan Document Rules:**

- **Todos in frontmatter** must map 1:1 to actionable implementation steps
- **Priority levels**: P0 (must-have), P1 (important), P2 (nice-to-have)
- **Status values**: `pending`, `in_progress`, `completed`
- **Dependencies** must be explicit — no circular references
- Keep the plan **concise but complete** — the user should be able to understand the full scope at a glance

### Step 1.4: Present Plan to User `[COLLAB]`

Output the plan and ask:

```markdown
## 📋 Plan Ready for Review

I've created the plan document: `<plan-file-path>`

### Summary
- **Total tasks**: {count}
- **P0 (must-have)**: {count}
- **P1 (important)**: {count}
- **P2 (nice-to-have)**: {count}
- **Estimated scope**: {files} files, {phases} phases

### Key Decisions
1. <decision 1 — why this approach>
2. <decision 2 — trade-off made>

---

Please review the plan. You can:
- **Approve**: "LGTM" or "approved" to start execution
- **Adjust**: Tell me what to change (add/remove/reorder tasks, change priorities)
- **Reject**: "reject" to start over with different requirements
```

### Step 1.5: Iterate on Plan `[COLLAB]`

If user requests changes:

1. Update the plan document with requested modifications
2. Re-present the updated summary
3. Repeat until user approves

**Important**: Do NOT proceed to Phase 2 until the user explicitly approves.

---

## Phase 2: Execute Plan `[AI]`

Once the user approves the plan, execute using the standard trellis task workflow.

### Step 2.1: Create Task from Plan `[AI]`

```bash
TASK_DIR=$(./.trellis/scripts/task.sh create "<plan title>" --slug <plan-slug>)
```

### Step 2.2: Configure Context `[AI]`

Initialize context based on task type identified in the plan:

```bash
./.trellis/scripts/task.sh init-context "$TASK_DIR" <type>
# type: backend | frontend | fullstack
```

Add specs discovered during research:

```bash
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
<From plan body - section 二>

## Acceptance Criteria
<From plan body - section 五>

## Implementation Plan
<From plan body - section 三, include todo references>

## Technical Notes
<From plan body - section 二 technical approach>
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
3. **Run quality checks** after each significant todo:
   ```bash
   # Lint + typecheck
   pnpm lint
   pnpm typecheck
   ```
4. **Update todo status** to `completed` in the plan file
5. **Report progress** to user:
   ```
   ✓ Completed: <todo content>
   Progress: {completed}/{total} tasks
   ```

### Step 2.6: Final Quality Check `[AI]`

After all todos are completed:

1. Run full lint and typecheck
2. Run incremental tests (`pnpm test:changed`)
3. Verify all acceptance criteria from the plan

### Step 2.7: Complete `[AI]`

1. Update all todo statuses to `completed` in the plan file
2. Report final summary:

```markdown
## Plan Execution Complete

| Metric | Value |
|--------|-------|
| Tasks Completed | {completed}/{total} |
| Files Modified | {count} |
| Tests Passing | Yes/No |
| Lint Clean | Yes/No |

### What Was Done
- <summary of changes>

### Remaining (if any)
- <deferred P2 items>
```

3. Remind user to:
   - Test the changes
   - Commit when ready
   - Run `/trellis-record-session`

---

## Continuing a Plan

If user returns and mentions an existing plan:

1. Read the plan file to check todo statuses
2. Identify next `pending` todo
3. Ask: "Continue from <next-todo>?"
4. If yes, resume from Step 2.5 at the appropriate todo

---

## Commands Reference

### User Commands `[USER]`

| Command | Description |
|---------|-------------|
| `/trellis-plan-start` | Plan-first session (this command) |
| `/trellis-start` | Quick start without planning |
| `/trellis-finish-work` | Pre-commit checklist |
| `/trellis-record-session` | Record session progress |

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

---

## When to Use This vs `/trellis-start`

| Scenario | Recommended Command |
|----------|-------------------|
| Quick bug fix, typo, small change | `/trellis-start` |
| New feature with unclear scope | `/trellis-plan-start` |
| Multi-phase refactoring | `/trellis-plan-start` |
| Cross-layer changes (frontend + backend) | `/trellis-plan-start` |
| Exploratory task (need to research first) | `/trellis-plan-start` |
| Continuing from a previous plan | `/trellis-plan-start` |

---

## Key Principles

> **Plan before you build.**
>
> The plan document is a contract between AI and user.
> No implementation starts until the plan is approved.
> Every todo in the plan maps to a concrete deliverable.
