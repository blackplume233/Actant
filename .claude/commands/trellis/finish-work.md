# Finish Work - Pre-Ship Checklist

Use this checklist before commit or final delivery.

The goal is not only to check code quality, but also to confirm that a new Agent cannot learn the wrong architecture from active documents.

**Timing**: after implementation and local verification, before `/trellis-ship`

---

## Read First

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `.trellis/workflow.md`
4. `.trellis/spec/index.md`
5. `.trellis/spec/terminology.md`

If the change affects architecture or contracts, also read:

6. `docs/design/contextfs-architecture.md`
7. `docs/design/actant-vfs-reference-architecture.md`
8. `docs/planning/contextfs-roadmap.md`

---

## Checklist

### 1. Active-Truth Review

- [ ] No active document outside `trash/` introduces stale architecture truth
- [ ] No changed file presents `ContextManager` as current architecture
- [ ] No changed file presents `DomainContext` as current architecture
- [ ] No changed file presents `workflow` as a V1 top-level product object
- [ ] No changed file creates a second "current" architecture narrative

### 2. Terminology Review

- [ ] `ContextFS` is used as the product layer name
- [ ] `VFS Kernel` is used as the implementation layer name
- [ ] `Source` is used for mounted external resource boundaries
- [ ] `Provider` is used only for internal suppliers or adapters
- [ ] `Project` is not described as a `Source`
- [ ] `Capability` is not described as permission
- [ ] `Tool` is described as a file-style executable or stream resource, not a separate top-level system

### 3. Spec and Design Sync

Use this rule:

> If the change affects object model, naming, path layout, operations, permissions, lifecycle, or kernel boundaries, the relevant docs must already be updated before ship.

- [ ] `vision.md` updated if product direction or object meaning changed
- [ ] `terminology.md` updated if naming or boundary rules changed
- [ ] `contextfs-architecture.md` updated if product object model changed
- [ ] `actant-vfs-reference-architecture.md` updated if kernel layering changed
- [ ] `config-spec.md` updated if mounts, permissions, or children changed
- [ ] `api-contracts.md` updated if paths or operations changed
- [ ] `backend/index.md` updated if implementation baseline changed
- [ ] `contextfs-roadmap.md` updated if milestone scope changed
- [ ] `.trellis/workflow.md` updated if repository process changed

### 4. Verification

```bash
pnpm lint
pnpm type-check
pnpm test
```

- [ ] `pnpm lint` passes
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes or the skip reason is explicit

### 5. Pattern Scan

- [ ] No leftover `console.log`
- [ ] No new `any`
- [ ] No new non-null assertions
- [ ] No silent contract drift
- [ ] No active docs added in the wrong place

### 6. Change Review

- [ ] `git status` is understood
- [ ] `git diff --name-only` matches intended scope
- [ ] `git diff --stat` matches intended scope
- [ ] No sensitive files are staged

---

## Quick Flow

```bash
pnpm lint
pnpm type-check
pnpm test
git status
git diff --name-only
git diff --stat
```

Then answer:

1. Would a new Agent read any wrong architecture information from the active tree?
2. Did this change require spec or design updates?
3. Is the naming still consistent with `terminology.md`?

If any answer is uncertain, stop and fix it before ship.

---

## Common Oversights

| Oversight | Consequence | Required Fix |
|-----------|-------------|--------------|
| changed contracts without doc sync | implementation outruns spec | update the active baseline docs |
| used `Provider` where product docs require `Source` | naming drift | fix the doc or code naming boundary |
| left old architecture terms in active docs | new Agents learn wrong model | move or remove stale docs |
| changed path layout without updating contracts | broken assumptions | update `api-contracts.md` |
| changed `ProjectManifest` shape without updating config spec | config drift | update `config-spec.md` |

---

## Relationship to Other Commands

| Command | Role |
|---------|------|
| `/trellis-finish-work` | this checklist |
| `/trellis-update-spec` | updates active baseline docs |
| `/trellis-ship` | final delivery gate, commit, push, issue sync |
| `/trellis-record-session` | records delivered work after commit |

Core rule:

```text
spec / design / roadmap -> implementation -> verification -> ship
```
