# Issue #298 Validation

## Scope

This task validates the project-context bootstrap loop requested by issue `#298`:

- a project can register its context through `actant.project.json`
- local domain assets are loaded from `configs/`
- reusable project-reading assets exist
- a minimal bootstrap example works from directory contents alone
- Codex-style discovery questions can be answered from the checked-in files without oral context

The validated protocol in this task is:

1. `actant.project.json` is the project registration manifest
2. `configs/` holds project-local DomainContext assets
3. existing DomainContext managers remain the single component management layer
4. `/project/context.json` exposes resolved summary data, explicit `entrypoints`, and `available` asset catalogs

Scope matching between source-provided scope and project-allowed scope is intentionally left as future productization work. It is not required for this validation loop to pass.

## Structure

Validated repo assets:

- `actant.project.json`
- `PROJECT_CONTEXT.md`
- `configs/skills/project-context-reader.json`
- `configs/prompts/project-context-bootstrap.json`

Validated bootstrap fixture:

- `examples/project-context-bootstrap/actant.project.json`
- `examples/project-context-bootstrap/PROJECT_CONTEXT.md`
- `examples/project-context-bootstrap/configs/skills/project-context-reader.json`
- `examples/project-context-bootstrap/configs/prompts/project-context-bootstrap.json`
- `examples/project-context-bootstrap/configs/templates/project-context-agent.json`

## Config Samples

Root manifest:

```json
{
  "version": 1,
  "name": "Actant",
  "description": "Actant self-bootstrap project context",
  "configsDir": "configs",
  "entrypoints": {
    "knowledge": ["PROJECT_CONTEXT.md"],
    "readFirst": [
      "PROJECT_CONTEXT.md",
      ".trellis/spec/index.md",
      ".trellis/spec/backend/index.md",
      ".trellis/spec/guides/cross-layer-thinking-guide.md"
    ]
  }
}
```

Bootstrap fixture manifest:

```json
{
  "version": 1,
  "name": "project-context-bootstrap",
  "description": "Minimal bootstrap fixture for validating project-context discovery.",
  "configsDir": "configs",
  "entrypoints": {
    "knowledge": ["PROJECT_CONTEXT.md"],
    "readFirst": ["PROJECT_CONTEXT.md"]
  }
}
```

## Execution

Commands run:

```powershell
pnpm --filter @actant/core build
pnpm --filter @actant/pi build
pnpm --filter @actant/shared type-check
pnpm --filter @actant/api type-check
pnpm --filter @actant/mcp-server type-check
pnpm --filter @actant/mcp-server exec vitest run src/context-backend.test.ts
$env:LOG_LEVEL='silent'; node .trellis/tasks/03-18-issue-298-project-context-validation/validate-project-context.mjs
```

Artifacts:

- `validation-result.json` contains the machine-readable output
- `validate-project-context.mjs` is the reproducible validation entry

Final-artifact repair required before the blocked checks would pass:

```powershell
pnpm --filter @actant/core build
pnpm --filter @actant/pi build
```

The root causes were:

- `@actant/core` was shipping JS without a stable matching `dist/*.d.ts` surface
- `@actant/pi` was shipping `dist/index.js` that re-exported `./pi-builder` without emitting `pi-builder.js`

The repair was to:

- split JS and declaration generation for `core` and `pi` so `tsup` builds JS and `tsc -p tsconfig.build.json` emits declarations
- emit `pi-builder.js`, `pi-communicator.js`, `pi-tool-bridge.js`, and `package-version.js` as final artifacts
- fix the bootstrap fixture test to resolve from repository root rather than package-local `cwd`

## Results

### Project Registration Protocol

Pass.

- `actant.project.json` is now the explicit project registration manifest
- shared types and loader support `entrypoints`
- loader output now includes both `entrypoints` and `available` catalogs
- the resolved project context still reuses existing DomainContext managers rather than introducing a parallel manager stack

### Required Context Categories

Pass.

Root repo exposes all required categories:

- skill: `project-context-reader`
- knowledge/spec entry: `PROJECT_CONTEXT.md`
- prompt: `project-context-bootstrap`

Bootstrap fixture exposes the same minimum set plus one template:

- skill: `project-context-reader`
- knowledge/spec entry: `PROJECT_CONTEXT.md`
- prompt: `project-context-bootstrap`
- template: `project-context-agent`

### Reusable Agent Reading Path

Pass.

The reusable skill `configs/skills/project-context-reader.json` instructs a backend to:

1. read `/project/context.json`
2. read the manifest and declared entrypoints
3. use `available` catalogs instead of guessing from directories

This is generic project-context guidance, not repository-specific hardcoding.

### Empty-Directory Bootstrap

Pass.

`validation-result.json` shows the bootstrap fixture resolves to a non-empty summary:

- `skills = 1`
- `prompts = 1`
- `templates = 1`
- `sourceWarnings = []`

### Codex Reality Check

Pass.

Using only checked-in files plus the validation loader output, Codex can answer the required questions.
The final verification now uses the built artifact `packages/api/dist/services/project-context.js`, not a source-only shortcut.

For the root repo:

- project goal: Actant is in a project-context-first bootstrap phase where a backend should discover project purpose, rules, and assets from repository files alone
- read first: `actant.project.json`, `PROJECT_CONTEXT.md`, `.trellis/spec/index.md`, `.trellis/spec/backend/index.md`, `.trellis/spec/guides/cross-layer-thinking-guide.md`
- available assets: skills `code-review`, `code-review-dir`, `project-context-reader`, `typescript-expert`; prompts `project-context-bootstrap`, `system-code-reviewer`; workflow `trellis-standard`; template `code-review-agent`

For the bootstrap fixture:

- project goal: validate the minimum bootstrap loop for project-context discovery
- read first: `actant.project.json`, `PROJECT_CONTEXT.md`
- available assets: skill `project-context-reader`; prompt `project-context-bootstrap`; template `project-context-agent`

## Validated vs Future Work

Validated in this issue:

- project registration manifest shape
- explicit knowledge/read-first entrypoints
- reusable project-context reader skill
- minimal bootstrap fixture checked into the repo
- deterministic machine-readable validation output for repo root and empty-dir fixture
- repaired final-artifact export/declaration surfaces for `@actant/core` and `@actant/pi` so `@actant/api` type-check and focused `mcp-server` validation run cleanly

Deferred to later productization:

- source/project scope declaration and permission matching
- large-scale project-context version management
- installer/UI flows for creating project bootstrap assets
