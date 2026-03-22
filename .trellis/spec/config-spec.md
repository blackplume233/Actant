# 配置规范 (Configuration Specification)

> 本文档定义 ContextFS V1 的配置真相。
> 当前默认入口是 `actant.namespace.json`；`actant.project.json` 只作为兼容输入保留。

---

## 1. Scope

本文件当前只定义与 ContextFS V1 直接相关的配置：

- `mount namespace` 声明
- `mount table` 声明
- permission 声明
- child project 关系

旧的资源分类配置、旧的 `Source` 配置叙事、旧的 prompt/workflow 顶层配置都不再是默认规范入口。

---

## 2. Namespace Config

`actant.namespace.json` 是 ContextFS V1 的默认配置入口。

它负责：

- 声明命名空间中挂载哪些子树
- 定义这些子树挂到哪些路径
- 指定最小的权限与子项目收窄规则

最小结构：

```ts
interface ActantNamespaceConfig {
  version?: 1;
  name?: string;
  mounts?: MountDeclaration[];
  permissions?: PermissionConfig;
  children?: ChildProjectRef[];
}
```

兼容规则：

- 实现层必须优先读取 `actant.namespace.json`
- 若不存在，再回退到 `actant.project.json`
- 活跃文档、CLI 帮助和示例配置不得再把 `actant.project.json` 当默认入口

---

## 3. Mount Table Declaration

V1 当前只支持 `root` 与 `direct` 两种 `mount type`，其中用户声明面只暴露 `direct`。

```ts
interface MountDeclaration {
  source: string;
  path: string;
  config?: Record<string, unknown>;
}
```

当前语义解释如下：

- `source`：兼容字段名；当前语义应理解为将要实例化的 `filesystem type` 或挂载定义名
- `path`：`mount point`
- `config`：用于实例化该挂载的具体参数

配置解释约束：

- 不再把 `source` 当作业务资源分类
- 不再把挂载声明当作内容类型声明
- 运行时节点形态由 `filesystem type` 与 `node type` 决定

V1 当前必须支持的 `filesystem type`：

- `hostfs`
- `runtimefs`
- `memfs`

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
- 历史输入 `bootstrap` 只作为兼容别名保留；实现层必须把它规范化为 `context`

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

### 6.1 `hostfs`

- 用于工作目录、配置目录或宿主机真实文件树
- 默认暴露 `directory node` 与 `regular node`
- 普通读取不依赖常驻进程

### 6.2 `runtimefs`

- 用于 `/agents/*`、`/mcp/runtime/*` 等运行时子树
- 必须稳定暴露 `regular node`、`control node`、`stream node`

最小结构：

- `/_catalog.json`
- `/<name>/status.json`
- `/<name>/control/request.json`
- `/<name>/streams/*`

### 6.3 `memfs`

- 用于短生命周期、无宿主持久化依赖的挂载
- 主要服务于自举、测试或临时视图

---

## 7. Project Projection

每个 project 在 VFS 中仍需投影为 `/_project.json`。

说明：

- 它是 project 的只读投影
- 它不是底层事实源
- 它用于让 consumer 理解当前作用域、挂载和权限边界

---

## 8. V1 Non-Goals

以下内容不进入当前配置规范：

- `workflow` 顶层配置
- query/view mount 配置
- overlay/fallback mount 配置
- 旧资源分类继续扩展
- 旧 `Prompt` 一级对象配置
