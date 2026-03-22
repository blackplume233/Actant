# 接口契约 (API Contracts)

> 本文档定义 ContextFS V1 的对外文件式操作面。旧 `ContextManager` / 旧 tool registry / 旧 manager API 不再是当前契约入口。

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
- V1 不单独承诺 `workflow` API
- V1 不把旧 tool registry 继续作为独立顶层系统

---

## 2. Standard Paths

V1 固定标准路径：

- `/_project.json`
- `/skills/*`
- `/mcp/configs/*`
- `/mcp/runtime/*`
- `/agents/*`
- `/projects/*`

这些路径属于当前契约的一部分，后续实现必须与此保持一致。

M4 落地后的内置节点约定：

- `/skills/_catalog.json`
- `/mcp/configs/_catalog.json`
- `/mcp/runtime/_catalog.json`
- `/mcp/runtime/<name>/status.json`
- `/mcp/runtime/<name>/streams/events`
- `/mcp/runtime/<name>/control/request.json`
- `/agents/_catalog.json`
- `/agents/<name>/status.json`
- `/agents/<name>/streams/stdout`
- `/agents/<name>/streams/stderr`
- `/agents/<name>/control/request.json`

说明：

- `_catalog.json` 是内置 source 的目录总览文件
- `status.json` 是运行时状态快照
- `streams/*` 是流节点
- `control/request.json` 是控制节点；节点存在属于路径契约，是否允许 `write` 由具体 provider 能力决定

### 2.1 Daemon / Hub Profile Surface

与当前路径契约一起对外暴露的还有 daemon / hub 的 host profile 语义：

- `actant daemon start --profile <profile>` 规范接受值为 `context`、`runtime`、`autonomous`
- `context` 是当前 CLI-first project context hub 的标准 profile 名称
- `actant hub status`、connected hub backend 和 standalone backend 输出的 `hostProfile` 也必须返回 `context`
- 历史输入 `bootstrap` 仅允许作为兼容别名被解析，不得再作为新的用户可见输出值

---

## 3. File Operations

### 3.1 `read(path)`

返回目标节点内容。

适用对象：

- `_project.json`
- skill / mcp config 文件
- `_catalog.json`
- runtime `status.json`
- agent `status.json`
- stream 节点的当前快照读取

### 3.2 `write(path, content)`

向目标节点写入内容。

V1 允许的典型用法：

- 更新 skill
- 更新 mcp config
- 在支持控制能力的运行时 source 上写入 `control/request.json`

### 3.3 `list(path)`

列举路径下的目录项。

补充约定：

- daemon / API / connected CLI 在运行时路径上应通过 `VFS Kernel` 分发 `list`
- 当请求命中未直接挂载的父路径时，可以返回其 direct child mounts 作为目录项投影

### 3.4 `stat(path)`

返回节点元信息。

补充约定：

- daemon / API / connected CLI 在运行时路径上应通过 `VFS Kernel` 分发 `stat`
- permission middleware 必须在 token-backed caller 的真实运行路径上生效

### 3.5 `watch(path)`

订阅目标节点变化。

V1 主要用于：

- runtime 状态变更
- agent 状态变更
- 动态资源变更通知

RPC / MCP 暴露面：

- RPC 方法：`vfs.watch`
- MCP tool：`vfs_watch`

参数契约：

```ts
interface VfsWatchParams {
  path: string;
  maxEvents?: number;
  timeoutMs?: number;
  pattern?: string;
  events?: Array<"create" | "modify" | "delete">;
  token?: string;
}

interface VfsWatchRpcResult {
  events: VfsWatchEvent[];
  truncated: boolean;
  timedOut: boolean;
}
```

批量收集约定：

- `watch` 对外返回的是有限事件批次，不是无限阻塞订阅
- `maxEvents` 表示本次最多收集多少条事件
- `timeoutMs` 表示等待事件的最长时间
- 命中上限时返回 `truncated: true`
- 超时返回时标记 `timedOut: true`
- API / standalone backend 当前默认行为是 `maxEvents = 1`、`timeoutMs = 250`

### 3.6 `stream(path)`

消费持续输出。

V1 主要用于：

- agent 输出流
- runtime 输出流

RPC / MCP 暴露面：

- RPC 方法：`vfs.stream`
- MCP tool：`vfs_stream`

参数契约：

