# Issue #298 Project Context Validation

## Goal

Finish the real validation loop behind GitHub issue `#298`: prove that a project can
declare and expose enough project-level context for Codex or another Actant backend
to bootstrap itself from directory contents alone, without relying on oral context or
out-of-band memory.

## Why This Exists

The repository already has working `project-context` infrastructure:

- `actant.project.json` exists as a project root entry point
- `packages/api/src/services/project-context.ts` can load local configs and sources
- Hub / standalone bootstrap flows already expose `/project/context.json`
- tests and QA reports already prove the basic host/bootstrap surface

What is still missing is the closed loop that issue `#298` is actually asking for:

1. A project-level registration protocol, not just a loader
2. Reusable assets that teach an agent how to read project context
3. A minimal bootstrap example for an empty directory
4. A direct Codex validation pass that answers the required questions without oral help
5. A concise validation document that records the outcome

## User Intent Captured In This Task

The user clarified several architectural constraints that must shape the solution:

1. Project context can be large, composed of many skills, and may require versioning.
2. Project context should reuse the existing Actant DomainContext management layer
   rather than creating a parallel project-only manager stack.
3. Project entry and source registration should likely support explicit `scope`
   declarations so that source-provided scope and project-allowed scope can be matched
   before components are activated.
4. The real problem is not "can the loader parse files", but "can a backend actually
   discover, load, and act on project context from the directory itself".

## Current Understanding

### Already Landed

- `actant.project.json` currently registers:
  - project name
  - description
  - `configsDir`
  - optional `sources`
- project-context loading already reuses component managers for:
  - skills
  - prompts
  - MCP configs
  - workflows
  - templates
- project-context bootstrap is already available through Hub / standalone VFS

### Not Yet Landed

- a reusable "read project context" skill for arbitrary projects
- a durable project knowledge index pattern that is distinct from raw component storage
- a minimal empty-dir bootstrap example asset set checked into the repository
- a single validation document for issue `#298`
- scope matching rules between source registration and project entry

## Acceptance Criteria

Issue `#298` can only be considered complete when all of the following are true.

### A. Project Registration Protocol

- a project root entry exists and is parseable
- the entry is clearly positioned as the project-context registration manifest
- the relationship between project manifest, local configs, external sources, and final
  resolved DomainContext is documented

### B. Project Context Contents

At minimum, the project can expose all three categories:

- reusable skill or equivalent working-rules asset
- project knowledge/spec entry
- agent prompt or equivalent behavior-constraining prompt asset

### C. Reusable Agent Reading Path

- a reusable Actant skill exists that tells an agent how to discover project context
- it is not hard-coded to this repository only
- it explains read order and expected entry points

### D. Empty-Directory Bootstrap

- a minimal asset set can be dropped into an empty directory
- the resulting directory can be loaded by project-context tooling
- the resulting project summary is non-empty

### E. Codex Reality Check

Without extra oral context, Codex must be able to answer:

1. what the project is trying to do
2. what it should read first
3. which skills, prompts, and project/spec knowledge are available

### F. Validation Output

- one concise validation document exists
- it records:
  - structure
  - configuration examples
  - execution steps
  - measured results
  - what was validated vs what remains productization work

## Non-Goals

- full GUI/installer flow
- a final version-locking design for all future project context packages
- introducing entirely new DomainContext component categories in this issue

## Deliverables

1. protocol/documentation updates if required
2. reusable project-context reading asset(s)
3. minimal bootstrap fixture/example
4. implementation changes needed to make the loop pass
5. validation document with explicit Codex test results
