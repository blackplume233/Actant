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

## Documentation Hygiene

Main entry docs should describe only the current baseline.  
If historical explanation is needed, put it in `docs/history/legacy-architecture-transition.md` or `trash/`, not in the default read path.

## Working Rule

When a change affects:

- object model
- path layout
- operation surface
- permissions
- lifecycle

update the relevant spec/design/roadmap docs before changing implementation.
