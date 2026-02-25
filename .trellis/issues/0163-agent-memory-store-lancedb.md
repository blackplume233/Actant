---
id: 163
title: "@agent-memory/store-lancedb — LanceDB 嵌入式向量存储实现"
status: open
labels:
  - memory
  - feature
  - "priority:P1"
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 162
  - 164
relatedFiles:
  - packages/memory/store-lancedb/src/lance-store.ts
  - packages/memory/store-lancedb/src/lance-schema.ts
taskRef: null
githubRef: null
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0162-agent-memory-core-package]], [[0164-agent-memory-embedding]]
**Related Files**: `packages/memory/store-lancedb/`

---

## 目标

实现 `@agent-memory/core` 的 `MemoryStore` 接口，基于 LanceDB 嵌入式向量数据库。

LanceDB 是唯一实际引入的外部依赖 (~289KB, Node.js 原生, 嵌入式零运维)。

## 核心内容

- `LanceStore implements MemoryStore` — recall/navigate/browse 三种检索
- `lance-schema.ts` — LanceDB 表结构定义 (对应 MemoryRecord)
- `export-import.ts` — 记忆导出/导入 (支持 Template 记忆共享 #167)
- 向量 + 元数据过滤 + 全文混合检索

## 依赖

- #162 @agent-memory/core (MemoryStore 接口)
- #164 @agent-memory/embedding (Embedding 客户端)
- 外部: `@lancedb/lancedb` npm 包

## 被依赖

- #165 @actant/memory MemoryPlugin

## 验收标准

- [ ] LanceStore 完整实现 recall/navigate/browse
- [ ] 向量检索 + 元数据过滤正确
- [ ] 导出/导入功能可用
- [ ] 集成测试覆盖
