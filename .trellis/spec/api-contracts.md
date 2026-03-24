# 接口契约 (API Contracts)

> 本文档定义 ContextFS V1 的对外文件式操作面。
> 当前接口语义必须围绕 `mount namespace`、`filesystem type`、`node type` 展开。

---

## 1. Contract Scope

ContextFS V1 对外只承诺统一文件式接口：

- `read`
- `write`
- `list`
- `stat`
- `watch`
- `stream`

说明：

- 这是 V1 的唯一主操作面
- V1 不单独承诺 workflow API
- V1 不把旧资源分类系统继续作为独立顶层系统

---

## 2. Standard Paths

V1 固定标准路径：

- `/_project.json`
- `/skills/*`
- `/mcp/configs/*`
- `/mcp/runtime/*`
- `/agents/*`
- `/projects/*`

运行时路径中，以下节点语义必须稳定：

- `status.json` = `regular`
- `control/request.json` = `control`
- `streams/*` = `stream`

示例：

- `/mcp/runtime/<name>/status.json`
- `/mcp/runtime/<name>/control/request.json`
- `/mcp/runtime/<name>/streams/events`
- `/agents/<name>/status.json`
- `/agents/<name>/control/request.json`
- `/agents/<name>/streams/stdout`
- `/agents/<name>/streams/stderr`

---

## 3. `stat` / `describe` / `mountList` Minimum Fields

### 3.1 `stat(path)`

最低返回字段：

```ts
interface VfsStatRpcResult {
  canonicalPath: string;
  mountPoint: string;
  filesystemType: string;
  nodeType: string;
  size: number;
  mtime: string;
  type: "file" | "directory" | "symlink"; // legacy compatibility
  permissions?: string;
  mimeType?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  tags?: string[];
}
```

说明：

- `type` 是兼容字段，不再承担主语义
- 当前主语义字段是 `nodeType`

### 3.2 `describe(path)`

最低返回字段：

```ts
interface VfsDescribeRpcResult {
  path: string;
  mountPoint: string;
  mountType: string;
  filesystemType: string;
  nodeType: string;
  mountName: string;
  label: string;
  features: string[];
  capabilities: string[];
  metadata: Record<string, unknown>;
  tags: string[];
}
```

### 3.3 `mountList()`

最低返回字段：

```ts
interface VfsMountListResult {
  mounts: Array<{
    name?: string;
    path: string;
    filesystemType: string;
    mounted: boolean;
    options?: Record<string, unknown>;
  }>;
}
```

说明：

- `mountList()` 返回的是 `actant.namespace.json` 中声明的用户挂载，因此它只列出 `direct mount`
- 隐式 `root mount` 仍然存在，但它属于系统投影面，应通过 `describe("/")`、`describe("/_project.json")` 等路径语义观察

---

## 4. Execution Contract

V1 的执行能力通过 `control node` 和 `stream node` 表达，而不是通过独立执行 API 表达。

规则：

- 向 `control node` 的 `write` 是触发执行的唯一保留入口
- 从 `stream node` 的 `stream` 消费输出
- 运行时增强能力允许依赖常驻进程
- 普通上下文读取不能依赖常驻进程

### 4.1 Plugin Runtime Inspection

plugin runtime inspection 继续经 daemon RPC 暴露，但其结果结构必须与 `daemon plugin` 治理模型一致。

最低返回字段：

```ts
interface PluginRuntimeRef {
  name: string;
  scope: "actant" | "instance";
  state: "idle" | "running" | "error" | "stopped";
  metadata?: {
    displayName?: string;
    description?: string;
    version?: string;
  };
  lifecycle?: {
    activatedAt?: string;
    deactivatedAt?: string;
    disposedAt?: string;
  };
  contributions?: Array<{
    kind: "provider" | "rpc" | "hook" | "service";
    name: string;
    description?: string;
    target?: string;
    source?: "declared" | "inferred";
  }>;
  lastTickAt?: string;
  errorMessage?: string;
  consecutiveFailures?: number;
}
```

说明：

- plugin runtime inspection 只描述 `daemon plugin` 的状态，不把 `provider` 升级为独立顶层插件模型
- `contributions` 只是 plugin 已声明或被 host 推断出的能力摘要，不是新的中心注册入口
- bridge 层可以读取这些字段做展示，但不能据此在本地重建 plugin 生命周期

---

## 5. Watch And Stream

`watch` 与 `stream` 对外都返回有限批次，而不是无限阻塞连接。

### `watch`

- 用于状态变更和动态资源变更通知
- 对外返回有限事件集合

### `stream`

- 用于 stdout、stderr、runtime events 等输出流
- 对外返回有限 chunk 集合

这两者都必须受 `permission` 和节点 capability 约束。

---

## 6. Error Semantics

V1 最少需要以下错误类别：

- path not found
- permission denied
- capability not supported
- invalid project boundary
- invalid control request
- stream not found

对于 runtime 相关路径，还要求区分：

- control write rejected
- stream consumer timed out

---

## 7. Compatibility Rules

- 旧 `actant.project.json` 不再是运行时入口；活跃实现只读取 `actant.namespace.json`
- 旧 `type=sourceType` 等表述只允许出现在历史说明或迁移说明中
- 活跃文档、新接口说明、新 CLI 帮助文本必须使用：
  - `mount point`
  - `mount type`
  - `filesystem type`
  - `node type`
  - `capabilities`
