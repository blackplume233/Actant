---
id: 167
title: "fix(api): initialize EmployeeScheduler on agent start (#152)"
status: closed
labels: []
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 163
  - 166
relatedFiles:
  - packages/actant-memory/src/sharing/memory-export.ts
  - packages/actant-memory/src/sharing/memory-import.ts
  - packages/actant-memory/src/sharing/manifest.ts
taskRef: null
githubRef: "blackplume233/Actant#190"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:52"
closedAt: "2026-02-25T02:14:13Z"
---

**Related Issues**: [[0163-agent-memory-store-lancedb]], [[0166-template-layer-promote]]
**Related Files**: `packages/actant-memory/src/sharing/memory-export.ts`, `packages/actant-memory/src/sharing/memory-import.ts`, `packages/actant-memory/src/sharing/manifest.ts`

---

## Summary

- **#152** `agent start` 启动含 `schedule` 配置的 Agent 时，现在会自动创建 `EmployeeScheduler` 并注册到 `ctx.schedulers`。之前 `ctx.schedulers` 始终为空 Map，导致 `agent dispatch` 永远返回 `{ queued: false }`
- `handleAgentStop` / `handleAgentDestroy` 中增加 scheduler 清理逻辑（`stop()` + `delete`）
- 附带修复 CLI E2E 测试中 `daemon.ping` 版本号硬编码为 `"0.1.0"` 的断言（改为 semver pattern match）

## Test plan

- [x] 760/760 tests passing（包括修复后的 CLI E2E daemon status 测试）
- [x] `@actant/api` agent-handlers type-check passes
- [ ] Manual: `actant agent start <sched-agent>` → `actant schedule list <sched-agent>` shows configured sources
- [ ] Manual: `actant agent dispatch <sched-agent> -m "test"` → returns `{ queued: true }`
- [ ] Manual: `actant agent stop <sched-agent>` → scheduler properly cleaned up
