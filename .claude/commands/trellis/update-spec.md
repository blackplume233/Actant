# Update Spec - Sync the Active ContextFS Baseline

Use this command when new knowledge changes the active repository truth.

This command is not for writing free-floating notes.
It is for updating the current ContextFS baseline so the next Agent reads one consistent model.

**Timing**: after clarifying a rule, fixing a mismatch, or learning something that changes current contracts or naming

---

## What Counts as a Spec Update

Update the active docs when you change any of the following:

- product meaning
- object boundaries
- terminology
- path layout
- operation surface
- permissions
- lifecycle
- kernel layering
- milestone scope
- repository review rules

If the learning only belongs to history, move it to `trash/` instead of expanding active docs.

---

## Active Documentation Baseline

Current active truth lives here:

1. `.trellis/spec/index.md`
2. `.trellis/spec/vision.md`
3. `.trellis/spec/terminology.md`
4. `docs/design/contextfs-architecture.md`
5. `docs/design/actant-vfs-reference-architecture.md`
6. `.trellis/spec/config-spec.md`
7. `.trellis/spec/api-contracts.md`
8. `.trellis/spec/backend/index.md`
9. `docs/planning/contextfs-roadmap.md`
10. `.trellis/workflow.md`

Do not create a parallel source of truth outside this baseline.

---

## Routing Guide

Use this mapping to decide where to update:

| If You Learned About | Update These Docs |
|----------------------|-------------------|
| what Actant is, what ContextFS means | `.trellis/spec/vision.md` |
| naming, role boundaries, forbidden terms | `.trellis/spec/terminology.md` |
| `Project`, `Source`, `Capability`, `Tool`, `Agent` product semantics | `docs/design/contextfs-architecture.md` |
| namespace, mount, middleware, node, backend, metadata, lifecycle, events | `docs/design/actant-vfs-reference-architecture.md`, `.trellis/spec/backend/index.md` |
| `ProjectManifest`, mounts, permissions, children | `.trellis/spec/config-spec.md` |
| paths, operations, control nodes, stream nodes | `.trellis/spec/api-contracts.md` |
| scope, milestones, non-goals, acceptance | `docs/planning/contextfs-roadmap.md` |
| repository process and review gates | `.trellis/workflow.md` |

---

## Update Process

### Step 1: State the Change Clearly

Write down:

1. what changed
2. why it changed
3. which active docs now need synchronization

### Step 2: Read the Target Docs

Before editing, read the current active doc set so you do not create double truth.

### Step 3: Update the Highest-Level Truth First

Preferred order:

1. `vision.md` if meaning changed
2. `terminology.md` if naming changed
3. design docs if object or kernel boundaries changed
4. contract docs if config or API changed
5. roadmap if scope or milestone changed
6. workflow if review or process changed

### Step 4: Remove Conflicting Material

If an active doc now conflicts with the new baseline:

- rewrite it
- remove it
- or move it to `trash/`

Do not leave conflicting active docs in place for later cleanup.

### Step 5: Verify Single Truth

After editing, confirm:

- the same term does not mean different things in different docs
- there is only one active architecture narrative
- forbidden old terms appear only when explicitly rejected or historically referenced

---

## Update Patterns

### Naming Boundary Change

Use when clarifying terms such as `Source` vs `Provider`.

Required checks:

- update `.trellis/spec/terminology.md`
- update product or kernel docs that use the term
- remove conflicting usage in active docs

### Object Model Change

Use when changing the role of `Project`, `Source`, `Capability`, `Agent`, or `Tool`.

Required checks:

- update `vision.md` if product meaning changed
- update `docs/design/contextfs-architecture.md`
- update `config-spec.md` or `api-contracts.md` if contracts changed
- update roadmap if V1 scope changed

### Kernel Boundary Change

Use when changing namespace, mount, middleware, node, backend, metadata, lifecycle, or events.

Required checks:

- update `docs/design/actant-vfs-reference-architecture.md`
- update `.trellis/spec/backend/index.md`
- update `api-contracts.md` if external behavior changed

### Review Rule Change

Use when changing how the repo should be audited or delivered.

Required checks:

- update `.trellis/workflow.md`
- update command docs that enforce the rule

---

## Quality Checklist

- [ ] The updated docs belong to the active baseline
- [ ] The naming matches `terminology.md`
- [ ] The change does not reintroduce old `ContextManager` or `DomainContext` truth
- [ ] `workflow` is not reintroduced as a V1 top-level product object
- [ ] There is no second architecture narrative outside `trash/`
- [ ] The roadmap and contracts still match the design docs

---

## Relationship to Other Commands

| Command | Role |
|---------|------|
| `/trellis-update-spec` | update active truth before ship |
| `/trellis-finish-work` | confirm spec sync and naming consistency |
| `/trellis-ship` | blocks delivery if docs are unsynced |
| `/trellis-record-session` | record what was delivered after commit |

Core principle:

> Specs are not a memory dump. They are the active contract for future implementation and review.
