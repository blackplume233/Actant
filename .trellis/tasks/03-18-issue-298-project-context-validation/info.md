# Execution Plan

## Working Thesis

Project context should be treated as a **project registration and assembly protocol**
that reuses the existing DomainContext component managers.

This task will therefore use the following model:

- `actant.project.json`
  - project-level registration manifest
  - declares project identity, local context location, external sources, and later
    compatible assembly controls
- local `configs/`
  - project-private or project-local DomainContext components
- source registrations
  - reusable component sources that may later carry explicit scope/version metadata
- DomainContext managers
  - the shared component management layer that should remain the single place where
    skills/prompts/workflows/templates are registered and resolved
- resolved project context
  - the final effective view exposed to Hub / VFS / Codex

## Key Architectural Decisions To Validate

### 1. Reuse DomainContext Managers

Do not build a parallel "project-only" manager stack.

Instead:

- project-context resolution assembles inputs
- the existing managers hold the effective components
- the project layer remains an entry/assembly layer

### 2. Separate Registration From Content

`actant.project.json` should stay small and declarative.

It should not become a giant inline context blob. Large project context should live in:

- local `configs/`
- external sources
- project knowledge/spec entry files

### 3. Scope Matching Is A Promising Next Step

The user proposed a likely future direction:

- source registration declares owned/provided `scope`
- project manifest declares allowed `scope`
- resolver performs scope matching before activation

This task does not have to finalize the entire permission model, but must evaluate
whether issue `#298` should introduce the minimum viable form of this protocol now.

### 4. Validation Must Be Real

The issue is not complete if only unit tests pass.

Completion requires at least one direct Codex-style validation where the backend is
forced to read only the directory contents and answer the issue's discovery questions.

## Current Baseline

### Existing Assets

- root manifest: `actant.project.json`
- loader: `packages/api/src/services/project-context.ts`
- shared types:
  - `packages/shared/src/types/project.types.ts`
  - `packages/shared/src/types/domain-context.types.ts`
- specs:
  - `.trellis/spec/config-spec.md`
  - `.trellis/spec/api-contracts.md`
- current local context assets under `configs/`
- prior bootstrap QA evidence in `.trellis/tasks/archive/2026-03/qa-loop-cli-hub-bootstrap/`

### Current Gaps

- no obvious reusable project-context reading skill exists yet
- current `configs/` contents are still code-review examples, not project-context-first assets
- no repository fixture/example for empty-dir bootstrap is clearly designated
- no issue-298-specific validation document exists yet
- no explicit scope matching protocol exists yet

## Multi-Step Plan

### Phase 1. Freeze The Protocol

Objective:
define the minimum project-context protocol that this issue will validate.

Steps:

1. Confirm the boundary between:
   - project manifest
   - DomainContext managers
   - project knowledge index
   - source registrations
2. Decide whether issue `#298` introduces:
   - no scope fields yet, only documents the future direction
   - or a minimal scope field in source/project manifests
3. Confirm what counts as the official project knowledge/spec entry.

Exit criteria:

- plan is stable enough to implement without re-litigating the architecture every step

### Phase 2. Add Reusable Project-Context Assets

Objective:
create the reusable assets that make the protocol real for agents.

Likely work:

1. add a reusable "read project context" skill
2. add or formalize a project knowledge/spec entry file
3. point the current repo's project context to those assets

Exit criteria:

- an agent can be told only "read the project context" and has a deterministic path

### Phase 3. Add Empty-Dir Bootstrap Example

Objective:
check in a minimal example that proves the protocol works outside this repository's
historical context.

Likely work:

1. create an example or fixture directory with:
   - `actant.project.json`
   - one skill
   - one prompt
   - one project knowledge/spec entry
2. ensure the loader can parse it into a non-empty summary

Exit criteria:

- empty-dir bootstrap assets exist and are directly testable

### Phase 4. Run Validation Loop

Objective:
run the real validation sequence and fix failures until it passes.

Validation matrix:

1. load current repo project context
2. load empty-dir bootstrap example
3. verify Hub / standalone read surfaces
4. run Codex-style read-only discovery without oral context
5. record failures and patch until the answers become stable

Exit criteria:

- the issue's required questions can be answered from directory contents alone

### Phase 5. Document And Close

Objective:
write the concise final validation record.

Document must include:

- directory structure
- config samples
- validation commands/steps
- observed results
- validated truths vs future productization

Exit criteria:

- the issue can be reviewed against one self-contained document

## Risks

### Risk 1. Solving The Wrong Problem

If implementation focuses only on parser/load success, the actual bootstrap discovery
problem remains unsolved.

Mitigation:
always test with "what can a backend answer from files alone?"

### Risk 2. Creating A Parallel Manager Model

If project context gets its own manager stack, the system will fork conceptually.

Mitigation:
keep project-context as registration/assembly, not a new component-management universe

### Risk 3. Over-designing Scope/Versioning In This Issue

The user is right that project context may grow large and versioned, but issue `#298`
is still a validation issue, not the entire final package-manager design.

Mitigation:
allow minimal scope support only if it directly helps the validation loop; otherwise
capture it as the next-step protocol direction

### Risk 4. False Positive Validation

If Codex answers correctly because of prior conversational context rather than files,
the loop is invalid.

Mitigation:
run the final validation in an isolated target directory and only permit file-based reads

## Immediate Next Actions

1. decide the minimum scope/protocol change for this issue
2. audit current `configs/` assets and replace/add project-context-first assets
3. create the bootstrap example directory
4. rerun the validation loop with an execution harness that works on this Windows setup
