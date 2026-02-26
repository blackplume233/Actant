---
id: 166
title: "Template Layer + 自审查 Promote 机制 (替代 #11)"
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
  - 11
  - 165
  - 167
  - 169
relatedFiles:
  - packages/actant-memory/src/layers/template-layer.ts
  - packages/actant-memory/src/lifecycle/promoter.ts
taskRef: null
githubRef: "blackplume233/Actant#189"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0011-memory-consolidation-shared-memory-phase-2]], [[0165-memory-plugin-instance-layer]], [[0167-template-memory-sharing]], [[0169-actant-layer-curator-agent]]
**Related Files**: `packages/actant-memory/src/layers/template-layer.ts`

---

## 目标

新增 Template Layer（原设计中缺失的关键中间层），让同一 Template 的所有 Instance 共享模板级经验。实现自审查 Promote: Instance → Template。

替代原 #11 的扁平 Shared Memory 方案，引入 Template 这个自然中间层。

## 核心设计

### Template Layer

- 存储路径: `~/.actant/templates/{templateName}/memory/lance/`
- URI 命名空间: `ac://templates/{templateName}/practices/`, `ac://templates/{templateName}/errors/`
- 物化时注入: 新 Instance 启动自动继承模板记忆

### 自审查 Promote (Instance → Template)

Instance Agent 在 session:end 自反思，输出 promoteScore + 提名理由。

**Promote 条件:**
- `promoteScore > 0.7`
- 同 Template 下 2+ Instance 的提名中出现**语义相似**记忆

**两种实现:**
- Phase 1: 规则引擎 — 基于 confidence + 出现频次自动提名
- Phase 2: LLM 辅助 — Agent 对 session 产出做自反思

### Template Layer 凝练

定期 (cron/手动) 将碎片 promote 记忆凝练为 template-level insights.md。

## 依赖

- #165 MemoryPlugin Instance Layer

## 被依赖

- #167 Template 记忆共享
- #169 Actant Layer + Curator Agent

## 验收标准

- [ ] Template Layer 存储和读写正常
- [ ] 自审查 Promote 流程: Instance → Template
- [ ] Promote 条件判断 (相似度 + 频次) 正确
- [ ] 新 Instance 创建时自动继承 Template 记忆
- [ ] 定期凝练生成 template insights
- [ ] CLI: `actant memory promote --template {name}`
