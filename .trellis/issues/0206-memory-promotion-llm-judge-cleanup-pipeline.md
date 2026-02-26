---
id: 206
title: "RFC: Memory Promotion 清洗层 — LLM-as-Judge 知识验证管道"
status: open
labels:
  - rfc
  - architecture
  - memory
  - "priority:P2"
milestone: null
author: human
assignees: []
relatedIssues:
  - 189
  - 192
  - 188
  - 185
  - 205
  - 207
relatedFiles:
  - packages/core/src/manager/agent-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#206"
closedAs: null
createdAt: 2026-02-26T22:00:00
updatedAt: 2026-02-26T22:00:00
closedAt: null
---

**Related Issues**: [[0166-template-layer-promote]], [[0169-actant-layer-curator-agent]], [[0165-memory-plugin-instance-layer]], [[0162-agent-memory-core-package]], [[0205-stateless-agent-distributed-state-server]], [[0207-agent-token-budget-circuit-breaker]]
**Related Files**: `packages/core/src/manager/agent-manager.ts`

---

## 背景

Actant 的 Memory 系统（#185–#192）正在构建 Instance → Template → Global 三层记忆跃迁架构。当单个 Agent 的运行时经验（Memory）被提升为团队共享知识时，类似于合并代码分支——但由于大模型的幻觉特性，Agent 可能总结出**错误的"经验"**，一旦 Promote 至全局 Context 将污染所有下游 Agent。

## 核心问题

1. **幻觉经验传播**：Agent A 在任务中总结了错误模式，Promote 后被 Agent B/C 采纳，形成级联错误
2. **缺乏回归验证**：没有自动化手段验证"合并一条经验"是否会降低其他 Agent 的准确率
3. **无法回滚**：一旦全局 Context 被污染，缺少自动回退机制

## 方案

在 Memory Promotion 链路中引入**自动化清洗层**：LLM-as-Judge 评估流 + 沙箱回归测试 + 一致性校验。

详见 GitHub Issue body：https://github.com/blackplume233/Actant/issues/206

---

## Comments

### cursor-agent — 2026-02-26T22:00:00

本 Issue 为系统优化建议，与 [[0205-stateless-agent-distributed-state-server]] 和 [[0207-agent-token-budget-circuit-breaker]] 同属"Actant 深层架构挑战"系列 RFC。三者共同构成将 Actant 从单机开发工具推进到生产级多 Agent 平台的关键优化路径。
