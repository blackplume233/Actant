# Legacy Architecture Transition Notes

This document exists for migration, cleanup, and historical comparison only.  
Do not treat it as part of the default entry path for current development.

## When To Read This

Read this document only when you need to:

- understand a residual legacy term in code or docs
- clean up stale references outside `trash/`
- map an old contract or concept to the current ContextFS baseline
- review why a historical design should not be revived

For normal work, start from:

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `.trellis/spec/index.md`
4. `docs/design/contextfs-architecture.md`
5. `docs/design/actant-vfs-reference-architecture.md`
6. `docs/planning/contextfs-roadmap.md`

## Purpose Of The Reset

Actant is converging on a single active baseline:

- Product layer: `ContextFS`
- Implementation layer: `VFS Kernel`
- Core objects: `Project`, `Source`, `Capability`
- V1 operations: `read`, `write`, `list`, `stat`, `watch`, `stream`

This file records legacy terms so they do not need to stay in the main entry docs.

## Legacy Terms

The following terms may still appear in old notes, code, or deleted/trash material:

- `ContextManager`
- `DomainContext`
- `ContextSourceType`
- source-centric VFS routing
- tool registry as a top-level system
- `workflow` as a V1 top-level object

They are not part of the active baseline.

## Handling Residual References

If you encounter a residual reference:

1. Confirm whether it is still active code, dead documentation, or a migration note.
2. Prefer rewriting it into current ContextFS/VFS Kernel terminology.
3. If it must remain for migration clarity, keep it in this document or in `trash/`, not in the default read path.

## Storage Rule

- Main entry docs should describe only the active baseline.
- Historical or migration-oriented explanation belongs here or in `trash/`.
- Git history remains the source of truth for removed architecture narratives.
