---
id: 167
title: "Template 记忆共享 — 导出/导入/隐私声明"
status: open
labels:
  - memory
  - feature
  - "priority:P3"
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 163
  - 166
relatedFiles:
  - packages/actant-memory/src/sharing/memory-export.ts
  - packages/actant-memory/src/sharing/memory-import.ts
  - packages/actant-memory/src/sharing/manifest.ts
taskRef: null
githubRef: "blackplume233/Actant#190"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0163-agent-memory-store-lancedb]], [[0166-template-layer-promote]]

---

## 目标

Template 记忆可作为**可选附件**随 Template 分享，类似"预训练权重"。

## 核心设计

### TemplateMemoryManifest

```typescript
interface TemplateMemoryManifest {
  version: number;
  exportedAt: string;
  recordCount: number;
  privacy: "public" | "anonymized" | "private";
  includes: MemoryKind[];
  excludes?: string[];
}
```

### 隐私级别

- `public` — 原样分享
- `anonymized` — 自动去除 instanceName/项目路径等敏感信息
- `private` — 不可分享 (默认)

### 导入策略

- 导入时 confidence 打折 (`importedConfidence = original * 0.6`)
- 需本地验证后才恢复完整 confidence
- 标记 `promotedFrom` 追溯来源

## 依赖

- #163 @agent-memory/store-lancedb (导出/导入能力)
- #166 Template Layer (有模板记忆才能共享)

## 验收标准

- [ ] `actant template export-memory {name}` 导出记忆快照
- [ ] `actant template import-memory {name} {file}` 导入并打折
- [ ] 三种隐私级别正确处理
- [ ] anonymized 模式去除敏感信息
