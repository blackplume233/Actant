# Backend Development Guidelines

> 本文档定义 ContextFS / VFS 基线下的后端实现方向。

---

## 1. Current Backend Baseline

后端开发当前必须以前述 Linux 语义对象模型为前提：

- `daemon`
- `bridge`
- `daemon plugin`
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
- bridge 层自行装载系统
- 把 provider 当成高于 plugin 的总模型

---

## 2. Responsibilities By Layer

### Runtime Host Layer

负责：

- `daemon` 作为唯一运行时宿主
- 装载 `VFS`
- 装载 `daemon plugins`
- 组合内部运行机制模块
- 提供统一 RPC 能力面

不负责：

- 直接承担 bridge 层表现逻辑

### Bridge Layer

负责：

- 通过 RPC 与 `daemon` 交互
- 请求转发
- 协议转换
- 响应格式化
- 交互适配

不负责：

- 自行装载插件
- 自行组合系统
- 持有系统真相源

### Daemon Plugin Layer

负责：

- 作为真实扩展单元被 `daemon` 装载
- 可贡献 provider、RPC 能力、hooks、services 等
- 暴露稳定插件标识与元信息
- 遵守 `activate -> tick* -> deactivate -> dispose` 生命周期

不负责：

- 替代 `daemon` 成为组合根
- 直接成为中心注册结构
- 让 `provider` 反向成为顶层插件模型

最小契约至少包括：

- `name` / `scope`
- `metadata`
- 生命周期 hooks
- 显式声明的 contribution 集合：`provider / rpc / hook / service`

### VFS Layer

负责：

- `mount namespace`
- `mount table`
- `middleware`
- `node / backend`
- `metadata`
- `lifecycle`
- `events`

### Provider Contribution Layer

负责：

- 真实资源访问
- 节点内容读写
- 可选 watch/stream 能力

Provider 不负责：

- 权限判定
- 挂载路由
- consumer interpretation
- 内容注册中心

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

运行时结构同时必须满足：

- `daemon` 是唯一组合根
- bridge 层所有运行时能力都经 RPC 向 `daemon` 请求
- `agent-runtime` 等机制模块如需扩展系统，应作为 `daemon plugin` 接入
- plugin 如需暴露文件系统能力，应通过 provider contribution 注入 `VFS`

---

## 5. V1 Non-Goals

后端实现阶段不得把以下内容偷偷带回 V1：

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 兼容旧中心化 orchestration model
- 兼容旧资源分类中心模型
- bridge 层自带组合根
- provider 重新升级为中心注册结构

---

## 6. Review Checklist

任何后端相关设计或实现评审，至少确认：

1. 是否符合 [spec/index.md](../index.md) 的 Linux 语义基线
2. 是否遵守 [ContextFS Architecture](../../../docs/design/contextfs-architecture.md) 的对象模型
3. 是否遵守 [Actant VFS Reference Architecture](../../../docs/design/actant-vfs-reference-architecture.md) 的实现分层
4. 是否明确了 `filesystem type`、`node type` 与 capability 边界
5. 是否仍遵守 `daemon -> daemon plugin -> provider contribution -> VFS` 的装载方向
6. 是否避免把 consumer interpretation 写回内核对象模型
7. 是否同步更新 spec/design/roadmap
