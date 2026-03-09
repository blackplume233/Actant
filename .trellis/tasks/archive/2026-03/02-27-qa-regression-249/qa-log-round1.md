# QA Log — Round 1 (Regression #249)

**Scope**: 回归验证 — Issue #249 ContextProvider 重构
**Environment**: real (Windows 10, pnpm monorepo)
**Started**: 2026-02-27T19:41

---

## Step 1: Full Unit Test Suite (`pnpm test`)

**Input**: `pnpm test` (vitest run, all packages)
**Output**: Exit code 0

```
Test Files  75 passed (75)
     Tests  977 passed (977)
  Duration  18.29s
```

**Judgment**: ✅ PASS — All 977 tests across 75 files pass. Zero failures.

Key coverage areas for #249 regression:
- `context-injector/core-context-provider.test.ts` (13 tests) ✅
- `context-injector/canvas-context-provider.test.ts` (10 tests) ✅
- `context-injector/session-context-injector.test.ts` (28 tests) ✅
- `context-injector/session-token-store.test.ts` (14 tests) ✅
- `prompts/template-engine.test.ts` (11 tests) ✅
- `services/domain-context-integration.test.ts` (7 tests) ✅
- `e2e-cli.test.ts` (12 tests, incl. agent start+stop lifecycle) ✅

---

## Step 2: Build Artifact Integrity

**Input**: Node script checking dist/ contents and exports
**Output**: Exit code 0

```
dist/prompts: [ 'canvas-context.md', 'core-identity.md', 'tool-instructions.md' ]
CanvasContextProvider exported: true
CoreContextProvider exported: true
loadTemplate exported: true
renderTemplate exported: true
```

**Judgment**: ✅ PASS — All 3 template files copied to dist/prompts/, all 4 new exports present in bundle.

---

## Step 3: Blackbox Provider Behavior (from dist/ bundle)

**Input**: Node ESM script importing from `packages/core/dist/index.js`, testing:
- CoreContextProvider for 3 archetypes (repo/service/employee)
- CanvasContextProvider tool filtering (repo=0 tools, employee=2 tools)
- CanvasContextProvider system context gating (repo=undefined, employee=includes 'canvas')
- Template engine load + render
- Fuzz: 9 random archetype×backend combos

**Output**: Exit code 0

```
Core[repo]: PASS
Core[service]: PASS
Core[employee]: PASS
Canvas repo tools: PASS (count=0)
Canvas employee tools: PASS (count=2)
Canvas repo context: PASS
Canvas employee context: PASS
Template load: PASS
Template render: PASS
Fuzz test: 9/9 combos passed PASS
```

**Judgment**: ✅ PASS — All 10 checks pass. Provider behavior correct from bundled dist output.

---

## Step 4: Integration Flow — SessionContextInjector (from dist/)

**Input**: Node ESM script exercising full prepare() flow for 3 archetypes via dist bundle

**Output**: Exit code 0

```
Providers: [ 'core-identity', 'canvas' ]
--- Employee ---
MCP servers: 0   Tools: [ 'actant_canvas_update', 'actant_canvas_clear' ]
Token present: true   Context count: 3
First context has identity: true   Last context has tool instructions: true
--- Repo ---
Tools: 0   Context count: 1   Has identity only: true
--- Service ---
Tools: [ 'actant_canvas_update', 'actant_canvas_clear' ]   Context count: 3
--- Token ---
Revoked emp-agent token: PASS   svc-agent token still valid: PASS
```

**Judgment**: ✅ PASS — Full injector flow correct:
- Employee: identity + canvas context + tool instructions (3 contexts), 2 tools, valid token
- Repo: identity only (1 context), 0 tools (scope filtering works), token present
- Service: same as employee for canvas (service-scope tools pass)
- Token revocation: per-agent revocation works, other agents unaffected

---

## Step 5: Source Code Sanity — Registration Order

**Input**: Grep `register(new (Core|Canvas)ContextProvider` in app-context.ts
**Output**:
```
L208: this.sessionContextInjector.register(new CoreContextProvider());
L209: this.sessionContextInjector.register(new CanvasContextProvider());
```

**Judgment**: ✅ PASS — Core registered before Canvas, matching spec requirement.

---

## Step 6: Regression — No Hardcoded Prompts Remain in session-context-injector.ts

**Input**: Check that `buildToolContextBlock` uses template engine, no hardcoded strings
**Output**:
- `loadTemplate`/`renderTemplate` imports: present at L4
- `loadTemplate("tool-instructions.md")` at L192, `renderTemplate(...)` at L193
- Hardcoded prompts ("You have access to", "Your session token"): 0 matches

**Judgment**: ✅ PASS — All prompts externalized to templates, zero hardcoded strings remain.

---

## Summary

| Step | Test | Result |
|------|------|--------|
| 1 | Full unit test suite (977 tests / 75 files) | ✅ PASS |
| 2 | Build artifact integrity (dist/prompts + exports) | ✅ PASS |
| 3 | Blackbox Provider behavior (10 checks + 9-combo fuzz) | ✅ PASS |
| 4 | Integration flow: Injector prepare() for 3 archetypes + token revocation | ✅ PASS |
| 5 | Registration order in app-context.ts | ✅ PASS |
| 6 | No hardcoded prompts in session-context-injector.ts | ✅ PASS |

**Round 1 Result**: 6/6 PASS, 0 FAIL, 0 WARN
