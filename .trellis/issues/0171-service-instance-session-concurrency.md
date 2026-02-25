---
id: 171
title: "Service Instance 多 Session 与并发模型设计"
status: open
labels:
  - architecture
  - discussion
  - "priority:P1"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues:
  - 153
  - 135
  - 47
relatedFiles:
  - packages/shared/src/types/agent.types.ts
  - packages/shared/src/types/template.types.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/hooks/action-runner.ts
  - docs/design/event-system-unified-design.md
taskRef: null
githubRef: null
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0153-instance-interaction-archetype]], [[0135-workflow-as-hook-package]]
**Related Files**: `packages/shared/src/types/agent.types.ts`, `packages/core/src/manager/agent-manager.ts`
**需求来源**: `docs/design/event-system-unified-design.md` §4.2 / §D7

---

## 背景

统一事件系统设计（#135 延伸）明确了 **Archetype 决定执行策略**：

| Archetype | 执行策略 | Session 模型 |
|-----------|---------|-------------|
| tool | 直接执行，调用方同步等待 | 单 session |
| employee | TaskQueue 串行排队 | 单 session |
| **service** | **并发执行** | **多 session？** |

Employee 和 Tool 的 session 模型已明确（单 session，串行或按需），但 **Service Instance 的并发模型尚未定义**。

## 需要讨论的问题

### 1. Service Instance 接收指令时是否默认多 session？

当前 AcpConnectionManager 对每个 agent 维护一个 primary session。Service 型 Agent 面向多客户端，如果所有请求共享同一 session，则仍然是串行的 —— 与 Service 的"并发服务"语义矛盾。

选项：

- **A) 每请求创建新 session**: 天然并发，但资源开销大（每个 session 可能对应一个 LLM context）
- **B) Session 池**: 预创建 N 个 session，请求到来时分配空闲 session。并发度有上限
- **C) 单 session + 内部排队**: 与 employee 相同，但语义上仍标记为 service
- **D) 混合**: 默认单 session，配置 `maxConcurrentSessions` 可选开启多 session

### 2. 并发 session 的资源限制

如果选择多 session（A 或 B），需要考虑：

- 每个 session 的 LLM context 占用内存/token
- ACP backend 是否支持同一进程内多 session（Claude Code 支持 `newSession()`）
- 最大并发 session 数的默认值和配置方式
- Session 超时和回收策略

### 3. Instance 管理扩展

Service 多 session 模型对 Instance 管理有以下影响：

- `AgentInstanceMeta` 是否需要记录当前活跃 session 数？
- `agent status` 是否需要显示 session 列表和各 session 状态？
- `agent stop` 时是否需要 graceful drain（等待所有 session 完成）？
- `process:crash` 时多个 session 同时失效的处理逻辑

### 4. 与事件系统的关系

在统一事件系统中，当 ActionRunner 处理 `{ type: "agent", target: "service-agent" }` 动作时：

- 是创建新 session 还是复用现有 session？
- 如果多个 hook 同时触发 agent 动作指向同一个 service，是否并行执行？
- Service 的 `prompt:before` / `prompt:after` 事件是否需要携带 sessionId 以区分？

## 提议的初步方案

采用 **选项 D (混合)**，具体为：

1. Service Instance 默认单 session（行为与现有一致，零破坏性）
2. Template 可配置 `concurrency: { maxSessions: N }`，开启后走 session 池
3. ActionRunner 在执行 agent 动作时检查 target archetype：
   - `employee` → TaskQueue (串行)
   - `service` + `maxSessions > 1` → session pool (并发)
   - `service` + `maxSessions == 1` → 直接 prompt (与 tool 类似)
   - `tool` → 直接 prompt

4. `AgentInstanceMeta` 增加 `activeSessions?: number` 可选字段

## 验收标准

- [ ] 明确 Service Instance 的 session 模型选型
- [ ] 定义 `concurrency` 配置字段的 schema
- [ ] 设计 session 池化 / 回收策略
- [ ] 更新 `agent.types.ts` 和 `template.types.ts`
- [ ] 在 event-system-unified-design.md 中记录决策

## 依赖

- #153 Instance Interaction Archetype（archetype 字段已实现）
- #135 Workflow as Hook Package（事件系统设计）
