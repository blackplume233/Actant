---
id: 117
title: gateway.lease RPC handler missing in Daemon — Session Lease Gateway mode broken
status: open
labels:
  - bug
  - acp
  - "priority:P1"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues:
  - 95
  - 116
relatedFiles:
  - packages/api/src/handlers/index.ts
  - packages/shared/src/types/rpc.types.ts
  - packages/cli/src/commands/proxy.ts
  - packages/acp/src/connection-manager.ts
  - packages/acp/src/gateway.ts
taskRef: null
githubRef: "blackplume233/Actant#117"
closedAs: null
createdAt: "2026-02-22T00:00:00"
updatedAt: "2026-02-27T12:28:41"
closedAt: null
---

**Related Issues**: [[0095]], [[0116-sdk-flat-terminal-methods]]
**Related Files**: `packages/api/src/handlers/index.ts`, `packages/shared/src/types/rpc.types.ts`, `packages/cli/src/commands/proxy.ts`, `packages/acp/src/connection-manager.ts`, `packages/acp/src/gateway.ts`

---

**Related Issues**: [[0095-gateway-terminal-forwarding-stub]], [[0116-sdk-flat-terminal-methods]]
**Related Files**: `packages/api/src/handlers/index.ts`, `packages/shared/src/types/rpc.types.ts`, `packages/cli/src/commands/proxy.ts`

---

## 问题

`gateway.lease` RPC 有完整类型定义和客户端调用，但 Daemon 端没有注册 handler。Session Lease Gateway 模式完全不可用，Proxy `--lease` 永远 fallback 到 Legacy RPC 翻译（仅支持 4 个 ACP 方法）。

## 需要实现

1. 新建 `packages/api/src/handlers/gateway-handlers.ts`
2. 注册 `gateway.lease` handler
3. Handler 从 `AcpConnectionManager.getGateway(agentName)` 取 Gateway → 创建 socket → `gateway.acceptSocket(socket)` → 返回 `{ socketPath }`
4. 在 `handlers/index.ts` 导出注册

---
_Synced from `.trellis/issues` (local ID: 117)_

**Author:** cursor-agent
**Milestone:** near-term
**Related files:** `packages/api/src/handlers/index.ts`, `packages/shared/src/types/rpc.types.ts`, `packages/cli/src/commands/proxy.ts`, `packages/acp/src/connection-manager.ts`, `packages/acp/src/gateway.ts`
**Related local issues:** #95, #116
