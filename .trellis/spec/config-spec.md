# 配置规范 (Configuration Specification)

> 本文档定义 ContextFS V1 的配置真相。当前阶段只规范新的 ContextFS 基线，不再为旧 `ContextManager` / `DomainContext` 聚合模型背书。

---

## 1. Scope

本文件当前只定义与 ContextFS V1 直接相关的配置：

- `ProjectManifest`
- mount 声明
- permissions 声明
- child project 关系

旧模板聚合配置、旧 DomainContext 聚合配置若仍存在于代码中，当前视为历史实现遗留，不作为新的规范入口。

M1 契约替换期间，仓库中的 agent template / workspace materialization 接口统一使用 `project` 字段表达项目级资源选择。
它只表示当前 agent workspace 需要装配哪些 skills、prompts、MCP servers、plugins 等资源引用，
不重新引入旧 `DomainContext` 作为新的默认配置真相。

---

## 2. ProjectManifest

`ProjectManifest` 是 ContextFS V1 的装载与权限配置入口。

它负责：

- 声明挂载哪些 Source
- 将它们挂到哪些路径
- 定义默认权限与路径级规则
- 声明子 Project

```ts
interface ProjectManifest {
  name: string;
  mounts: MountDeclaration[];
  permissions?: PermissionConfig;
  children?: ChildProjectRef[];
}
```

---

## 3. MountDeclaration

V1 只支持 `direct mount`。

```ts
interface MountDeclaration {
  source: string;
  path: string;
  config?: Record<string, unknown>;
}
```

约束：

- `source` 指向一个已注册 Source 类型
- `path` 是该 Source 在 ContextFS 中的挂载路径
- V1 不支持 overlay/fallback/view/query mount

V1 内置路径约定：

- `/skills`
- `/mcp/configs`
- `/mcp/runtime`
- `/agents`

调用面布局约定：

```ts
interface HubMountLayout {
  workspace: string;
  config: string;
  skills: string;
  agents: string;
  mcpConfigs: string;
  mcpRuntime: string;
  mcpLegacy: string;
  prompts: string;
  workflows: string;
  templates: string;
}
```

说明：

- `mcpConfigs` 是 MCP 静态配置的标准挂载位
- `mcpRuntime` 是 MCP 运行时状态与流节点的标准挂载位
- `mcpLegacy` 只作为兼容别名保留给旧 `/mcp` 入口，不能替代 `/mcp/configs`

---

## 4. PermissionConfig

权限由 Project 边界负责。

```ts
interface PermissionConfig {
  defaults: PermissionSet;
  rules?: PermissionRule[];
}

interface PermissionSet {
  read?: boolean;
  write?: boolean;
  watch?: boolean;
  stream?: boolean;
}

interface PermissionRule {
  agent: string;
  path: string;
  read?: boolean;
  write?: boolean;
  watch?: boolean;
  stream?: boolean;
}
```

说明：

- `agent` 是 caller 身份标识
- `path` 是路径级规则匹配目标
- V1 由 Project 先做权限判定，再由 Source/Backend 判定能力是否支持

---

## 5. ChildProjectRef

```ts
interface ChildProjectRef {
  name: string;
  manifest: string;
}
```

子 Project 规则：

- 继承父 Project 的上下文边界
- 只能收窄父 Project 的可见性和权限
- 不能扩大父 Project 已声明的权限

---

## 6. Built-In Source Config Expectations

### 6.1 SourceType Registry

M5 起，所有 Source 通过 `SourceTypeRegistry` 注册。新增 Source 类型只需调用 `registry.register(definition)` —— 无需修改中心类型定义。

```ts
interface SourceTypeDefinition<TConfig = Record<string, unknown>> {
  readonly type: string;
  readonly label: string;
  readonly defaultTraits: ReadonlySet<SourceTrait>;
  readonly configSchema?: Record<string, unknown>;
  create(config: TConfig, mountPoint: string, lifecycle: VfsLifecycle): VfsSourceRegistration;
  validate?(config: TConfig): { valid: boolean; errors?: string[] };
}
```

`VfsSourceRegistration` 不再包含 `sourceType` 字段，改为：

- `label: string` — 人类可读的 Source 类型标签
- `traits: ReadonlySet<SourceTrait>` — 原子能力特征集

### 6.2 内置 Source 及其 Trait 声明

| Source | 路径 | Traits | 配置职责 |
|------|------|------|------|
| `SkillSource` | `/skills/*` | `persistent`, `writable` | 声明技能文件来源与可写策略 |
| `McpConfigSource` | `/mcp/configs/*` | `persistent`, `writable` | 声明 MCP 静态配置来源 |
| `McpRuntimeSource` | `/mcp/runtime/*` | `executable`, `streamable`, `ephemeral` | 运行时来源 |
| `AgentRuntime` | `/agents/*` | `executable`, `streamable`, `ephemeral` | 运行时来源 |

运行时 source 的最小节点结构：

- `/_catalog.json`
- `/<name>/status.json`
- `/<name>/streams/*`
- `/<name>/control/request.json`

能力约束：

- 运行时 source 至少要表达 `read/list/stat/watch`
- 流节点额外表达 `stream`
- 控制节点是否允许 `write` 由 provider 决定，但节点命名和路径必须稳定
- 权限配置中的 `watch` / `stream` 位必须与实际 capability 对齐，不能只对 `read/write` 建模

### 6.3 Trait 互斥约束

`persistent` 与 `ephemeral` 互斥 —— `SourceTypeRegistry.register()` 在注册时拒绝同时声明两者的 `SourceTypeDefinition`。

实例可以收窄（narrowing）继承的 trait 集但不可扩展。

---

## 7. `_project.json` Projection

每个 Project 在 VFS 中必须投影为 `/_project.json`。

说明：

- 它是 Project 的可读投影文件
- 它不是底层事实源
- 它用于让 Agent 和外部调用方理解当前作用域、挂载与权限边界

---

## 8. V1 Non-Goals

以下内容不进入当前配置规范：

- `workflow` 配置
- query/view mount 配置
- overlay/fallback mount 配置
- 旧 `DomainContext` 聚合配置继续扩展
- 旧 `ContextManager` 注入链配置

这些内容在进入下一阶段前不得重新写回为 V1 正式配置真相。
