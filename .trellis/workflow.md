# Development Workflow

> Current workflow baseline for this repository.  
> If any other guide conflicts with this file, `README.md`, `PROJECT_CONTEXT.md`, or `.trellis/spec/index.md`, the ContextFS baseline wins.

## Read First

Before making architecture or implementation changes, read:

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `.trellis/spec/index.md`
4. `docs/design/contextfs-architecture.md`
5. `docs/design/actant-vfs-reference-architecture.md`
6. `docs/planning/contextfs-roadmap.md`

If you are changing backend implementation details, also read:

7. `.trellis/spec/backend/index.md`

If you are touching user-facing UI or site content, do not assume older frontend docs are current.  
Treat UI work as secondary to the ContextFS baseline unless a newer UI spec exists.

## Core Rule

```text
spec / design / roadmap -> contract -> implementation -> verification
```

Current repository policy:

- document first
- one active architecture narrative only
- no compatibility-first route
- keep migration notes outside the main entry path
- a ship is only complete when the local repository context is back on `master`/`main`
- every ship / merge delivery must preserve a changelog draft before release aggregation
- active roadmap files under `docs/planning/` must use checklist / todolist structure
- project progress status must be atomically maintained in one active file only: `docs/planning/contextfs-roadmap.md`
- deprecated terms must not leak into active truth; `bootstrap` is banned from active docs and user-facing delivery language except for explicit historical or compatibility notes

## Session Start

Use the repository scripts for context gathering:

```bash
./.trellis/scripts/get-developer.sh
./.trellis/scripts/get-context.sh
./.trellis/scripts/task.sh list
git status
```

## Impact Analysis

Before changing a core module, run impact analysis first.  
If the code graph is stale, refresh it with:

```bash
npx gitnexus analyze
```

## Current Scope Guard

Do not expand beyond the current ContextFS baseline:

- `workflow` as a V1 top-level object
- query/view mounts in V1
- overlay/fallback behavior in V1
- any second default narrative alongside spec/design/roadmap

## Change Impact Review

Every change must be classified by its impact level before implementation starts.
See [Change Impact Protocol](../docs/design/actant-vfs-reference-architecture.md#9-change-impact-protocol) for the full decision tree and layer definitions.

Summary of review gates:

- **L3 (Source)**: normal review
- **L2 (Orchestration)**: check Project/Mount semantic impact
- **L1 (Infrastructure)**: justify why the change cannot be done in L2/L3
- **L0 (Kernel)**: prove that the abstraction boundary must change; update spec first
- **L4 (Types)**: backward compatibility review + sync api-contracts

Commit messages and PR descriptions should include the impact level prefix: `[L0]`–`[L4]`.

Anti-pattern checklist for reviewers:

1. Does this change add code to the Kernel core without removing equivalent duplication?
2. Does the change introduce a new discriminated union or switch-case dispatch?
3. Does a new capability require every existing Source to change?
4. Does the package dependency graph become deeper or introduce new cycles?
5. Does the total L0 line count exceed the 780-line budget?

## Documentation Hygiene

Main entry docs should describe only the current baseline.  
If historical explanation is needed, keep it outside the default read path, such as under `docs/history/` or `trash/`.

## Changelog Draft Rule

Changelog uses a two-step model: `先草稿后汇总`.

- Every ship / merge level delivery must have a valid draft under `docs/agent/changelog-drafts/`
- Child-branch development does not need to update `docs/stage/<version>/changelog.md` on every commit
- `create-pr` / ship level delivery must fail if the matching changelog draft is missing or malformed
- Release aggregation still happens in `docs/stage/<version>/changelog.md`

Required draft contract:

- Filename: `YYYY-MM-DD-<agent>-<topic>.md`
- Required sections:
  - title (`# ...`)
  - `## 变更摘要`
  - `## 用户可见影响`
  - `## 破坏性变更/迁移说明`
  - `## 验证结果`
  - `## 关联 PR / Commit / Issue`

`/trellis-record-session` should record the same delivery facts: what changed, how it was verified, and which PR / commit / issue it relates to.

## Roadmap Rule

`docs/planning/` is the active planning truth source and must stay executable.

- Active roadmap files must use explicit checklist / todolist structure
- Milestones and phases must express status with todo markers, not long narrative status paragraphs
- Historical reviews and analysis belong in `docs/history/` or `docs/agent/`, not in active roadmap files
- If roadmap state says a milestone is done, corresponding active tasks must be completed or archived
- Progress annotations must have a single atomic truth file. For this repo, only `docs/planning/contextfs-roadmap.md` may carry live milestone progress status.
- Other planning entry docs may link, explain scope, or define rules, but must not duplicate live progress checkboxes for the same milestones.

## Working Rule

When a change affects:

- object model
- path layout
- operation surface
- permissions
- lifecycle

update the relevant spec/design/roadmap docs before changing implementation.

## Verification Baseline

Repository verification should prefer current workspace source over stale build artifacts.

- Run repository checks from the workspace root:
  - `pnpm lint`
  - `pnpm type-check`
  - `pnpm test`
- Treat pre-existing `dist/` output as cache, not as active truth for local verification.
- When CLI or package-level tests can run against workspace source, prefer that path over relying on previously built package output.
- Keep historical, generated, or archived material such as `trash/` out of the default verification surface unless the task specifically targets it.

## Delivery Completion

Treat child-branch push as an intermediate state, not the end of delivery.

- If work is developed on a child branch, push that branch first.
- Then run the main-branch merge flow (for this repo, `handle-pr`).
- Before create-pr / merge / ship, ensure the matching changelog draft already exists and passes validation.
- Delivery is only complete after the merge is pushed to `master`/`main`.
- The final local repository context must also be back on `master`/`main`.

If returning the canonical local repository context to `master`/`main` would overwrite unrelated local work, stop and report the blocking local state instead of claiming ship is complete.
