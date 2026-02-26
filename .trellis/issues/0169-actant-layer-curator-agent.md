---
id: 169
title: "Actant Layer + Memory Curator Agent (替代 #12)"
status: open
labels:
  - core
  - memory
  - feature
  - "priority:P2"
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 12
  - 165
  - 166
relatedFiles:
  - packages/actant-memory/src/layers/actant-layer.ts
  - packages/actant-memory/src/curator/curator-agent.ts
  - packages/actant-memory/src/broker/context-broker.ts
taskRef: null
githubRef: "blackplume233/Actant#192"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0012-context-layers-contextbroker-phase-3]], [[0165-memory-plugin-instance-layer]], [[0166-template-layer-promote]]
**Related Files**: `packages/actant-memory/src/layers/actant-layer.ts`, `packages/actant-memory/src/curator/`

---

## 目标

实现 Actant Layer（全局记忆）+ Memory Curator Agent（专用审查智能体）+ ContextBroker（三层统一物化）。替代原 #12 的 ContextBroker 方案，增加 Curator Agent 治理。

## 核心设计

### Actant Layer

- 存储路径: `~/.actant/memory/lance/`
- URI 命名空间: `ac://actant/user/`, `ac://actant/learnings/`
- 内容: 用户偏好 (最高优先级) + 跨 Template 验证的通用经验

### Memory Curator Agent

Template → Actant 的 Promote 需要专用 Curator Agent 参与：
- 定期 (cron:weekly 或手动) 扫描所有 Template 层记忆
- 对满足条件的候选 (3+ Template 出现) 做综合判断
- 可以**改写**记忆使其更通用，消解冲突
- 审查结果写入 Actant 层

```typescript
interface CuratorReviewInput {
  candidates: Array<{
    record: MemoryRecord;
    sourceTemplates: string[];
    instanceCount: number;
  }>;
}

interface CuratorReviewOutput {
  approved: Array<{ record: MemoryRecord; mergedL0: string; mergedL1: string }>;
  rejected: Array<{ recordId: string; reason: string }>;
}
```

### ContextBroker (三层物化)

替代 ContextMaterializer，三层并行读取 + 按优先级合并：

```
Actant Layer (用户偏好)   ← 最高优先级
Actant Layer (全局经验)   ← 次高
Template Layer            ← 模板级
Instance Layer            ← 个体经验 (最低)
```

### L0/L1/L2 分层投影 + ac:// URI 寻址 + 树状索引

完整实现融合设计的所有特性。

## 依赖

- #165 MemoryPlugin Instance Layer
- #166 Template Layer + Promote

## 验收标准

- [ ] Actant Layer 存储和读写正常
- [ ] Curator Agent 能审查 Template → Actant 候选
- [ ] Curator 可改写/消解冲突
- [ ] ContextBroker 三层并行读取 + 优先级合并
- [ ] L0/L1/L2 分层投影正确
- [ ] ac:// URI 寻址和树状导航工作
- [ ] CLI: `actant memory curate`
