# Actant VFS Reference Architecture

> Status: Draft
> Date: 2026-03-20
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

## 5. Source Registration Model

### 5.1 Trait 替代 VfsSourceType

V1 移除旧 `VfsSourceType` 名义类型标签（`"filesystem" | "process" | "memory" | ...`）。

Source 注册时不再声明一个类型标签，而是声明自身具备的 `Trait` 集合。上层通过 required/optional trait 约束来匹配和编排 Source，Kernel 不依赖名义标签做行为分派。

### 5.2 SourceType 注册表

每个 `SourceType` 是一个自包含的类型定义：

- 声明该类型的 trait 集合
- 自定义配置 schema（不依赖中心化 discriminated union）
- 提供运行时校验
- 提供 Source 实例化工厂

新增一个 SourceType 不需要修改任何中心类型定义，只需注册进 SourceType 注册表。

### 5.3 Source 注册

Source 注册信息包含：

- `name`：逻辑标识
- `mountPoint`：挂载路径
- `traits`：Trait 集合（替代旧 `sourceType` 字段）
- `label`：人类可读标签，仅用于诊断/日志/CLI 展示（无语义作用）
- `lifecycle`：生命周期策略
- `metadata`：挂载元数据
- `fileSchema`：文件级能力声明
- `handlers`：操作处理器映射

### 5.4 Trait 与 Capability 的分层

```text
traits     → 上层（Project / ContextFS 编排层）用于约束匹配和编排决策
capabilities → Kernel 用于具体操作分派（由 handlers + fileSchema 决定）
permissions  → Middleware 用于权限控制
```

三层各自独立，正交不混淆。

### 5.5 约束匹配

上层通过 `SourceRequirement` 描述对 Source 的 Trait 约束：

```ts
interface SourceRequirement {
  required: SourceTrait[];
  optional?: SourceTrait[];
}
```

匹配规则：

- `required` 中的所有 Trait 必须在 Source 的 `traits` 集合中全部存在，否则不匹配
- `optional` 中的 Trait 如果存在则启用增强行为（如 `watchable` 启用热更新），不存在也不报错
- 匹配算法是纯集合运算：`required ⊆ source.traits`

V1 不引入：

- Trait 优先级或权重
- Trait 蕴含推导（`streamable` 不自动蕴含 `watchable`）
- 模糊匹配或最佳匹配排序

### 5.6 SourceType 默认 Trait 与实例收窄

SourceType 定义默认 Trait 集合。Source 实例继承 SourceType 的默认 Trait，可以收窄但不可扩展：

- SourceType `git` 默认 Trait：`persistent`, `versioned`, `watchable`
- Source 实例 `acme-hub`（类型 `git`）可以声明自己不支持 `watchable`（收窄）
- Source 实例不可声明 SourceType 未声明的 Trait（扩展）

这确保 SourceType 定义了该类型 Source 的能力上界。

---

## 6. Product/Implementation Boundary

`ContextFS` 决定：

- `Project`
- `SourceType` + `Source`
- `Trait` + `Capability`
- 文件式资源语义
- V1 包含哪些对象

`VFS Kernel` 决定：

- path/URI 如何规范化
- mount 如何路由
- middleware 如何包裹
- node/backend 如何执行
- metadata/lifecycle/events 如何组织
- Source 如何注册（trait 声明 + handler 映射）

两份文档不能重复定义同一层概念，也不能互相覆盖。

---

## 7. V1 Implementation Commitments

### Included

- direct mount
- permission middleware
- node/backend contract
- metadata 最小实现
- lifecycle 挂接点
- watch/stream 的基础事件机制
- Trait-based source registration（替代旧 `VfsSourceType`）
- SourceType 注册表（去中心化配置）

### Excluded

- overlay mount
- fallback mount
- query/view mount
- content cache
- directory cache 策略细化
- fingerprint / conflict / consistency 完整体系
- distributed/shared mount semantics
- 旧 `VfsSourceType` 名义类型标签

---

## 8. Expected Module Structure

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

## 9. Change Impact Protocol

每个功能变更在动手前必须确定其影响层级，层级越低（越核心）审查要求越高。

### 9.1 层级分类

| 层级 | 范围 | 典型文件 |
|---|---|---|
| L0 Kernel Core | dispatch、mount 路由、path 规范化、node 适配、middleware 契约 | `core/vfs-kernel.ts`, `mount/direct-mount-table.ts`, `namespace/canonical-path.ts`, `node/source-node-adapter.ts`, `middleware/types.ts` |
| L1 Infrastructure | 内置 middleware、注册中心、工厂注册、权限管理、生命周期管理 | `middleware/permission-middleware.ts`, `vfs-registry.ts`, `source-factory-registry.ts`, `vfs-permission-manager.ts`, `vfs-lifecycle-manager.ts` |
| L2 Orchestration | ContextFS 编排、ProjectManifest、Source 挂载投影 | `context/src/manager/context-manager.ts`, `context/src/project/project-manifest.ts` |
| L3 Business | Source 实现、handler 逻辑、具体资源的路径解析与读写 | `vfs/src/sources/*.ts` |
| L4 Types | 共享类型定义、契约接口 | `shared/src/types/vfs.types.ts` |

### 9.2 变更决策树

```text
新功能需求到达
    │
    ├─ 能否只增加/修改一个 Source 文件？
    │   └─ 是 → L3 变更，正常开发
    │
    ├─ 需要新增 VfsHandlerMap 中的 capability 签名？
    │   └─ 是 → L4 契约变更 → 先更新 spec/api-contracts.md
    │
    ├─ 需要改 middleware 链或新增内置 middleware？
    │   └─ 是 → L1 变更 → design review
    │
    ├─ 需要改 VfsKernel.dispatch / DirectMountTable.resolve / canonical-path？
    │   └─ 是 → L0 变更 → 必须证明无法在更高层解决
    │
    └─ 需要改 SourceNodeAdapter 的通用适配逻辑？
        └─ 是 → L0 变更 → 检查是否可以下沉到具体 Source
```

### 9.3 强制三问

在开始写代码前回答：

1. **这个需求的变化点落在哪一层？** 用决策树确认。
2. **如果改了 Kernel，上层所有 Source 是否需要跟着改？** 如果是，这是破坏性抽象变更，走 spec → design → contract 完整流程。
3. **改动之后，Kernel 层的代码是增加了还是减少了？** 增加需要额外说明为什么这段逻辑必须在 Kernel 层。

### 9.4 层级审查要求

| 层级 | 审查要求 |
|---|---|
| L3 Source | 正常 review：检查 handler 契约一致性 |
| L2 Orchestration | 检查 Project/Mount 语义是否变化 |
| L1 Infrastructure | 说明为什么不能在 L2/L3 解决 |
| L0 Kernel | 证明抽象边界需要调整，spec 先行 |
| L4 Types | 向后兼容审查 + spec/api-contracts 同步更新 |

### 9.5 Kernel 行数预算

L0 层总行数应趋向稳定或递减。当前基线约 570 行，预算上限 780 行。

超出预算时必须回答：这段逻辑为什么不能作为一个 Source、一个 middleware 或一个 Backend 实现来完成？

---

## 10. References

V1 参考但不直接复制：

- Linux VFS
- SQLite VFS
- rclone VFS

这些参考用于校准内核边界，不用于扩大 V1 范围。
