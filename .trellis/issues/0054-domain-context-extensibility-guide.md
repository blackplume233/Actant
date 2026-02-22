---
id: 54
title: "DomainContext 类型扩展缺乏指导文档与框架级支持"
status: open
labels:
  - enhancement
  - documentation
  - architecture
  - domain
  - "priority:P1"
milestone: phase-3
author: human
assignees: []
relatedIssues:
  - 52
  - 53
relatedFiles:
  - packages/shared/src/types/domain-context.types.ts
  - packages/shared/src/types/domain-component.types.ts
  - packages/shared/src/types/index.ts
  - packages/core/src/template/schema/template-schema.ts
  - packages/core/src/builder/workspace-builder.ts
  - packages/core/src/builder/backend-builder.ts
  - packages/core/src/builder/cursor-builder.ts
  - packages/core/src/builder/claude-code-builder.ts
  - packages/core/src/initializer/context/context-materializer.ts
taskRef: null
githubRef: null
closedAs: null
createdAt: 2026-02-22T00:00:00
updatedAt: 2026-02-22T00:00:00
closedAt: null
---

**Related Issues**: [[0052-shareable-agent-template-source]], [[0053-shareable-component-versioning]]
**Related Files**: `packages/shared/src/types/domain-context.types.ts`, `packages/shared/src/types/domain-component.types.ts`, `packages/shared/src/types/index.ts`, `packages/core/src/template/schema/template-schema.ts`, `packages/core/src/builder/workspace-builder.ts`, `packages/core/src/builder/backend-builder.ts`, `packages/core/src/builder/cursor-builder.ts`, `packages/core/src/builder/claude-code-builder.ts`, `packages/core/src/initializer/context/context-materializer.ts`

---

## 问题

`DomainContextConfig` 当前包含 6 种组件类型（skills、prompts、mcpServers、workflow、subAgents、plugins），但随着项目演进（如 #52 引入 AgentTemplate 共享、#53 引入版本控制），**未来很可能需要扩展新的组件类型**（如 datasets、knowledgeBases、hooks、environments 等）。

当前的问题在于：

1. **缺乏扩展指导文档** — 没有任何文档说明"要新增一种 DomainContext 组件类型需要改动哪些文件、遵循什么约定"
2. **新增类型的影响面散布广泛** — 每新增一种类型，至少要同步修改 6+ 个位置，且没有 checklist
3. **框架层面缺乏扩展性抽象** — `WorkspaceBuilder.resolveDomainContext()` 和 `ContextMaterializer.materialize()` 都用硬编码的 if 分支处理每种类型，新增类型必须修改核心逻辑
4. **Schema 与 Types 手动同步** — `DomainContextConfig`（types）和 `DomainContextSchema`（zod schema）需要手动保持一致，容易遗漏
5. **BackendBuilder 接口膨胀** — 每种类型对应一个 `materializeXxx()` 方法，新增类型意味着所有 BackendBuilder 实现都要新增方法

## 当前新增类型需要修改的文件清单

假设要新增一种 `datasets` 类型，目前需要修改：

| # | 文件 | 修改内容 |
|---|------|----------|
| 1 | `packages/shared/src/types/domain-context.types.ts` | `DomainContextConfig` 新增 `datasets?: string[]` |
| 2 | `packages/shared/src/types/domain-component.types.ts` | 新增 `DatasetDefinition` 接口 |
| 3 | `packages/shared/src/types/index.ts` | 导出新类型 |
| 4 | `packages/core/src/template/schema/template-schema.ts` | `DomainContextSchema` 新增 datasets 字段 |
| 5 | `packages/core/src/domain/` | 新增 `dataset/dataset-manager.ts` |
| 6 | `packages/core/src/builder/workspace-builder.ts` | `DomainManagers` 新增 datasets、`resolveDomainContext()` 新增解析分支、`build()` 新增 materialize 分支 |
| 7 | `packages/core/src/builder/backend-builder.ts` | `BackendBuilder` 接口新增 `materializeDatasets()` |
| 8 | `packages/core/src/builder/cursor-builder.ts` | 实现 `materializeDatasets()` |
| 9 | `packages/core/src/builder/claude-code-builder.ts` | 实现 `materializeDatasets()` |
| 10 | `packages/core/src/initializer/context/context-materializer.ts` | 新增 `materializeDatasets()` 分支（兼容旧路径） |
| 11 | 对应的测试文件 | 至少 3-4 个测试文件需要更新 |

这个过程容易遗漏，且没有任何自动化检查。

## 提议方案

### 一、编写扩展指导文档（Documentation）

在 `.trellis/spec/` 或 `docs/design/` 下创建 `domain-context-extension-guide.md`，内容包含：

