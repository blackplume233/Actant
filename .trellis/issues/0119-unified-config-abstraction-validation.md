---
id: 119
title: "统一配置抽象：AgentTemplate 继承 VersionedComponent + 全局配置校验体系"
status: open
labels:
  - architecture
  - enhancement
  - core
  - "priority:P1"
milestone: phase-3
author: cursor-agent
assignees:
  - cursor-agent
relatedIssues:
  - 106
  - 14
  - 40
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/shared/src/types/domain-component.types.ts
  - packages/shared/src/errors/config-errors.ts
  - packages/core/src/template/schema/template-schema.ts
  - packages/core/src/template/loader/template-loader.ts
  - packages/core/src/template/registry/template-registry.ts
  - packages/core/src/domain/base-component-manager.ts
  - packages/api/src/handlers/template-handlers.ts
taskRef: 02-23-unified-config-abstraction
githubRef: "blackplume233/Actant#119"
closedAs: null
createdAt: 2026-02-23
updatedAt: 2026-02-23
closedAt: null
---

**Related Issues**: [[0106-shareable-component-versioning]]
**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/domain/base-component-manager.ts`

---

## 目标

将 AgentTemplate 和 Domain Context 组件统一到 VersionedComponent 继承体系下，引入通用的 ConfigValidationResult 校验结果类型。

详见 GitHub Issue: https://github.com/blackplume233/Actant/issues/119
