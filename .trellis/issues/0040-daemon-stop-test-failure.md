---
id: 40
title: "daemon stop 连接失败时未输出 'Daemon is not running' 消息"
status: open
labels:
  - bug
  - qa
  - cli
  - "priority:P1"
milestone: null
author: qa-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/cli/src/commands/daemon/stop.ts
  - packages/cli/src/commands/__tests__/commands.test.ts
taskRef: null
githubRef: "blackplume233/Actant#46"
closedAs: null
createdAt: "2026-02-21T10:20:00.000Z"
updatedAt: "2026-02-21T10:20:00.000Z"
closedAt: null
---

**Related Files**: `packages/cli/src/commands/daemon/stop.ts`, `packages/cli/src/commands/__tests__/commands.test.ts`

---

## 测试发现

**场景**: Issue #35 随机漫步测试 — 完整测试套件
**步骤**: 6.3 - pnpm test

## 复现方式

```bash
pnpm test
# 或直接运行:
pnpm vitest run packages/cli/src/commands/__tests__/commands.test.ts
```

## 期望行为

`createDaemonStopCommand > connection fails: prints Daemon is not running` 测试通过。
当 daemon stop 连接失败时，应输出包含 'Daemon is not running' 的消息。

## 实际行为

测试失败：
```
AssertionError: expected false to be true
❯ packages/cli/src/commands/__tests__/commands.test.ts:318:74
  expect(output.logs.some((l) => l.includes("Daemon is not running"))).toBe(true)
```

## 分析

`daemon stop` 命令的错误处理分支可能在 catch 中未正确调用 printer 输出 'Daemon is not running' 消息，或者错误输出到了 stderr 而非 logs。

检查文件: `packages/cli/src/commands/daemon/stop.ts`
