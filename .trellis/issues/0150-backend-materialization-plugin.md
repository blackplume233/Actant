---
id: 150
title: "RFC: Backend Materialization Plugin System"
status: open
labels:
  - rfc
  - architecture
  - core
  - "priority:P1"
milestone: null
author: blackplume233
assignees: []
relatedIssues:
  - 141
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/builder/workspace-builder.ts
  - packages/core/src/builder/backend-builder.ts
  - packages/core/src/builder/cursor-builder.ts
  - packages/core/src/builder/claude-code-builder.ts
  - packages/core/src/builder/custom-builder.ts
  - packages/core/src/domain/backend/backend-manager.ts
  - packages/core/src/manager/launcher/builtin-backends.ts
  - packages/pi/src/pi-builder.ts
  - .trellis/spec/config-spec.md
taskRef: null
githubRef: "blackplume233/Actant#150"
closedAs: null
createdAt: 2026-02-24T00:00:00
updatedAt: 2026-02-24T00:00:00
closedAt: null
---

**Related Issues**: [[0141-model-provider-registry]]
**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/builder/`, `packages/core/src/domain/backend/backend-manager.ts`, `packages/pi/src/pi-builder.ts`

---

## 背景

当前 Agent 后端的物化（materialization）逻辑分散在独立的 `BackendBuilder` 实现类中（`CursorBuilder`、`ClaudeCodeBuilder`、`PiBuilder`、`CustomBuilder`），而 `BackendDefinition` 仅描述运行时启动配置，完全没有物化流程的描述。

新增后端必须手写 Builder 类并硬编码注册；用户自定义后端无法声明物化逻辑。

## 方案

Phase 1: MaterializationSpec 声明式物化描述模型
Phase 2: MaterializationPlugin 插件式执行器
Phase 3: WorkspaceBuilder 动态加载

## 验收标准

- [ ] BackendDefinition 增加 materialization? 和 materializationPlugin? 字段
- [ ] 现有 4 个 Builder 的物化行为可通过 MaterializationSpec 声明式描述
- [ ] 新增 DeclarativeBuilder：基于 MaterializationSpec 自动执行物化
- [ ] WorkspaceBuilder 支持从 BackendManager 动态解析 builder
- [ ] materializationPlugin 支持从外部文件/npm 包动态加载自定义 Builder
- [ ] 用户可通过 configs/backends/ 注册包含物化描述的自定义后端
- [ ] 单元测试覆盖所有物化策略组合
- [ ] 文档更新
