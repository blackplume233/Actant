# Update Spec - Sync the Active ContextFS Baseline

When you learn something valuable (from debugging, implementing, or discussion), use this command to update the active repository truth.

**Timing**: after clarifying a rule, fixing a mismatch, or learning something that changes current contracts or naming

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

| If You Learned About | Update These Docs |
|----------------------|-------------------|
| what Actant is, what ContextFS means | `.trellis/spec/vision.md` |
| naming, role boundaries, forbidden terms | `.trellis/spec/terminology.md` |
| `mount namespace`, `mount table`, `filesystem type`, `mount instance`, `node type`, consumer interpretation boundaries | `docs/design/contextfs-architecture.md` |
| namespace, mount, middleware, node, backend, metadata, lifecycle, events | `docs/design/actant-vfs-reference-architecture.md`, `.trellis/spec/backend/index.md` |
| `actant.namespace.json`, mount table, compatibility entrypoints, permissions | `.trellis/spec/config-spec.md` |
| paths, operations, control nodes, stream nodes, CLI / RPC outputs | `.trellis/spec/api-contracts.md` |
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

Before editing, read the current spec to:
- understand existing structure
- avoid duplicating content
- find the right section for your update

```bash
cat <target-doc>
```

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

## Quality Checklist

Before finishing your spec update:

- [ ] The updated docs belong to the active baseline
- [ ] The naming matches `.trellis/spec/terminology.md`
- [ ] The change does not reintroduce old `ContextManager` or `DomainContext` truth
- [ ] `workflow` is not reintroduced as a V1 top-level product object
- [ ] There is no second architecture narrative outside `trash/`
- [ ] The roadmap and contracts still match the design docs

---

## Relationship to Other Commands

- `/trellis-update-spec` - update active truth before ship
- `/trellis-finish-work` - confirm spec sync and naming consistency
- `/trellis-ship` - blocks delivery if docs are unsynced

Core principle:

> Specs are not a memory dump. They are the active contract for future implementation and review.
