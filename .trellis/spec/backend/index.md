# Backend Development Guidelines

> 本文档定义 ContextFS / VFS 基线下的后端实现方向。

---

## 1. Current Backend Baseline

后端开发当前必须以前述 Linux 语义对象模型为前提：

- `daemon`
- `bridge`
- `daemon plugin`
- `agent-runtime`
- `domain-context`
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
- 作为运行机制模块的承载层，例如 `agent-runtime`

不负责：

- 替代 `daemon` 成为组合根
- 直接成为中心注册结构

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

- 作为 `daemon plugin` 的子能力向 `VFS` 注入 mount/backend/数据来源
- 声明稳定 SPI：`kind`、`filesystemType`、`mountPoint`
- 对具体 `filesystem type` 暴露最小数据访问面
- 节点内容读写
- 可选 watch/stream 能力

Provider 不负责：

- 权限判定
- 挂载路由
- consumer interpretation
- 内容注册中心
- 替代 `daemon plugin` 成为顶层扩展模型

最小 SPI 约束：

- 所有 provider contribution 都必须显式声明：
  - `kind`
  - `filesystemType`
  - `mountPoint`
- `runtimefs` data-source contribution 额外固定为：
  - `listRecords()`
  - `getRecord(name)`
  - 可选 `readStream()`
  - 可选 `stream()`
  - 可选 `writeControl()`
  - 可选 `subscribe()`

当前迁移口径：

- `/agents` 由 `AgentRuntimeProviderContribution` 提供
- `/mcp/runtime` 由 `McpRuntimeProviderContribution` 提供
- `hostfs` / `memfs` 继续由 filesystem type factory 负责，不归入 provider contribution
- `skill` / `prompt` / `workflow` / `template` 这类派生内容不属于 provider contribution

### Agent Runtime Layer

`agent-runtime` 在 V1 中是由 `daemon` 装载的运行机制模块。

负责：

- 承载 daemon plugin 生命周期与 agent orchestration
- 基于 VFS/provider surfaces 读写运行时状态
- 依赖 `domain-context`、`acp`、`pi` 等下游能力模块完成解释、协议或集成
- 通过 `adaptLegacyPlugin()` 承接遗留 workspace materialization 适配

不负责：

- 成为系统组合根
- 绕过 `daemon` 直接向 bridge 暴露宿主能力
- 绕过 VFS 建立第二套系统状态真相源
- 把 legacy workspace materialization adapter 升级成独立顶层插件模型

### Domain-Context Layer

`domain-context` 在 V1 中只负责文件解释与本地 authoring helper：

- parser / schema / validator / loader / renderer-adjacent helper
- permission compilation
- 本地 mutable collection / watcher

它不负责：

- 反向生成 VFS
- 成为系统状态中心
- 通过 manager-first registry 定义平台边界

### ACP Layer

`acp` 是协议与 transport 模块。

负责：

- ACP 连接、gateway、callback、channel adapter、VFS interception
- 为 `daemon` / `agent-runtime` 提供协议实现与 transport helper

不负责：

- 成为独立宿主
- 绕过 `daemon` / `agent-runtime` 自行定义系统状态边界

### PI Layer

`pi` 是被 `agent-runtime` backend 体系消费的后端包。

负责：

- 提供 backend builder / communicator / ACP bridge 适配
- 作为具体 backend implementation 被 `agent-runtime` 调用

不负责：

- 成为独立 plugin host
- 绕过 `agent-runtime` / `daemon` 直接进入系统主线

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
- `agent-runtime` 对 `domain-context` / `acp` / `pi` 的使用属于下游依赖，不改变宿主层级
- `acp` / `pi` 进入系统主线时，必须经 `agent-runtime` 或 `daemon` 已定义的边界接入
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
