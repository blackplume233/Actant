# Ship - ContextFS Delivery Gate

Use this command only when work is ready to deliver.

This command is the final gate for:

- active-truth review
- spec and design sync review
- verification
- commit
- push
- issue sync

If any blocking gate fails, stop the ship flow first. Do not push partial truth.

Delivery semantics:

- If `ship` runs on `master` or `main`, it may complete the full delivery directly on that branch.
- If `ship` runs on a child branch, its responsibility is only to finish review, verification, commit, and push of that child branch.
- After a child-branch push, return to the main branch context and run `handle-pr` to execute the merge-to-main flow.
- Do not treat "feature branch pushed" as equivalent to "delivered to master/main".

**Timing**: after implementation and verification are complete, before final delivery

---

## Current Baseline

All delivery decisions must follow the current repository baseline:

- product layer: `ContextFS`
- implementation layer: `VFS Kernel`
- core objects: `Project`, `Source`, `Capability`
- V1 built-in sources: `SkillSource`, `McpConfigSource`, `McpRuntimeSource`, `AgentRuntime`
- V1 operation surface: `read`, `write`, `list`, `stat`, `watch`, `stream`

The following are not current truth:

- old `ContextManager`
- old `DomainContext`
- `workflow` as a V1 top-level product object
- query or view mounts in V1
- overlay or fallback behavior in V1
- parallel architecture narratives outside `trash/`

Important:

- `workflow` in `.trellis/workflow.md` means developer process only.
- It does not mean a current product object in ContextFS V1.

---

## Read Before Shipping

Before running this flow, read:

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `.trellis/workflow.md`
4. `.trellis/spec/index.md`
5. `.trellis/spec/terminology.md`
6. `docs/design/contextfs-architecture.md`
7. `docs/design/actant-vfs-reference-architecture.md`
8. `docs/planning/contextfs-roadmap.md`

If the change touches backend behavior, also read:

9. `.trellis/spec/backend/index.md`

---

## Phase 1: Blocking Review

### 1.1 Active-Truth Gate

Check whether the current diff introduces or preserves wrong architecture information outside `trash/`.

Fail this gate if any changed or newly added active document:

- presents `ContextManager` as a current platform core
- presents `DomainContext` as the current aggregation model
- presents `workflow` as a V1 top-level object
- treats `Tool` as a separate top-level system instead of a file-style resource
- collapses `ContextFS` and `VFS Kernel` into one layer
- treats `Project` as a `Source`
- treats `Capability` as permission
- introduces a second "current architecture" narrative

If this gate fails:

- stop shipping immediately
- remove or move stale material to `trash/`
- re-run the review

### 1.2 Terminology Gate

Check naming against `.trellis/spec/terminology.md`.

Required rules:

- `ContextFS` = product model
- `VFS Kernel` = implementation kernel
- `Source` = mounted external resource boundary
- `Provider` = internal supplier or adapter
- `Project` != `Source`
- `Capability` != permission
- `Tool` is not a separate top-level system

If the diff changes naming, confirm the terminology doc is still correct.

### 1.3 Spec and Design Sync Gate

Spec and design sync is mandatory. Ship does not fix these files for you.

Map the diff to the docs that must already be updated:

| Change Type | Required Docs |
|-------------|---------------|
| product model, object roles, resource boundaries | `.trellis/spec/vision.md`, `.trellis/spec/terminology.md`, `docs/design/contextfs-architecture.md` |
| path layout, control nodes, stream nodes, operation surface | `.trellis/spec/api-contracts.md` |
| `ProjectManifest`, mounts, permissions, children | `.trellis/spec/config-spec.md` |
| kernel layering, namespace, mount, middleware, node, backend, events, lifecycle | `docs/design/actant-vfs-reference-architecture.md`, `.trellis/spec/backend/index.md` |
| source scope, V1 source list, milestone scope, non-goals | `docs/planning/contextfs-roadmap.md` |
| repository process or review rules | `.trellis/workflow.md` |

Decision flow:

1. Inspect the changed files.
2. Match them to the table above.
3. Verify that the required docs are already updated in the same delivery set.
4. If any required doc is missing, stop the ship flow.

Required stop message:

