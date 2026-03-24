# Actant VFS Reference Architecture

> Status: Draft
> Date: 2026-03-23
> Scope: 实现层内核架构（Linux 语义）
> Related: [ContextFS V1 Linux Terminology](./contextfs-v1-linux-terminology.md), [ContextFS Architecture](./contextfs-architecture.md), [ContextFS Roadmap](../planning/contextfs-roadmap.md)

---

## 1. Role

`VFS` 是 `ContextFS` 的实现内核。

它不是业务资源分类器，也不是旧式 source router。  
它的职责是把 ContextFS 的文件系统语义落实为统一的访问内核。

核心判断：

> **Actant VFS 应被设计为 filesystem kernel，而不是资源分类路由器。**

同时，VFS 的运行时宿主口径固定为：

- `daemon` 是唯一运行时宿主与唯一组合根
- `bridge` 只负责通过 RPC 与 `daemon` 交互
- 单仓当前按 `Contracts Layer`、`VFS Stack`、`AgentRuntime Stack`、`Surface Stack` 理解
- `agent-runtime` 是被 `daemon` 装载的机制模块，不是组合根
- `domain-context` 归属 `AgentRuntime Stack`，不是运行时真相源
- `acp` 是协议/transport 模块
- `pi` 是 backend package，而不是宿主层

简化模块图：

```mermaid
flowchart TB
    ACTANT["actant
打包层 / 分发层"]

    BRIDGE["Bridge
cli / rest-api / tui / dashboard / mcp-server / channel-*"]

    DAEMON["Actant Daemon
唯一运行时宿主 / 唯一组合根"]

    VFS["@actant/vfs
唯一核心 / 唯一真相源"]

    CONTRACTS["Contracts Layer
@actant/shared"]

    RUNTIME["AgentRuntime Stack
agent-runtime / domain-context / acp / pi / tui / channel-*"]

    SURFACE["Surface Stack
api / cli / rest-api / dashboard / mcp-server / actant"]

    ACTANT --> BRIDGE
    BRIDGE -. RPC .-> DAEMON
    DAEMON --> RUNTIME
    DAEMON --> VFS
    VFS --> CONTRACTS
    RUNTIME --> CONTRACTS
    RUNTIME --> VFS
    SURFACE --> CONTRACTS
    SURFACE --> RUNTIME
    SURFACE --> VFS
```

### 1.1 Frozen Package Structure

当前活跃包结构按下面理解，不再引入第二套同级平台层：

| 层级 | 包 | 说明 |
| --- | --- | --- |
| `product shell` | `@actant/actant` | 打包层 / 分发层 |
| `bridge` | `@actant/cli`, `@actant/rest-api`, `@actant/dashboard`, `@actant/mcp-server` | 对外入口；默认经 RPC 进入 daemon |
| `Contracts Layer` | `@actant/shared` | 共享合同、错误、最小公共基础设施 |
| `VFS Stack` | `@actant/vfs` | 唯一内核 |
| `AgentRuntime Stack` | `@actant/agent-runtime`, `@actant/domain-context`, `@actant/acp`, `@actant/pi`, `@actant/tui`, `@actant/channel-*` | 运行时执行、解释、协议与集成能力 |
| `Surface Stack` | `@actant/api`, `@actant/cli`, `@actant/rest-api`, `@actant/dashboard`, `@actant/mcp-server`, `actant` | 对外入口、daemon 组合、产品壳 |
| `cleanup-target` | `@actant/context` | 本轮并入 `@actant/api` 并删除 |

已删除包：

- `@actant/catalog`
- `@actant/core`
- `@actant/domain`

### 1.2 Bridge / Edge Audit

bridge / edge 层的冻结结论如下：

| 包 | 结论 | 边界 |
| --- | --- | --- |
| `@actant/rest-api` | pure bridge | 只做 HTTP/SSE -> RPC 转发 |
| `@actant/dashboard` | UI shell | 只包裹 `rest-api` 与前端静态资源 |
| `@actant/cli` | bridge shell with local exceptions | 允许 `init`、daemon 启动、hub standalone namespace fallback |
| `@actant/mcp-server` | bridge shell with local exceptions | 允许 standalone namespace fallback，但不能自带 runtime 组合根 |
| `@actant/tui` | not bridge | 纯 UI toolkit |
| `@actant/channel-*` | not bridge | channel adapter / SDK adapter |

