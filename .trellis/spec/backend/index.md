# Backend Development Guidelines

> 本文档定义 ContextFS/VFS Kernel 基线下的后端实现方向。

---

## 1. Current Backend Baseline

后端开发当前必须以以下对象模型为前提：

- `Source`
- `Capability` traits
- `ProjectManifest`
- `VfsBackend`
- `VFS Kernel` 分层

旧模型不再作为新增实现依据：

- `ContextManager` 作为平台核心
- handler-centric source registration
- `DomainContext` 作为聚合中心
- SessionContextInjector / ContextProvider 路线继续扩展

---

## 2. Responsibilities By Layer

### ContextFS Layer

负责：

- `Project` 装载
- source 编排
- 权限边界输入
- 文件式资源语义

### VFS Kernel Layer

负责：

- namespace
- mount
- middleware
- node/backend
- metadata
- lifecycle
- events

### Backend Layer

负责：

- 真实资源访问
- 节点内容读写
- 可选 watch/stream 能力

Backend 不负责：

- 权限判定
- mount 路由
- 项目编排

---

## 3. Built-In V1 Target

V1 后端实现只围绕这 4 类 Source 设计：

- `SkillSource`
- `McpConfigSource`
- `McpRuntimeSource`
- `AgentRuntime`

新增后端或 source 设计时，不得要求 V1 先引入 workflow、query view 或兼容层。

---

## 4. Required Traits

所有 Source/Backend 设计都必须先说明其 capability：

- `Readable`
- `Writable`
- `Listable`
- `Watchable`
- `Streamable`
- `Searchable`
- `Versionable`（可后置）

实现文档和代码评审时，必须先回答：

- 它暴露哪些路径
- 它支持哪些能力
- 哪些能力不支持
- 权限由谁判定
- 生命周期由谁持有

---

## 5. V1 Non-Goals

后端实现阶段不得把以下内容偷偷带回 V1：

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 兼容旧 `ContextManager`
- 兼容旧 source handler 模型
- 旧 tool registry 中心模型

---

## 6. Review Checklist

任何后端相关设计或实现评审，至少确认：

1. 是否符合 [spec/index.md](../index.md) 的新基线
2. 是否遵守 [ContextFS Architecture](../../../docs/design/contextfs-architecture.md) 的对象模型
3. 是否遵守 [Actant VFS Reference Architecture](../../../docs/design/actant-vfs-reference-architecture.md) 的实现分层
4. 是否明确了 Source/Backend 的 capability 边界
5. 是否避免引入 V1 非目标
6. 是否同步更新 spec/design/roadmap
