# Actant VFS Reference Architecture

> Status: Draft
> Date: 2026-03-19
> Scope: 实现层内核架构
> Related: [ContextFS Architecture](./contextfs-architecture.md), [ContextFS Roadmap](../planning/contextfs-roadmap.md)

---

## 1. Role

`VFS Kernel` 是 `ContextFS` 的实现内核。

它不是产品层对象模型，也不是旧的 source router。  
它的职责是把 ContextFS 的文件式资源语义落实为统一的访问内核。

核心判断：

> **Actant VFS 应被设计为 resource kernel，而不是 source router。**

---

## 2. Layering

V1 的实现分层固定为：

- `namespace`
- `mount`
- `middleware`
- `node/backend`
- `metadata`
- `lifecycle`
- `events`

对应职责如下。

### 2.1 Namespace

负责：

- path/URI 规范化
- canonical identifier 解析
- 路径到内核请求上下文的统一化

V1 只要求解决规范化，不做 alias/view/query 语义。

### 2.2 Mount

负责：

- direct mount 注册
- 路径前缀归属解析
- mount 生命周期挂接

V1 只实现 `direct mount`。  
`overlay`、`fallback` 仅作为未来扩展方向保留，不进入当前实现承诺。

### 2.3 Middleware

负责：

- permission
- audit
- tracing

V1 中只有 `permission` 是必做行为，其他可保留骨架。

### 2.4 Node / Backend

`node` 是内核操作对象。  
`backend` 是实际资源提供者实现。

V1 的 node contract 聚焦：

- `stat`
- `readDir`
- `readFile`
- `writeFile`
- `watch`
- `stream`

V1 不要求单独提供独立 `invoke` syscall。

### 2.5 Metadata

负责：

- mount metadata
- node metadata
- path index
- audit log 的最小落点

V1 不做完整 cache 与分布式 metadata 设计。

### 2.6 Lifecycle

负责：

- daemon
- project
- session
- process
- ttl

V1 只要求资源生命周期有统一挂接点，不要求复杂 retain policy 行为全部实现。

### 2.7 Events

负责：

- watch 所需最小事件传播
- mount 变化
- invalidate 基础语义

V1 只做最小事件闭环，不承担通用事件系统职责。

---

## 3. Kernel Flow

V1 请求流：

1. caller 提交 path 或 URI
2. namespace 规范化为 canonical request
3. mount 找到 direct mount owner
4. middleware 执行权限与审计逻辑
5. node contract 调用 backend
6. events 触发 watch/invalidate 所需事件
7. metadata 更新派生状态

---

## 4. V1 Backend Contract

V1 backend contract 只要求最小文件式资源操作：

```ts
export interface VfsBackend {
  readonly type: string;

  stat(ctx: VfsRequestContext, uri: CanonicalUri): Promise<VfsStat | null>;
  readDir(ctx: VfsRequestContext, uri: CanonicalUri): Promise<VfsDirEntry[]>;
  readFile(ctx: VfsRequestContext, uri: CanonicalUri): Promise<Uint8Array>;
  writeFile(
    ctx: VfsRequestContext,
    uri: CanonicalUri,
    content: Uint8Array,
  ): Promise<void>;
  watch?(
    ctx: VfsRequestContext,
    uri: CanonicalUri,
  ): Promise<AsyncIterable<VfsWatchEvent>>;
  stream?(
    ctx: VfsRequestContext,
    uri: CanonicalUri,
  ): Promise<AsyncIterable<VfsStreamChunk>>;
}
```

说明：

- `watch` 与 `stream` 是可选能力
- 不支持的能力通过 capability 判断而不是旁路 API
- Backend 不负责权限判定
- Backend 不负责 mount 解析

---

## 5. Product/Implementation Boundary

`ContextFS` 决定：

- `Project`
- `Source`
- `Capability`
- 文件式资源语义
- V1 包含哪些对象

`VFS Kernel` 决定：

- path/URI 如何规范化
- mount 如何路由
- middleware 如何包裹
- node/backend 如何执行
- metadata/lifecycle/events 如何组织

两份文档不能重复定义同一层概念，也不能互相覆盖。

---

## 6. V1 Implementation Commitments

### Included

- direct mount
- permission middleware
- node/backend contract
- metadata 最小实现
- lifecycle 挂接点
- watch/stream 的基础事件机制

### Excluded

- overlay mount
- fallback mount
- query/view mount
- content cache
- directory cache 策略细化
- fingerprint / conflict / consistency 完整体系
- distributed/shared mount semantics

---

## 7. Expected Module Structure

V1 目标模块图：

```text
packages/vfs/src/
  core/
  namespace/
  mount/
  middleware/
  node/
  metadata/
  lifecycle/
  events/
  backends/
  storage/
```

设计约束：

- `core` 只依赖抽象
- `middleware` 不了解 backend 细节
- `backend` 不拥有权限逻辑
- `storage` 不参与 mount 解析

---

## 8. References

V1 参考但不直接复制：

- Linux VFS
- SQLite VFS
- rclone VFS

这些参考用于校准内核边界，不用于扩大 V1 范围。
