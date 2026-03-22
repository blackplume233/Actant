# Finish Work - Pre-Commit Checklist

Before submitting or committing, use this checklist to ensure work completeness.

**Timing**: After code is written and tested, before commit

---

## Checklist

### 1. Code Quality

```bash
# Must pass
pnpm lint
pnpm type-check
pnpm test
```

- [ ] `pnpm lint` passes with 0 errors?
- [ ] `pnpm type-check` passes with no type errors?
- [ ] Tests pass?
- [ ] No `console.log` statements (use logger)?
- [ ] No non-null assertions (the `x!` operator)?
- [ ] No `any` types?
- [ ] No legacy `SourceType` / `Source` / `Trait` / `Prompt` terminology leaked back into active changed files?

### 2. Documentation Sync

**Active Truth Docs**:
- [ ] Does `.trellis/spec/terminology.md` need updates?
  - Naming changes, object boundaries, forbidden legacy terms
- [ ] Does `docs/design/contextfs-architecture.md` need updates?
  - `mount namespace` / consumer interpretation / layer boundaries
- [ ] Does `docs/design/actant-vfs-reference-architecture.md` need updates?
  - mount, node, backend, lifecycle, namespace implementation details
- [ ] Does `.trellis/spec/config-spec.md` need updates?
  - `actant.namespace.json`, mount table, compatibility entrypoints
- [ ] Does `.trellis/spec/api-contracts.md` need updates?
  - `node type`, `filesystem type`, `stat` / `describe` / CLI / RPC outputs
- [ ] Does `docs/planning/contextfs-roadmap.md` need updates?
  - milestone scope or acceptance changes

**Key Question**: 
> "If I fixed a bug or discovered something non-obvious, should I document it so future me (or others) won't hit the same issue?"

If YES -> Update the relevant spec doc.

### 3. API Changes

If you modified API endpoints:

- [ ] Input schema updated?
- [ ] Output schema updated?
- [ ] API documentation updated?
- [ ] Client code updated to match?

### 4. Database Changes

If you modified database schema:

- [ ] Migration file created?
- [ ] Schema file updated?
- [ ] Related queries updated?
- [ ] Seed data updated (if applicable)?

### 5. Cross-Layer Verification

If the change spans multiple layers:

- [ ] Data flows correctly through all layers?
- [ ] Error handling works at each boundary?
- [ ] Types are consistent across layers?
- [ ] Loading states handled?

### 6. Manual Testing

- [ ] Feature works in browser/app?
- [ ] Edge cases tested?
- [ ] Error states tested?
- [ ] Works after page refresh?

---

## Quick Check Flow

```bash
# 1. Code checks
pnpm lint && pnpm type-check

# 2. View changes
git status
git diff --name-only

# 3. Based on changed files, check relevant items above
```

---

## Common Oversights

| Oversight | Consequence | Check |
|-----------|-------------|-------|
| Active truth docs not updated | Others don't know the current model | Check spec/design/roadmap |
| Migration not created | Schema out of sync | Check db/migrations/ |
| Types not synced | Runtime errors | Check shared namespace/mount/node types |
| Tests not updated | False confidence | Run full test suite |
| Console.log left in | Noisy production logs | Search for console.log |

---

## Relationship to Other Commands

```
Development Flow:
  Write code -> Test -> /trellis-finish-work -> /trellis-create-changelog-draft -> git commit -> /trellis-record-session
                          |                              |                                  |
                   Ensure completeness           Prepare delivery draft                Record progress
                   
Debug Flow:
  Hit bug -> Fix -> /trellis-break-loop -> Knowledge capture
                       |
                  Deep analysis
```

- `/trellis-finish-work` - Check work completeness (this command)
- `/trellis-create-changelog-draft` - Create the required delivery draft before ship / create-pr
- `/trellis-record-session` - Record session and commits
- `/trellis-break-loop` - Deep analysis after debugging

---

## Core Principle

> **Delivery includes not just code, but also documentation, verification, and knowledge capture.**

Complete work = Code + Docs + Tests + Verification
