# 配置规范 (Configuration Specification)

> 本文档定义 ContextFS V1 的配置真相。
> 当前默认且唯一运行时入口是 `actant.namespace.json`。

---

## 1. Scope

本文件当前只定义与 ContextFS V1 直接相关的配置：

- `mount namespace` 声明
- `mount table` 声明
- `catalog` 声明
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
  catalogs?: CatalogDeclaration[];
  entrypoints?: ActantNamespaceEntrypoints;
  permissions?: PermissionConfig;
  children?: ChildNamespaceRef[];
}
```

运行时规则：

- 实现层只读取 `actant.namespace.json`
- 若仓库中只存在 legacy project config，运行时必须显式报迁移错误
- 旧配置只允许由 `actant namespace migrate` 读取和转换

---

## 3. Mount Table Declaration

V1 当前只支持 `root` 与 `direct` 两种 `mount type`，其中用户声明面只暴露 `direct`。

```ts
interface MountDeclaration {
  name?: string;
  type: "hostfs" | "runtimefs" | "memfs";
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
- 运行时节点形态由 `filesystem type` 与 `node type` 决定

V1 当前必须支持的 `filesystem type`：

- `hostfs`
- `runtimefs`
- `memfs`

---

## 4. Catalog Declaration

`catalog` 用于声明外部组件仓库来源，不参与 namespace 挂载匹配。

```ts
interface CatalogDeclaration {
  name: string;
  type: "local" | "github" | "community";
  options: Record<string, unknown>;
}
```

约束：

- `catalog` 只表示外部组件来源
- `catalog` 不声明 `mount point`
- derived views 如 `/skills`、`/templates`、`/workflows`、`/mcp/configs` 可由 `/config` 与 `catalogs` 共同物化

---

## 5. Host Profile

守护进程与独立 backend 的 host profile 仍属于当前配置契约的一部分：

```ts
type HostProfile = "context" | "runtime" | "autonomous";
```

规则：

- `context` 表示可读上下文优先，不主动激活 runtime 家族能力
- `runtime` 表示正常运行态，可继续激活 agents / sessions / schedules 等 runtime 能力
- `autonomous` 保留给更高权限的自动执行态
- 历史输入 `bootstrap` 只作为兼容别名保留；实现层必须把它规范化为 `context`

---

## 6. PermissionConfig

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

## 7. Built-In Filesystem Expectations

### 7.1 `hostfs`

- 用于工作目录、配置目录或宿主机真实文件树
- 默认暴露 `directory node` 与 `regular node`
- 普通读取不依赖常驻进程

### 7.2 `runtimefs`

- 用于 `/agents/*`、`/mcp/runtime/*` 等运行时子树
- 必须稳定暴露 `regular node`、`control node`、`stream node`

最小结构：

- `/_catalog.json`
- `/<name>/status.json`
- `/<name>/control/request.json`
- `/<name>/streams/*`

### 7.3 `memfs`

- 用于短生命周期、无宿主持久化依赖的挂载
- 主要服务于自举、测试或临时视图

---

## 8. Namespace Projection

每个 namespace 在 VFS 中仍需投影为 `/_project.json` 与 `/project/context.json`。

说明：

- 它是当前 namespace 的只读投影
- 它不是底层事实源
- 它用于让 consumer 理解当前作用域、挂载和权限边界

---

## 9. V1 Non-Goals

以下内容不进入当前配置规范：

- `workflow` 顶层配置
- query/view mount 配置
- overlay/fallback mount 配置
- 旧资源分类继续扩展
- 旧 `Prompt` 一级对象配置
