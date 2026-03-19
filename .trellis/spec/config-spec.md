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

V1 内置 Source 及其最小配置职责：

| Source | 路径 | 配置职责 |
|------|------|------|
| `SkillSource` | `/skills/*` | 声明技能文件来源与可写策略 |
| `McpConfigSource` | `/mcp/configs/*` | 声明 MCP 静态配置来源 |
| `McpRuntimeSource` | `/mcp/runtime/*` | 运行时来源，无需复杂静态配置 |
| `AgentRuntime` | `/agents/*` | 运行时来源，无需复杂静态配置 |

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