1. **组件类型的概念定义** — 什么是 DomainContext 组件类型，它的生命周期（定义 → 注册 → 解析 → 物化）
2. **新增类型的 Step-by-step Checklist** — 列出上述所有需要修改的文件和修改方式
3. **命名约定** — 类型名、Manager 类名、materialize 方法名、文件路径的命名规则
4. **测试覆盖要求** — 新类型至少需要哪些测试
5. **Schema 同步规则** — 如何保证 TypeScript 类型与 Zod schema 一致

### 二、框架级扩展性重构（Architecture）

#### 2.1 引入 ComponentTypeHandler 注册模式

将每种组件类型的处理逻辑封装为一个 handler，通过注册而非硬编码的 if 分支来扩展：

```typescript
interface ComponentTypeHandler<TDef> {
  /** 在 DomainContextConfig 中对应的字段名 */
  contextKey: keyof DomainContextConfig;
  /** 从名称列表解析为定义列表 */
  resolve(names: string[], manager?: unknown): TDef[];
  /** 将定义物化到工作区 */
  materialize(workspaceDir: string, definitions: TDef[], backendType: AgentBackendType): Promise<void>;
}
```

#### 2.2 WorkspaceBuilder 改为注册驱动

```typescript
class WorkspaceBuilder {
  private readonly handlers = new Map<string, ComponentTypeHandler<unknown>>();

  registerHandler(handler: ComponentTypeHandler<unknown>): void {
    this.handlers.set(handler.contextKey, handler);
  }

  async build(workspaceDir: string, domainContext: DomainContextConfig, ...) {
    for (const [key, handler] of this.handlers) {
      const refs = domainContext[key as keyof DomainContextConfig];
      if (refs && (Array.isArray(refs) ? refs.length > 0 : true)) {
        const definitions = handler.resolve(refs, this.managers?.[key]);
        await handler.materialize(workspaceDir, definitions, backendType);
      }
    }
  }
}
```

#### 2.3 BackendBuilder 接口改为通用 materialize

```typescript
interface BackendBuilder {
  backendType: AgentBackendType;
  scaffold(workspaceDir: string): Promise<void>;
  materialize(workspaceDir: string, componentType: string, definitions: unknown[]): Promise<void>;
  injectPermissions(workspaceDir: string, mcpServers: McpServerDefinition[]): Promise<void>;
  verify(workspaceDir: string): Promise<VerifyResult>;
}
```

或保留类型安全版本，使用 visitor 模式让各 Builder 实现自己关心的类型。

#### 2.4 DomainContextConfig 支持 extensions

```typescript
export interface DomainContextConfig {
  skills?: string[];
  prompts?: string[];
  mcpServers?: McpServerRef[];
  workflow?: string;
  subAgents?: string[];
  plugins?: string[];
  /** 扩展点：自定义组件类型 */
  extensions?: Record<string, unknown[]>;
}
```

这样第三方或后续内置类型可以先通过 extensions 试验，再逐步晋升为一等公民。

## 实施优先级

| 优先级 | 内容 | 复杂度 |
|--------|------|--------|
| P0 | 编写扩展指导文档（Checklist 和命名约定） | 低 |
| P1 | DomainContextConfig 新增 `extensions` 扩展字段 | 低 |
| P1 | 引入 ComponentTypeHandler 注册模式，重构 WorkspaceBuilder | 中 |
| P2 | 将现有 6 种类型迁移为注册式 handler | 中 |
| P2 | BackendBuilder 接口泛化 | 中 |
| P3 | Schema 自动生成或校验机制（确保 types ↔ zod 同步） | 高 |

## 验收标准

### 文档层

- [ ] 存在 `domain-context-extension-guide.md` 指导文档
- [ ] 文档包含完整的新增类型 Step-by-step Checklist（至少覆盖上述 11 个修改点）
- [ ] 文档包含命名约定和测试要求

### 框架层

- [ ] `DomainContextConfig` 支持 `extensions` 扩展字段
- [ ] `DomainContextSchema` 同步支持 extensions 验证（passthrough 或显式 schema）
- [ ] WorkspaceBuilder 支持通过 `registerHandler()` 注册新的组件类型处理器
- [ ] 现有内置类型仍正常工作（不因重构而回归）
- [ ] 新增一种类型时，核心代码（WorkspaceBuilder、BackendBuilder）不需要修改，只需注册 handler

### 测试层

- [ ] 扩展注册模式有单元测试
- [ ] 至少有一个示例 handler 验证扩展流程可行
- [ ] 现有 workspace-builder.test.ts 和 context-materializer.test.ts 不因重构而失败
