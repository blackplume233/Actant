# 功能：可扩展架构（ComponentTypeHandler）

> Actant 的组件系统采用注册式架构——添加新的组件类型不需要修改核心代码，只需实现一个 Handler 并注册即可。

---

## 这个功能做什么

Actant 内置了 5 种组件类型（Skills、Prompts、MCP Servers、Workflow、Plugins），但业务需求可能需要更多类型（如 Datasets、Models、Configs 等）。ComponentTypeHandler 注册模式让用户和开发者可以添加自定义组件类型，而不需要修改 `WorkspaceBuilder` 或其他核心代码。

**一句话总结**：像插件一样添加新的组件类型，零侵入核心代码。

---

## 架构设计

### Handler 接口

每种组件类型都实现 `ComponentTypeHandler<T>` 接口：

```typescript
interface ComponentTypeHandler<TDef = unknown> {
  readonly contextKey: string;
  resolve(refs: unknown, manager?: BaseComponentManager<NamedComponent>): TDef[];
  materialize(
    workspaceDir: string,
    definitions: TDef[],
    backendType: AgentBackendType,
    backendBuilder: unknown
  ): Promise<void>;
}
```

| 方法 | 职责 |
|------|------|
| `contextKey` | 对应 DomainContext 中的字段名（如 `"skills"`） |
| `resolve` | 将名称引用解析为完整的组件定义 |
| `materialize` | 将组件定义写入 Agent 工作区 |

### 四阶段生命周期

```
Define（定义）→ Register（注册）→ Resolve（解析）→ Materialize（物化）
```

1. **Define**：TypeScript 接口 + Zod Schema
2. **Register**：Manager 启动时从 `configs/{type}/` 加载
3. **Resolve**：模板中的名称引用被 Handler 解析为完整定义
4. **Materialize**：BackendBuilder 按后端类型写入工作区文件

---

## 使用场景

### 场景：添加 "Dataset" 组件类型

假设你想为 Agent 添加数据集支持，让 Agent 可以引用和访问预定义的数据集。

#### 步骤 1：定义接口

```typescript
// packages/shared/src/types/domain-component.types.ts
export interface DatasetDefinition extends VersionedComponent {
  source: string;
  format?: "json" | "csv" | "jsonl";
}
```

#### 步骤 2：添加到 DomainContextConfig

```typescript
// packages/shared/src/types/domain-context.types.ts
export interface DomainContextConfig {
  skills?: string[];
  prompts?: string[];
  // ...existing fields
  datasets?: string[];  // 新增
}
```

#### 步骤 3：添加 Zod Schema

```typescript
// packages/core/src/template/schema/template-schema.ts
export const DomainContextSchema = z.object({
  // ...existing fields
  datasets: z.array(z.string()).optional().default([]),
});
```

#### 步骤 4：创建 Manager

```typescript
// packages/core/src/domain/dataset/dataset-manager.ts
export class DatasetManager extends BaseComponentManager<DatasetDefinition> {
  protected readonly componentType = "Dataset";
  constructor() { super("dataset-manager"); }
  validate(data: unknown, source: string): DatasetDefinition { /* Zod 校验 */ }
}
```

#### 步骤 5：创建 Handler

```typescript
// packages/core/src/builder/handlers/datasets-handler.ts
export const datasetsHandler: ComponentTypeHandler<DatasetDefinition> = {
  contextKey: "datasets",
  resolve(refs, manager) {
    if (!refs || !Array.isArray(refs) || refs.length === 0) return [];
    return manager!.resolve(refs as string[]) as DatasetDefinition[];
  },
  async materialize(workspaceDir, definitions, _backendType, builder) {
    await (builder as BackendBuilder).materializeDatasets(workspaceDir, definitions);
  },
};
```

#### 步骤 6：注册 Handler

```typescript
workspaceBuilder.registerHandler(datasetsHandler);
```

完成后，模板中就可以引用 datasets：

```json
{
  "domainContext": {
    "skills": ["code-review"],
    "datasets": ["my-dataset"]
  }
}
```

---

## Extensions 扩展点

对于实验性或非标准的组件类型，可以使用 `DomainContextConfig.extensions` 字段，无需修改 shared 类型定义：

```json
{
  "domainContext": {
    "skills": ["code-review"],
    "extensions": {
      "datasets": ["experimental-dataset"],
      "configs": ["custom-config"]
    }
  }
}
```

只要注册了对应 `contextKey` 的 Handler，WorkspaceBuilder 就会自动处理。

---

## 命名规范

| 概念 | 命名规范 | 示例 |
|------|---------|------|
| 类型接口 | `{Type}Definition` | `DatasetDefinition` |
| Manager 类 | `{Type}Manager` | `DatasetManager` |
| Manager 目录 | `packages/core/src/domain/{type}/` | `domain/dataset/` |
| Config 字段 | camelCase 复数 | `datasets` |
| BackendBuilder 方法 | `materialize{Types}` | `materializeDatasets` |
| Config 目录 | `configs/{types}/` | `configs/datasets/` |

---

## 内置 Handler

Actant 自带 5 个 Handler，位于 `packages/core/src/builder/handlers/`：

| Handler | contextKey | 物化行为 |
|---------|-----------|---------|
| `skills-handler` | `skills` | 写入 Cursor Rules / AGENTS.md |
| `prompts-handler` | `prompts` | 写入提示词文件 |
| `mcp-handler` | `mcpServers` | 写入 MCP 配置 |
| `workflow-handler` | `workflow` | 写入工作流文档 |
| `plugins-handler` | `plugins` | 写入插件配置 |

---

## 验证示例

作为现有功能的验证，可以确认内置 Handler 正常工作：

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 创建 Agent（触发所有 Handler 的 resolve + materialize）
actant agent create handler-test -t code-review-agent

# 3. 检查工作区中的物化结果
actant agent status handler-test
# 查看工作区目录，确认 skills、prompts 等已正确物化

# 4. 验证组件引用
actant skill list handler-test
# 预期: 显示 code-review、typescript-expert

actant prompt list handler-test
# 预期: 显示 system-code-reviewer

# 5. 清理
actant agent destroy handler-test --force
actant daemon stop
```

自定义 Handler 的验证需要在源码级别进行单元测试：

```bash
# 运行 workspace builder 测试
pnpm --filter @actant/core test workspace-builder

# 运行 context materializer 测试
pnpm --filter @actant/core test context-materializer
```

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [DomainContext 扩展指南](../../design/domain-context-extension-guide.md) | 完整的 11 步添加指南 |
| [领域上下文拼装](domain-context.md) | 5 类内置组件的使用说明 |
| [Agent 模板系统](agent-template.md) | 模板中如何引用组件 |
