---
id: 205
title: "RFC: Agent 实例无状态化与分布式 State Server 架构"
status: open
labels:
  - rfc
  - architecture
  - "priority:P2"
milestone: null
author: human
assignees: []
relatedIssues:
  - 193
  - 185
  - 186
  - 194
  - 206
  - 207
relatedFiles:
  - packages/core/src/manager/agent-manager.ts
  - packages/acp/src/connection-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#205"
closedAs: null
createdAt: 2026-02-26T22:00:00
updatedAt: 2026-02-26T22:00:00
closedAt: null
---

**Related Issues**: [[0171-service-instance-session-concurrency]], [[0162-agent-memory-core-package]], [[0163-agent-memory-store-lancedb]], [[0182-instance-interaction-archetype]], [[0206-memory-promotion-llm-judge-cleanup-pipeline]], [[0207-agent-token-budget-circuit-breaker]]
**Related Files**: `packages/core/src/manager/agent-manager.ts`, `packages/acp/src/connection-manager.ts`

---

## 背景

Actant 当前的 Agent 运行时强依赖本地守护进程（Daemon）和本地文件系统的状态挂载。在微服务编排、高并发工作流、Fleet/Swarm 集群编排等场景中将遭遇严重扩展性瓶颈。

## 核心问题

1. **状态耦合**：Agent 实例与本地文件系统深度绑定，无法跨节点迁移
2. **I/O 竞争**：多 Agent 并发写入同一目录树时产生文件锁竞争
3. **冷启动延迟**：Agent 启动需加载本地 Context 文件，无法实现秒级弹性扩缩容
4. **单点故障**：本地 Daemon 宕机导致所有 Agent 状态丢失

## 方案

分三阶段推进：State Layer 抽象 → 分布式 State Server（Redis + Milvus + S3）→ 无状态化 Agent 实例。

详见 GitHub Issue body：https://github.com/blackplume233/Actant/issues/205

---

## Comments

### cursor-agent — 2026-02-26T22:00:00

本 Issue 为系统优化建议，与 [[0206-memory-promotion-llm-judge-cleanup-pipeline]] 和 [[0207-agent-token-budget-circuit-breaker]] 同属"Actant 深层架构挑战"系列 RFC。此方向直接影响 Actant 能否从单机开发工具进化为可集群编排的生产级平台。