这里的“local exception”只表示受控的本地 namespace 读取或产品启动路径，不表示第二套系统组合根。

---

## 2. Fixed Layers

V1 的实现分层固定为：

- `mount namespace`
- `mount table`
- `middleware`
- `node / backend`
- `metadata`
- `lifecycle`
- `events`

### 2.1 Mount Namespace

负责：

- path / URI 规范化
- canonical path 生成
- 挂载视图解释
- mount-relative path 切分

### 2.2 Mount Table

负责：

- `root` / `direct` 挂载登记
- 最长前缀匹配
- 挂载生命周期挂接

### 2.3 Node / Backend

`node` 是统一对象，`backend` 是真实实现。

V1 的 `node type` 固定为：

- `directory`
- `regular`
- `control`
- `stream`

### 2.4 Metadata

负责：

- mount metadata
- node metadata
- tags
- 最小审计落点

### 2.5 Lifecycle

负责：

- daemon
- session
- process
- ttl

### 2.6 Events

负责：

- watch 所需最小事件传播
- runtime invalidate 基础语义

### 2.7 Current File Mapping

当前 `packages/vfs` 的 V1 内部文件布局应按下面理解：

- `facade`: `packages/vfs/src/vfs-facade.ts`
- `kernel`: `packages/vfs/src/core/vfs-kernel.ts`
- `mount`: `packages/vfs/src/mount/direct-mount-table.ts`
- `path / namespace`: `packages/vfs/src/vfs-path-resolver.ts`、`packages/vfs/src/namespace/canonical-path.ts`
- `node`: `packages/vfs/src/node/resolved-node-adapter.ts`
- `permission`: `packages/vfs/src/vfs-permission-manager.ts`、`packages/vfs/src/middleware/permission-middleware.ts`
- `lifecycle`: `packages/vfs/src/vfs-lifecycle-manager.ts`
- `storage`: `packages/vfs/src/storage/*`
- `index`: `packages/vfs/src/index/path-index.ts`
- `filesystem type / SPI`: `packages/vfs/src/filesystem-type-registry.ts`

相关上层边界：

- `agent-runtime`
  - daemon-hosted runtime module
  - agent orchestration / builder integration
  - may expose runtimefs-facing integrations through `Surface Stack`
- `domain-context`
  - parser / schema / validator / loader / permission compilation
  - agent-side local mutable collection / watcher only
  - must not define VFS core or runtime truth
- `acp`
  - protocol / transport implementation used by daemon-hosted runtime flows
  - must not bypass daemon / agent-runtime host boundaries
- `pi`
  - backend package consumed by `agent-runtime`
  - must not be described as daemon-side runtime integration host or standalone system layer

约束：

- 上述目录和文件是当前 V1 的核心骨架
- `sources/*` 仍是过渡期 helper/factory 集合，不得反向定义 `VFS core`
- `domain` / `catalog` / `manager` 语义不得继续渗入 `kernel`、`mount`、`path`、`node`、`permission` 主骨架
- `agent-runtime` 只能通过稳定公开边界消费 `VFS`
- `domain-context` 不得反向定义 `mount`、`node` 或 `filesystem type`
- `acp` 与 `pi` 的接入必须遵守 `bridge -> RPC -> daemon` 与 `daemon -> runtime integration -> VFS` 既有边界

---

## 3. Request Flow

```mermaid
sequenceDiagram
    participant U as Caller
    participant N as Mount Namespace
    participant T as Mount Table
    participant M as Middleware
    participant L as Node Layer
    participant B as Backend

    U->>N: path
    N->>N: canonicalize
    N->>T: resolve mount
    T-->>N: mount instance
    N->>M: request context
    M->>L: authorized request
    L->>B: dispatch
    B-->>L: result
    L-->>U: file operation result
```

