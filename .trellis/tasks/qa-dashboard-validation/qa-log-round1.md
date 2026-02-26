# QA Dashboard Validation — Round 1 Log

**Scope**: Dashboard 可用性验证 — 通过 agent 交互生成 50+ events，验证 Dashboard API/SSE
**Environment**: Real launcher mode (no ACTANT_LAUNCHER_MODE), Windows 10, PowerShell
**Test Dir**: `C:\Users\black\AppData\Local\Temp\ac-qa-dashboard-20260226182511`
**Socket**: `\\.\pipe\actant-qa-dashboard-130893177`
**Dashboard**: `http://localhost:3210`
**Started**: 2026-02-26T18:25:11

---

## Round 1: Template Management

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | template list | 0 | PASS — actant-hub templates loaded |
| 2 | template load configs/templates/code-review-agent.json | 0 | PASS |
| 3 | agent create reviewer-1 -t code-review-agent | 1 | FAIL — Skill "code-review" not found |

**Fix**: 切换到 qa-minimal 模板（无 skill 依赖）

## Round 2: Mass Agent Creation (qa-minimal template)

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | agent create reviewer-1 -t qa-minimal | 0 | PASS |
| 2 | agent create reviewer-2 -t qa-minimal | 0 | PASS |
| 3 | agent create reviewer-3 -t qa-minimal | 0 | PASS |
| 4 | agent create ci-bot -t qa-minimal | 0 | PASS |
| 5 | agent create test-runner -t qa-minimal | 0 | PASS |
| 6 | agent list | 0 | PASS — 5 agents shown |

## Round 3: Agent Start (all FAIL)

| # | Command | Exit | Result |
|---|---------|------|--------|
| 7 | agent start reviewer-1 | 1 | FAIL — `__dirname is not defined` |
| 8 | agent start reviewer-2 | 1 | FAIL — same error |
| 9-11 | agent start reviewer-3/ci-bot/test-runner | 1 | FAIL — same error |

**Root cause**: `packages/api/src/services/app-context.ts` line 207 uses `__dirname` in ESM context.
```typescript
args: [join(__dirname, "..", "..", "..", "mcp-server", "dist", "index.js")],
```
tsup outputs ESM (`format: ["esm"]`), ESM has no `__dirname`. The error is deferred because `__dirname` is inside a `getMcpServers()` callback that only runs during `sessionContextInjector.prepare()` (called by `startAgent()`).

## Round 4-8: Agent Stop/Status/Destroy Lifecycle

| # | Command | Exit | Result |
|---|---------|------|--------|
| 13-15 | agent status reviewer-1/2/ci-bot | 0 | PASS |
| 16-17 | agent stop reviewer-1/2 | 0 | PASS |
| 22-26 | agent stop all 5 agents | 0 | PASS |
| 28-29 | agent start reviewer-1/ci-bot (retry) | 1 | FAIL (same __dirname bug) |
| 30-33 | agent status + stop | 0 | PASS |
| 35-40 | rapid start-stop cycles | mixed | start=FAIL, stop=PASS |

## Round 9: Error Handling

| # | Command | Exit | Result |
|---|---------|------|--------|
| 42 | agent create reviewer-1 (duplicate) | 1 | PASS (expected: already exists) |
| 43 | agent start nonexistent-agent | 1 | PASS (expected: not found) |
| 44 | agent stop nonexistent-agent | 1 | PASS (expected: not found) |
| 45 | agent status nonexistent-agent | 1 | PASS (expected: not found) |
| 46 | agent destroy reviewer-3 --force | 0 | PASS |

## Round 10: Final Operations

| # | Command | Exit | Result |
|---|---------|------|--------|
| 48 | agent create fresh-agent | 0 | PASS |
| 49 | agent start fresh-agent | 1 | FAIL (__dirname) |
| 50 | agent status fresh-agent | 0 | PASS |
| 51 | agent stop fresh-agent | 0 | PASS |
| 52-54 | agent destroy fresh-agent/reviewer-2/test-runner | 0 | PASS |
| 55 | agent list | 0 | PASS — 2 agents remaining |
| 56 | daemon status | 0 | PASS — v0.2.3 |

---

## Dashboard API Verification

| # | Endpoint | HTTP | Result |
|---|----------|------|--------|
| D1 | GET / | 200 | PASS — HTML SPA |
| D2 | GET /api/status | 200 | PASS — `{"version":"0.2.3","uptime":232,"agents":5}` |
| D3 | GET /api/agents | 404 | FAIL — endpoint not implemented |
| D4 | GET /api/events | 404 | FAIL — endpoint not implemented |
| D5 | GET /api/canvas | 200 | PASS — `{"entries":[]}` |
| D6 | GET /api/canvas/reviewer-1 | 404 | PASS — correct error for missing canvas |
| D7 | GET /sse | 200 | PASS — SSE stream with status/agents/events/canvas events |

---

## Round 1 Summary

| Category | Total | PASS | FAIL |
|----------|-------|------|------|
| Agent Creation | 7 | 6 | 1 |
| Agent Start | 12 | 0 | 12 |
| Agent Stop | 15 | 15 | 0 |
| Agent Status | 8 | 8 | 0 |
| Agent Destroy | 4 | 4 | 0 |
| Error Handling | 4 | 4 | 0 |
| Dashboard API | 7 | 5 | 2 |
| **Total** | **57** | **42** | **15** |

## Issues Identified

1. **BUG [P0]**: `__dirname is not defined` in `app-context.ts` — blocks all agent starts
2. **ENHANCEMENT [P2]**: Dashboard missing `/api/agents` REST endpoint
3. **ENHANCEMENT [P2]**: Dashboard missing `/api/events` REST endpoint
