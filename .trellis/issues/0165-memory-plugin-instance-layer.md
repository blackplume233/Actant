---
id: 165
title: "@actant/memory MemoryPlugin — Instance Layer 实现 (替代 #10)"
status: open
labels:
  - core
  - memory
  - feature
  - "priority:P1"
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 10
  - 14
  - 161
  - 162
  - 163
  - 164
  - 166
relatedFiles:
  - packages/actant-memory/src/layers/instance-layer.ts
  - packages/actant-memory/src/extractor/rule-based.ts
  - packages/actant-memory/src/hooks/memory-hooks.ts
taskRef: null
githubRef: "blackplume233/Actant#188"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0010-instance-memory-layer-phase-1]], [[0014-plugin-heartbeat-scheduler-memory]], [[0161-plugin-appcontext-integration]], [[0162-agent-memory-core-package]], [[0163-agent-memory-store-lancedb]], [[0164-agent-memory-embedding]], [[0166-template-layer-promote]]
**Related Files**: `packages/actant-memory/`

---

## 目标

以 Plugin 形式实现 Actant Instance Layer 记忆。替代原 #10 的 JSON 文件方案，使用融合设计（LanceDB 存储 + L0/L1/L2 分层 + 树状索引）。

## 核心内容

### MemoryPlugin (ActantPlugin)

- scope: `"actant"` (全局单例，管理所有 instance 的记忆)
- 绑定 HookEventBus 事件:
  - `session:end` → 提取 session 记忆到 Instance Layer
  - `process:start` → 预加载 Instance 记忆到 session
  - `agent:created` → 初始化 instance 记忆空间
  - `agent:destroyed` → 归档 instance 记忆

### Session Extractor (规则引擎, Phase 1)

- 从 git diff / commit messages / error logs 提取结构化记忆
- 自动生成 L0 摘要和 L1 概览
- 归入 URI 树 (`ac://instances/{name}/tasks/...`)

### Instance Layer 读写

- 存储路径: `instances/{name}/.memory/lance/`
- 读取: recall/navigate/browse 三种模式
- 兼容: 无 .memory/ 时行为与当前完全一致

### ContextBroker (简化版)

- materialize 时合并 Template 静态内容 + Instance 记忆
- 写入 AGENTS.md 的 Instance Insights 部分

## 依赖

- #14 Plugin 体系 (ActantPlugin 接口)
- #161 Plugin AppContext 集成 (PluginHost 已接入)
- #162 @agent-memory/core
- #163 @agent-memory/store-lancedb
- #164 @agent-memory/embedding

## 被依赖

- #166 Template Layer + 自审查 Promote
- #167 Template 记忆共享

## 验收标准

- [ ] MemoryPlugin 实现 ActantPlugin 接口
- [ ] session:end 自动提取记忆到 Instance Layer
- [ ] Agent 第二次启动时 AGENTS.md 包含第一次 session 的 insights
- [ ] 无 memory 时行为与当前完全一致
- [ ] 集成测试覆盖端到端流程