```text
Spec/design sync review:
  - <doc-path>: missing update for <reason>

Ship stopped: documentation baseline is not synchronized.
Update the required docs first, then rerun /trellis-ship.
```

### 1.4 Verification Gate

Run the relevant checks:

```bash
pnpm lint
pnpm type-check
pnpm test
```

If a command cannot run because the dependency is not installed, mark it as skipped and explain why.
If a command fails for a real project issue, stop the ship flow.

### 1.5 Pattern Scan

Review the diff for obvious delivery regressions:

- leftover `console.log`
- new `any`
- new non-null assertions
- undocumented path or contract changes
- new active docs outside the baseline reading order

---

## Review Report Format

```text
## Review Report

| Check | Result |
|-------|--------|
| active-truth gate | pass / fail |
| terminology gate | pass / fail |
| spec-design sync | pass / fail |
| pnpm lint | pass / skip / fail |
| pnpm type-check | pass / skip / fail |
| pnpm test | pass / skip / fail |
| console.log scan | pass / fail |
| any scan | pass / fail |
| non-null assertion scan | pass / fail |
```

Do not continue to commit if any blocking item fails.

---

## Phase 2: Inspect the Change Set

Run:

```bash
git status
git diff --stat
git log --oneline -5
```

Confirm:

- the branch and diff are correct
- no sensitive files are staged
- no unintended files are included
- no stale architecture docs outside `trash/` are being reintroduced

---

## Phase 3: Commit

Stage and commit only after Phase 1 and Phase 2 pass.

```bash
git add -A
git commit -m "<type>: <description>"
```

Commit rules:

- use English commit messages
- use Conventional Commits
- explain the change intent, not a file list
- do not commit secrets such as `.env` or credential files
- do not use `--no-verify`

After commit:

```bash
git status
```

---

## Phase 4: Push

Push the current branch normally:

```bash
git push origin <current-branch>
```

Never force push unless the human explicitly asks for it.

Branch-aware rule:

- If `<current-branch>` is `master` or `main`, continue to Phase 5 directly.
- If `<current-branch>` is not `master` or `main`, stop after the push and record that the next required action is to switch to the main branch workflow and run `handle-pr`.
- In that case, `ship` is only complete for the child-branch delivery stage. Main-branch delivery is completed by `handle-pr`, not by the child-branch `ship` itself.

Required handoff note for child-branch push:

```text
Child branch push completed: <current-branch>
Next step: switch to master/main context and run /handle-pr to validate and merge the branch into the main line.
```

---

## Phase 5: Issue Sync

After push, inspect whether the delivery references any issue.

Possible sources:

1. commit message references such as `#123`
2. changed files under `.trellis/issues/`
3. code or docs that explicitly reference an issue number

Use `gh` directly when available:

```bash
gh issue view <N> --json state
gh issue comment <N> -b "Progress: addressed in <commit-hash>."
gh issue close <N> -c "Completed in <commit-hash>."
```

Rules:

- closing is appropriate for a real fix that resolves the issue
- commenting is appropriate for docs, refactor, or partial progress
- if the GitHub issue is already closed, do not repeat the action

If `gh` is unavailable, mark the step as skipped and note the manual follow-up.

---

## Issue Sync Report Format

```text
## Issue Sync Report

| Issue | Action | Result |
|-------|--------|--------|
| #123 | comment | pass |
| #124 | close | pass |
```

---

## Final Summary Format

```text
## Delivery Summary

- commit: <hash> <message>
- branch: <branch> -> origin/<branch>
- change summary: <files changed>, +<insertions>, -<deletions>
- issue sync: <summary>
```

---

## Safety Rules

- never use `git push --force` unless explicitly requested
- never commit secrets
- never bypass hooks with `--no-verify`
- never treat unsynced docs as acceptable for later cleanup
- never keep competing architecture truth outside `trash/`

---

## Relationship to Other Commands

| Command | Role |
|---------|------|
| `/trellis-finish-work` | pre-ship review checklist |
| `/trellis-update-spec` | updates active spec and design docs before shipping |
| `/trellis-record-session` | records delivered work after commit |

Recommended flow:

```text
implement -> verify -> /trellis-finish-work -> /trellis-ship -> /trellis-record-session
```
