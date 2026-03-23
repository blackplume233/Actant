# Backend Development Guidelines

> 本文档定义 ContextFS / VFS 基线下的后端实现方向。

---

## 1. Current Backend Baseline

后端开发当前必须以前述 Linux 语义对象模型为前提：

- `mount namespace`
- `mount table`
- `filesystem type`
- `mount instance`
- `node type`
- `VfsBackend`

旧模型不再作为新增实现依据：

- 旧 `Source` / `SourceType` / `Trait` 作为主对象模型
- 旧平台中心化 orchestration object 作为平台核心
- `DomainContext` 作为聚合中心
- 旧 prompt/resource 分类继续扩展

---

## 2. Responsibilities By Layer

### ContextFS Layer

负责：

- namespace 配置输入
- 挂载组合
- 权限边界输入
- 文件系统语义对齐

### VFS Layer

负责：

- `mount namespace`
- `mount table`
- `middleware`
- `node / backend`
- `metadata`
- `lifecycle`
- `events`

### Backend Layer

负责：

- 真实资源访问
- 节点内容读写
- 可选 watch/stream 能力

Backend 不负责：

- 权限判定
- 挂载路由
- consumer interpretation

## 2.1 Frozen Runtime And Support Roles

当前 M8 freeze 基线额外固定以下角色：

- `daemon`: 运行时宿主与生命周期边界，负责持有 namespace / runtime state，并承接 `RPC` 调用
- `plugin`: daemon 内部的运行时扩展 / 适配单元，可以提供 backend 或 runtime capability，但不是 V1 对外对象模型
- `provider`: 为 plugin、backend 或 mount instance 提供连接、句柄、上游配置的内部对象，不是默认对外术语
- `domain-context`: 模板、组件定义、provider 描述与校验解析所在层；不是聚合中心，不持有 `mount namespace` 或 `VFS` 生命周期
- `manager`: session / process / backend lifecycle orchestration；消费 `domain-context` 产物并驱动 daemon / backend，但不定义 `filesystem type`、`mount rule` 或 `node semantics`

边界要求：

- hosted runtime 路径固定经 `bridge -> RPC -> daemon`
- daemon 内部实现链固定为 `daemon -> plugin -> provider -> VFS`
- `plugin` / `provider` 不得旁路 `mount namespace`、`mount table` 或 permission chain 暴露第二套访问内核
- 无 daemon 的本地读取可以直接进入 `VFS`，但不能因此引入第二套 public contract

---

## 3. V1 Required Types

V1 后端实现必须围绕以下固定类型工作：

- `mount type`: `root` / `direct`
- `filesystem type`: `hostfs` / `runtimefs` / `memfs`
- `node type`: `directory` / `regular` / `control` / `stream`

实现文档和代码评审时，必须先回答：

- 它属于哪个 `filesystem type`
- 它会暴露哪些 `node type`
- 哪些 capability 支持，哪些不支持
- permission 由谁判定
- 生命周期由谁持有

---

## 4. Runtime Contract

运行时相关 backend 必须按 `runtimefs` 建模：

- `status.json` -> `regular`
- `control/request.json` -> `control`
- `streams/*` -> `stream`

不得继续旁路 VFS 引入第二套执行模型。

---

## 5. V1 Non-Goals

后端实现阶段不得把以下内容偷偷带回 V1：

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 兼容旧中心化 orchestration model
- 兼容旧资源分类中心模型

---

## 6. Review Checklist

任何后端相关设计或实现评审，至少确认：

1. 是否符合 [spec/index.md](../index.md) 的 Linux 语义基线
2. 是否遵守 [ContextFS Architecture](../../../docs/design/contextfs-architecture.md) 的对象模型
3. 是否遵守 [Actant VFS Reference Architecture](../../../docs/design/actant-vfs-reference-architecture.md) 的实现分层
4. 是否明确了 `filesystem type`、`node type` 与 capability 边界
5. 是否避免把 consumer interpretation 写回内核对象模型
6. 是否同步更新 spec/design/roadmap
