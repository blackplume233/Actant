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
- Do not mark ship complete until the final local repository context is back on `master` or `main`.

**Timing**: after implementation and verification are complete, before final delivery

---

## Current Baseline

All delivery decisions must follow the current repository baseline:

- product layer: `ContextFS`
- implementation layer: `VFS`
- core objects: `mount namespace`, `mount table`, `filesystem type`, `mount instance`, `node type`
- V1 mount types: `root`, `direct`
- V1 filesystem types: `hostfs`, `runtimefs`, `memfs`
- V1 node types: `directory`, `regular`, `control`, `stream`
- V1 operation surface: `read`, `write`, `list`, `stat`, `watch`, `stream`

The following are not current truth:

- old `ContextManager`
- old `DomainContext`
- `workflow` as a V1 top-level product object
- query or view mounts in V1
- overlay or fallback behavior in V1
- parallel architecture narratives outside archive/evidence surfaces

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
8. `docs/planning/roadmap.md`
9. `docs/planning/workspace-normalization-todo.md`

If the change touches backend behavior, also read:

10. `.trellis/spec/backend/index.md`

---

## Phase 1: Blocking Review

### 1.1 Active-Truth Gate

Check whether the current diff introduces or preserves wrong architecture information outside the archive/evidence surfaces.

Fail this gate if any changed or newly added active document:

- presents `ContextManager` as a current platform core
- presents `DomainContext` as the current aggregation model
- presents `workflow` as a V1 top-level object
- presents `Prompt` as a V1 top-level object instead of consumer interpretation
- treats `Tool` as a separate top-level system instead of a file-style resource
- collapses `ContextFS` and `VFS` into one layer
- treats `SourceType` / `Source` / `Trait` as the current V1 object model
- treats `Capability` as permission
- treats `control` / `stream` as capability bundles instead of `node type`
- introduces a second "current architecture" narrative

If this gate fails:

- stop shipping immediately
- archive stale docs to `docs/history/` or move deleted residue to `trash/`
- re-run the review

### 1.2 Terminology Gate

Check naming against `.trellis/spec/terminology.md`.

Required rules:

- `ContextFS` = product model
- `VFS` = implementation kernel
- `mount instance` = mounted external resource boundary
- `filesystem type` = implementation family, not business classification
- `Provider` = internal supplier or adapter
- `mount namespace` / `mount table` / `node type` are current core terms
- `Capability` != permission
- `Prompt` is not a V1 top-level object
- `Tool` is not a separate top-level system

If the diff changes naming, confirm the terminology doc is still correct.

### 1.3 Spec and Design Sync Gate

Spec and design sync is mandatory. Ship does not fix these files for you.

Map the diff to the docs that must already be updated:

| Change Type | Required Docs |
|-------------|---------------|
| product model, object roles, interpretation boundary | `.trellis/spec/vision.md`, `.trellis/spec/terminology.md`, `docs/design/contextfs-architecture.md` |
| path layout, control nodes, stream nodes, output fields, operation surface | `.trellis/spec/api-contracts.md` |
| `actant.namespace.json`, mount table, mount types, compatibility config entrypoints | `.trellis/spec/config-spec.md` |
| kernel layering, namespace, mount, middleware, node, backend, events, lifecycle | `docs/design/actant-vfs-reference-architecture.md`, `.trellis/spec/backend/index.md` |
| repo-level scope, current phase, planning rules | `docs/planning/roadmap.md` |
| cleanup backlog, doc closure, workspace governance tasks | `docs/planning/workspace-normalization-todo.md` |
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
- no stale architecture docs outside archive/evidence surfaces are being reintroduced

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
- Full delivery is complete only after:
  1. the change is merged into `master`/`main`
  2. the merged main branch is pushed
  3. the final local repository context is back on `master`/`main`

Required handoff note for child-branch push:

```text
Child branch push completed: <current-branch>
Next step: switch to master/main context and run /handle-pr to validate and merge the branch into the main line.
Ship is not complete until local context has returned to master/main after the merge flow.
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
- never keep competing architecture truth outside archive/evidence surfaces
- never leave the repository in a child-branch context and call ship "complete"

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
