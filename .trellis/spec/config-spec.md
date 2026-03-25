# 配置规范 (Configuration Specification)

> 本文档定义 ContextFS V1 的配置真相。
> 当前默认且唯一运行时入口是 `actant.namespace.json`。

---

## 1. Scope

本文件当前只定义与 ContextFS V1 直接相关的配置：

- `mount namespace` 声明
- `mount table` 声明
- permission 声明
- child namespace 关系

旧的资源分类配置、旧的 `Source` 配置叙事、旧的 prompt/workflow 顶层配置都不再是默认规范入口。

---

## 2. Namespace Config

`actant.namespace.json` 是 ContextFS V1 的默认配置入口。

它负责：

- 声明命名空间中挂载哪些子树
- 定义这些子树挂到哪些路径
- 指定最小的权限与子 namespace 收窄规则

最小结构：

```ts
interface ActantNamespaceConfig {
  version: 1;
  name?: string;
  description?: string;
  mounts: MountDeclaration[];
  entrypoints?: ActantNamespaceEntrypoints;
  permissions?: PermissionConfig;
  children?: ChildNamespaceRef[];
}
```

运行时规则：

- 实现层只读取 `actant.namespace.json`
- 若仓库中只存在 legacy project config，运行时必须显式报错并拒绝加载
- 不提供 `namespace migrate`；旧仓库升级由人工改写 `actant.namespace.json` 完成

---

## 3. Mount Table Declaration

V1 当前只支持 `root` 与 `direct` 两种 `mount type`，其中用户声明面只暴露 `direct`。

```ts
interface MountDeclaration {
  name?: string;
  type: "hostfs" | "runtimefs";
  path: string;
  options?: Record<string, unknown>;
}
```

当前语义解释如下：

- `name`：可选挂载实例名
- `type`：`filesystem type`
- `path`：`mount point`
- `options`：用于实例化该挂载的具体参数

配置解释约束：

- 不再把挂载声明当作内容类型声明
- `actant.namespace.json` 里的用户声明挂载只允许 `direct mount`
- `"/"` 保留给隐式 `root mount` 投影；不允许把用户声明挂载直接写到 namespace root
- 运行时节点形态由 `filesystem type` 与 `node type` 决定
- `hostfs` 必须声明 `options.hostPath`
- `runtimefs` 在 V1 只允许 `/agents` 与 `/mcp/runtime`
- 允许最长前缀嵌套挂载，不允许 exact duplicate `path`

V1 当前必须支持的 `filesystem type`：

- `hostfs`
- `runtimefs`

---

## 4. Host Profile

守护进程与独立 backend 的 host profile 仍属于当前配置契约的一部分：

```ts
type HostProfile = "context" | "runtime" | "autonomous";
```

规则：

- `context` 表示可读上下文优先，不主动激活 runtime 家族能力
- `runtime` 表示正常运行态，可继续激活 agents / sessions / schedules 等 runtime 能力
- `autonomous` 保留给更高权限的自动执行态
- 非法 profile 输入必须直接报错；历史旧 profile 名称不再做兼容规范化

---

## 5. PermissionConfig

权限由命名空间边界负责，而不是由内容类别负责。

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

执行顺序固定为：

1. `mount namespace` 解析路径
2. permission 判断 caller 是否允许操作
3. 节点再判断 capability 是否支持

---

## 6. Built-In Filesystem Expectations

### 7.1 `hostfs`

- 用于工作目录、配置目录或宿主机真实文件树
- 默认暴露 `directory node` 与 `regular node`
- 普通读取不依赖常驻进程

### 7.2 `runtimefs`

- 用于 `/agents/*`、`/mcp/runtime/*` 等运行时子树
- 必须稳定暴露 `regular node`、`control node`、`stream node`

最小结构：

- `/_runtime.json`
- `/<name>/status.json`
- `/<name>/control/request.json`
- `/<name>/streams/*`

---

## 7. Namespace Projection

每个 namespace 在 VFS 中仍需投影为 `/_project.json` 与 `/project/context.json`。

说明：

- 它是当前 namespace 的只读投影
- 它不是底层事实源
- 它用于让 consumer 理解当前作用域、挂载和权限边界
- `/skills`、`/templates`、`/workflows`、`/mcp/configs` 等派生视图若存在，也只能来自 namespace 内文件与投影解释，而不是独立配置声明

---

## 8. V1 Non-Goals

以下内容不进入当前配置规范：

- `workflow` 顶层配置
- query/view mount 配置
- overlay/fallback mount 配置
- 外部分发仓库或消费视图声明
- 旧资源分类继续扩展
- 旧 `Prompt` 一级对象配置
