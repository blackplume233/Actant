---
id: 158
title: "feat(core): Backend-aware buildProviderEnv + DeclarativeBuilder for existing backends (#141/#150)"
status: open
labels:
  - core
  - architecture
  - "priority:P1"
milestone: null
author: cursor-agent
assignees:
  - cursor-agent
relatedIssues:
  - 141
  - 150
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/domain/backend/backend-manager.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/builder/workspace-builder.ts
  - packages/core/src/builder/backend-builder.ts
  - packages/core/src/builder/cursor-builder.ts
  - packages/core/src/builder/claude-code-builder.ts
  - packages/core/src/builder/custom-builder.ts
  - packages/core/src/manager/launcher/builtin-backends.ts
  - packages/api/src/services/app-context.ts
  - packages/pi/src/pi-builder.ts
  - .trellis/spec/config-spec.md
taskRef: null
githubRef: "blackplume233/Actant#158"
closedAs: null
createdAt: 2026-02-24T00:00:00
updatedAt: 2026-02-24T00:00:00
closedAt: null
---

**Related Issues**: [[0141-model-provider-registry]], [[0150-backend-materialization-plugin]]

---

## 范围

合并 #141 Phase 2 + #150 Phase 1 实施：

1. BackendManager 扩展（buildProviderEnv + builder 注册表）
2. 各后端 buildProviderEnv 策略（Pi: ACTANT_*; Claude Code: ANTHROPIC_*）
3. MaterializationSpec 类型 + DeclarativeBuilder
4. 现有 4 后端的 MaterializationSpec 声明
5. WorkspaceBuilder 动态解析
6. 文档 + 测试