```ts
interface VfsStreamParams {
  path: string;
  maxChunks?: number;
  timeoutMs?: number;
  token?: string;
}

interface VfsStreamRpcResult {
  chunks: VfsStreamChunk[];
  truncated: boolean;
  timedOut: boolean;
}
```

批量收集约定：

- `stream` 对外返回的是有限 chunk 批次，不是无限长连接
- `maxChunks` 表示本次最多收集多少个 chunk
- `timeoutMs` 表示等待 chunk 的最长时间
- 命中上限时返回 `truncated: true`
- 超时返回时标记 `timedOut: true`
- API / standalone backend 当前默认行为是 `maxChunks = 1`、`timeoutMs = 250`

---

## 4. Execution Contract

V1 的执行能力通过控制节点和流节点表达，而不是通过旧 tool registry 或旧 manager API 表达。

最小路径约定：

- `/agents/<name>/control/request.json`
- `/agents/<name>/streams/stdout`
- `/agents/<name>/streams/stderr`
- `/mcp/runtime/<name>/control/request.json`
- `/mcp/runtime/<name>/streams/events`

规则：

- 控制节点和流节点都属于标准 VFS 节点，不单独引入额外执行 API
- 向控制节点 `write` 是触发执行的唯一保留入口
- 从流节点 `stream` 消费输出
- M4 已固定这些路径；M5 再把控制请求 payload、执行生命周期和稳定输出语义冻结为正式模型

---

## 5. Built-In Source Surface

M5 起，每个 Source 通过 `SourceTrait` 声明自身特征，通过 `SourceTypeRegistry` 注册。
`VfsSourceRegistration` 不再携带 `sourceType` 字段，改为 `label: string` + `traits: ReadonlySet<SourceTrait>`。

### 5.0 SourceTrait 定义

```ts
type SourceTrait =
  | "persistent"   // 持久化存储
  | "ephemeral"    // 生命周期绑定，进程退出即消失
  | "watchable"    // 支持 watch 事件
  | "streamable"   // 支持 stream 消费
  | "writable"     // 支持 write 操作
  | "virtual"      // 纯计算/投影节点
  | "executable"   // 支持控制节点执行
  | (string & Record<never, never>);  // 开放扩展
```

互斥约束：`persistent` 与 `ephemeral` 不可同时声明。

### 5.0.1 VfsDescribeRpcResult

```ts
interface VfsDescribeRpcResult {
  path: string;
  mountPoint: string;
  sourceName: string;
  label: string;           // 替代旧 sourceType
  traits: string[];        // SourceTrait[] 序列化
  capabilities: string[];
  metadata: Record<string, unknown>;
}
```

### 5.0.2 VfsMountListResult

```ts
interface VfsMountListResult {
  mounts: Array<{
    name: string;
    mountPoint: string;
    label: string;          // 替代旧 sourceType
    traits: string[];       // SourceTrait[] 序列化
    capabilities: string[];
    fileCount: number;
  }>;
}
```

### 5.1 SkillSource

- traits: `persistent`, `writable`
- `read`
- `write`
- `list`
- `stat`
- 可选 `grep`

### 5.2 McpConfigSource

- traits: `persistent`, `writable`
- `read`
- `write`
- `list`
- `stat`

### 5.3 McpRuntimeSource

- traits: `executable`, `streamable`, `ephemeral`
- `read`
- `write`（仅控制节点）
- `list`
- `stat`
- `watch`
- `stream`

### 5.4 AgentRuntime

- traits: `executable`, `streamable`, `ephemeral`
- `read`
- `write`（仅控制节点）
- `list`
- `stat`
- `watch`
- `stream`

---

## 6. Error Semantics

V1 最少需要以下错误类别：

- path not found
- permission denied
- capability not supported
- invalid project boundary
- invalid control request
- stream not found

对于 daemon-connected 的运行时调用，还要求：

- `permission denied` 由 kernel middleware 链路统一给出，而不是由 caller 旁路判定
- `path not found` 与 `capability not supported` 保持和 kernel dispatch 一致的语义

具体错误码可以在实现阶段细化，但不得绕开上述语义类别。

---

## 7. Deprecated Contract Surface

以下旧接口面不再作为当前契约真相：

- 旧 `ContextManager` 驱动的上下文装配接口
- 旧 `DomainContext` 聚合式资源契约
- 旧 tool registry 作为平台中心
- 任何把 workflow 写入 V1 主契约的接口定义

若仓库中仍保留历史描述，只能标记为废弃/待移除，不能与本契约并列为双真相。
