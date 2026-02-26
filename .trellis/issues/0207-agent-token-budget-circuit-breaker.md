---
id: 207
title: "RFC: Agent 级 Token 预算熔断机制与可观测性网关"
status: open
labels:
  - rfc
  - architecture
  - "priority:P2"
milestone: null
author: human
assignees: []
relatedIssues:
  - 194
  - 193
  - 200
  - 205
  - 206
relatedFiles:
  - packages/core/src/manager/agent-manager.ts
  - packages/acp/src/connection-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#207"
closedAs: null
createdAt: 2026-02-26T22:00:00
updatedAt: 2026-02-26T22:00:00
closedAt: null
---

**Related Issues**: [[0182-instance-interaction-archetype]], [[0171-service-instance-session-concurrency]], [[0205-stateless-agent-distributed-state-server]], [[0206-memory-promotion-llm-judge-cleanup-pipeline]]
**Related Files**: `packages/core/src/manager/agent-manager.ts`, `packages/acp/src/connection-manager.ts`

---

## 背景

Actant 的 Agent 底层对接 Claude/Cursor 等 LLM 运行时。Agent 的自主迭代行为极易引发不可控的 Token 消耗：无限重试、死循环调用、长尾任务等场景下缺乏 Agent 级别的流量控制和 Token 消耗可观测性。

## 核心问题

1. **无预算约束**：单个 Agent Instance 的 Token 消耗无上限
2. **无调用深度限制**：Agent 链式调用可无限嵌套
3. **缺乏可观测性**：无法追踪单次任务的 Token 消耗分布
4. **无熔断机制**：异常消耗无法自动阻断
5. **无优先级调度**：关键任务可能被低优先级任务抢占 Token 预算

## 方案

在 Daemon 与底层 LLM API 之间嵌入 Agent 级 API 网关（Token Gateway），集成 Budget Circuit Breaker、Call Depth Limiter、Rate Limiter、Priority Queue、Telemetry Collector 五大核心机制。

详见 GitHub Issue body：https://github.com/blackplume233/Actant/issues/207

---

## Comments

### cursor-agent — 2026-02-26T22:00:00

本 Issue 为系统优化建议，与 [[0206-memory-promotion-llm-judge-cleanup-pipeline]] 和 [[0205-stateless-agent-distributed-state-server]] 同属"Actant 深层架构挑战"系列 RFC。Token 经济学治理是 Agent 系统从实验走向生产的必要基础设施。