---

## 4. Required Public Types

V1 当前必须在实现里稳定表达：

- `mount type`: `root | direct`
- `filesystem type`: `hostfs | runtimefs | memfs`
- `node type`: `directory | regular | control | stream`

对外出口至少要能稳定暴露：

- `mountPoint`
- `mountType`
- `filesystemType`
- `nodeType`
- `capabilities`
- `metadata`
- `tags`

## 4.1 Hosted Boundary Rules

当请求经过宿主运行时时，边界固定为：

- `bridge -> RPC -> daemon`
- `daemon -> runtime integration -> VFS`

解释如下：

- `bridge` 负责把 ACP / channel / MCP / CLI / API 等入口翻译到稳定 `RPC`
- `daemon` 是 hosted lifecycle 与 dispatch 所在边界
- `runtime integration` 是 daemon 内部装配的执行与协议能力层
- `VFS` 是最终执行路径解析、挂载匹配、节点操作与 capability 判定的唯一内核

限制：

- bridge 不直接触碰 runtime integration / VFS 内部状态
- runtime integration 不得绕过 `mount namespace`、`mount table` 与 middleware 暴露第二套访问面
- standalone / local kernel path 可以不经过 daemon，但不能因此引入第二套 runtime contract

---

## 5. Runtime Filesystem Contract

运行时树必须按 `runtimefs` 建模，而不是旁路 VFS：

- `status.json` -> `regular`
- `control/request.json` -> `control`
- `streams/*` -> `stream`

关键约束：

- 向 `control node` 写入是 effectful submission
- 从 `stream node` 读取是 ordered stream consumption
- 普通上下文读取不能被 daemon 绑死

---

## 5.1 Mount / Watch / Stream / Dispose Contract

V1 的核心生命周期契约固定如下：

- `mount`
  - 输入是完整 `mount registration`
  - `mount table` 负责登记、最长前缀匹配与 duplicate mount-point 拒绝
  - `lifecycle manager` 在挂载成功后开始追踪 `daemon / agent / session / process / ttl / manual`
- `watch`
  - 由节点 capability 暴露
  - 返回 `AsyncIterable<VfsWatchEvent>`
  - 提前结束迭代时必须调用底层 watcher disposer，不能泄漏订阅
- `stream`
  - 由节点 capability 暴露
  - 返回 ordered `AsyncIterable<VfsStreamChunk>`
  - `stream node` 可由真实 stream handler 提供，也可在受控场景下由 read fallback 生成一次性流
- `dispose`
  - mount 生命周期结束时，系统至少要完成 untrack + unmount
  - `watch` 订阅在 iterator `return()` 时释放
  - `VfsLifecycleManager.dispose()` 只负责清理 lifecycle timers，不额外保留挂载真相

实现落点：

- `mount`: `packages/vfs/src/mount/direct-mount-table.ts`
- `watch` / `stream`: `packages/vfs/src/node/resolved-node-adapter.ts`
- `dispose` / lifecycle cleanup: `packages/vfs/src/vfs-lifecycle-manager.ts`

---

## 6. Stack Boundary Rule

单仓边界固定分四层：

- `Contracts Layer`
- `VFS Stack`
- `AgentRuntime Stack`
- `Surface Stack`

约束：

- 不允许 `Surface Stack` 之外的包同时依赖 `VFS Stack` 与 `AgentRuntime Stack`
- 不允许 `VFS Stack` 依赖 `AgentRuntime Stack`
- 不允许 `AgentRuntime Stack` 依赖 `Surface Stack`
- 不允许内容先进入中心注册表，再投影回 VFS

何时扩展 `filesystem type`：

- 只有在“底层提供方式”变化时扩展
- 例如：宿主目录、内存视图、运行时伪文件系统

何时扩展 `node type`：

- 只有在 I/O 语义本身发生变化时扩展
- `control node` 和 `stream node` 属于这种情况

何时只扩展 metadata / tag / consumer：

- 当底层仍然只是普通文件，但用途不同
- 例如 skill、prompt、sql、config
