---
id: 39
title: Session Lease API 在 mock launcher 模式下无法端到端测试
status: open
labels:
  - bug
  - qa
  - acp
  - "priority:P1"
milestone: null
author: qa-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/api/src/handlers/session-handlers.ts
  - packages/core/src/manager/launcher/mock-launcher.ts
  - packages/core/src/session/session-registry.ts
taskRef: null
githubRef: "blackplume233/Actant#44"
closedAs: null
createdAt: "2026-02-21T10:20:00.000Z"
updatedAt: "2026-02-21T10:20:00.000Z"
closedAt: null
---

**Related Files**: `packages/api/src/handlers/session-handlers.ts`, `packages/core/src/manager/launcher/mock-launcher.ts`, `packages/core/src/session/session-registry.ts`

---

## 测试发现

**场景**: Issue #35 随机漫步测试
**步骤**: 2.5 / 2.9 - session.create 调用

## 复现方式

```bash
export ACTANT_HOME=$(mktemp -d)
export ACTANT_LAUNCHER_MODE=mock

# 启动 Daemon + 创建 Agent
actant daemon start --foreground &
actant template load <template.json>  # backend.type = "cursor"
actant agent create test -t tpl
actant agent start test

# 尝试创建 session
# RPC: session.create {agentName: "test", clientId: "c1"}
```

## 期望行为

在 mock 模式下能够创建 session lease 并测试 session.cancel 等核心功能。

## 实际行为

两种失败路径：
1. `cursor` 后端: 返回 `Agent has no ACP connection`（因为只有 claude-code 后端创建 ACP 连接）
2. `claude-code` 后端: Agent 立即变为 stopped（ProcessWatcher 检测到假 PID 10000+ 不存活）

## 分析

Mock launcher 返回的假 PID 不对应真实进程，ProcessWatcher 在 5 秒内标记 agent 为 stopped。

即使 agent 暂时 running，非 ACP 后端不建立 ACP 连接。session.create 的 `hasAcpConnection` 检查失败。

对于 claude-code 后端，虽然 `isAcpBackend` 返回 true，但 mock launcher 不触发 `acpManager.connect()` 的真实 spawn，导致 ACP 连接也不存在。

## 建议修复

选项 A: 在 MockLauncher 中支持 mock ACP 连接，返回可控的 session 响应
选项 B: 添加 MockAcpConnectionManager，配合 mock launcher 使用
选项 C: 创建单元测试直接测试 session handlers（mock AppContext）

推荐选项 C 作为最小修复方案。
