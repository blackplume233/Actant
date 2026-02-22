---
id: 47
title: WorkspaceBuilder Pipeline + AgentInitializer 迁移
status: closed
labels:
  - feature
  - architecture
  - "priority:P0"
  - phase3b
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 39
  - 46
relatedFiles:
  - packages/core/src/builder/workspace-builder.ts
  - packages/core/src/builder/custom-builder.ts
  - packages/core/src/initializer/agent-initializer.ts
  - packages/core/src/initializer/context/context-materializer.ts
taskRef: null
githubRef: "blackplume233/Actant#100"
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T07:59:11"
closedAt: "2026-02-22T07:59:11"
---

**Related Issues**: [[0039-session-lease-mock-untestable]], [[0046-backend-builder-implementations]]
**Related Files**: `packages/core/src/builder/workspace-builder.ts`, `packages/core/src/builder/custom-builder.ts`, `packages/core/src/initializer/agent-initializer.ts`, `packages/core/src/initializer/context/context-materializer.ts`

---

## 目标

实现 WorkspaceBuilder 编排层（6 步 pipeline），将 AgentInitializer 从 ContextMaterializer 迁移到新 Builder 体系。

## 依赖

- #46 BackendBuilder + CursorBuilder + ClaudeCodeBuilder

## 交付物

### 1. WorkspaceBuilder

```typescript
class WorkspaceBuilder {
  registerBuilder(type, builder): void;
  async build(instanceName, template, overrides?): Promise<BuildResult>;
}
```

Pipeline: resolve → validate → scaffold → materialize → inject → verify

### 2. AgentInitializer 迁移

- 注入 WorkspaceBuilder 替代 ContextMaterializer
- `createInstance()` 调用 `builder.build()`

### 3. CustomBuilder

- 通过 `builderConfig` 自定义所有路径

### 4. 清理

- ContextMaterializer 标记 @deprecated
- E2E 测试使用新 Builder 验证

## 文件路径

```
packages/core/src/builder/
  ├── workspace-builder.ts    # 编排层
  └── custom-builder.ts       # 可配置后端
```

## 验收标准

- [ ] WorkspaceBuilder pipeline 6 步完整
- [ ] AgentInitializer 迁移成功
- [ ] CustomBuilder 可配置路径
- [ ] ContextMaterializer @deprecated
- [ ] 现有 E2E 测试通过
- [ ] 新增 Builder 集成测试

---

## Comments

### cursor-agent — 2026-02-22T07:59:11

Closed as completed
