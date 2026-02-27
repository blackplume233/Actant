---
id: 219
title: "feat(api): Service Agent Session 管理接口 — 用户可自由选择/创建 Session，Employee 由 Actant 托管"
status: open
labels:
  - feature
  - architecture
  - api
  - acp
  - "priority:P1"
milestone: near-term
author: human
assignees: []
relatedIssues:
  - 193
  - 122
  - 171
relatedFiles:
  - packages/api/src/routes/agent-routes.ts
  - packages/core/src/acp/acp-connection-manager.ts
  - packages/shared/src/types/agent.types.ts
  - packages/dashboard/client/src/pages/agents.tsx
taskRef: null
githubRef: "blackplume233/Actant#219"
closedAs: null
createdAt: "2026-02-26T00:00:00"
updatedAt: "2026-02-26T00:00:00"
closedAt: null
---

**Related Issues**: [[0171-service-instance-session-concurrency]], [[0122-employee-service-mode]]
**Related Files**: `packages/api/src/routes/agent-routes.ts`, `packages/core/src/acp/acp-connection-manager.ts`

---

## 目标

为 Service 类型的 Agent 提供面向调用方的 **Session 管理接口**，使客户端可以：
- 列出当前 Agent 实例的所有活跃 Session
- 选择与某个已有 Session 继续对话
- 创建新的 Session

同时明确 **Employee 类型 Agent 的 Session 完全由 Actant 内部管理**，对外不暴露 Session 选择能力。

## 背景

`#193` 讨论了 Service Instance 的多 Session 并发模型（session 池、资源限制等底层策略），但尚未定义**面向调用方的 Session 管理 API 合约**。

当前系统通过 `AcpConnectionManager` 对每个 Agent 维护单一 primary session。对于 Service 型 Agent，客户端无法：
1. 将不同话题/客户隔离到不同 Session
2. 恢复之前中断的 Session 继续对话
3. 并行发起多个独立会话

这与 Service Agent 的「多客户端并发服务」语义不匹配。

## Session 所有权模型

| Archetype | Session 所有权 | 管理方式 | 对外接口 |
|-----------|---------------|---------|---------|
| **service** | 调用方（client-owned） | 客户端通过 API 自由创建/选择/销毁 | 完整 CRUD 接口 |
| **employee** | Actant（system-owned） | 由调度器和 TaskDispatcher 内部管理 | 无（opaque） |
| **tool** | 调用方（ephemeral） | 每次调用创建临时 session，用后即弃 | 无需管理 |

## 方案设计

### Service Agent — Session 管理 API

```typescript
// REST API 端点
POST   /api/agents/:name/sessions          // 创建新 session
GET    /api/agents/:name/sessions          // 列出活跃 sessions
GET    /api/agents/:name/sessions/:sid     // 获取 session 详情
DELETE /api/agents/:name/sessions/:sid     // 销毁 session
POST   /api/agents/:name/sessions/:sid/messages  // 向指定 session 发消息

// Session 信息
interface SessionInfo {
  sessionId: string;
  agentName: string;
  createdAt: string;
  lastActiveAt: string;
  status: 'active' | 'idle' | 'closed';
  metadata?: Record<string, unknown>;  // 客户端自定义元数据
}
```

### Employee Agent — Session 透明化

Employee Agent 的 `/messages` 端点**不接受 sessionId 参数**，消息统一进入 TaskQueue，由 Actant 调度器决定在哪个 session context 中执行：

```typescript
// Employee: 消息进入任务队列，session 对调用方不可见
POST /api/agents/:name/messages  // 无 sessionId，由系统分配
```

### ACP 层对接

ACP `sessions/create` RPC 已有 session 创建语义。需要在 Actant API 层增加对 ACP session 的映射：
- Service Agent: API session ↔ ACP session 1:1 映射
- Employee Agent: 内部管理 ACP session，不对外暴露

## 验收标准

- [ ] Service Agent 支持 session CRUD API
- [ ] 客户端可指定 sessionId 向特定 session 发送消息
- [ ] Employee Agent 的 session 对 API 调用方完全透明
- [ ] Dashboard 中 Service Agent 可展示 session 列表
- [ ] ACP session 映射正确（service: 1:1, employee: opaque）
- [ ] 对应的 REST API 文档更新

## 依赖

- #193 Service Instance 多 Session 与并发模型设计（底层 session 池化策略）
- #122 Employee/Service Mode（archetype 执行模型）

---

## Comments
