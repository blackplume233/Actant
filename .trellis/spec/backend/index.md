# Backend Development Guidelines

> 本文档定义 ContextFS / VFS 基线下的后端实现方向。

---

## 1. Current Backend Baseline

后端开发当前必须以前述 Linux 语义对象模型为前提：

- `daemon`
- `bridge`
- `Contracts Layer`
- `VFS Stack`
- `mountfs`
- `agent-runtime`
- `domain-context`
- `Surface Stack`
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

---

## 2. Responsibilities By Layer

### Runtime Host Layer

负责：

- `daemon` 作为唯一运行时宿主
- 装载 `VFS`
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

### AgentRuntime Layer

负责：

- 作为 `daemon` 内部执行与解释能力层的一部分
- 以 builtin plugin capability 的形式承载 `agent-runtime`
- 维护 agent 生命周期、执行状态与集成能力
- 允许把只服务该 capability 的 orchestration、session、launcher、state、record、channel、communicator、budget、builder / initializer glue 内聚到 plugin 实现内部

不负责：

- 替代 `daemon` 成为组合根
- 直接成为中心注册结构
- 继续把只服务 `agent-runtime` 的实现残片维持成新的顶层公共包

### VFS Layer

负责：

- `mount namespace`
- `mount table`
- `middleware`
- `node / backend`
- `metadata`
- `lifecycle`
- `events`

不负责：

- 承载某一类挂载的具体 backend 实现
- 继续维护 `packages/vfs/src/sources/*` 作为长期活跃扩展面

### MountFS Layer

`mountfs` 是单一挂载类型的独立实现边界。

负责：

- 通过稳定 SPI 构造某类 `mount instance`
- 定义该挂载的 node schema、handler、metadata 与 backend 适配
- 把 hostfs / runtimefs 与后续扩展挂载的具体语义封装为可装配单元

不负责：

- 成为 VFS kernel
- 持有全局 `mount namespace` 或 `mount table`
- 成为新的中心注册表
- 定义跨挂载类型的系统对象模型

实现 contract、审查门槛与迁移顺序以 [MountFS 实现规范](../mountfs-implementation-spec.md) 为准。

### Agent Runtime Layer

`agent-runtime` 在 V1 中是由 `daemon` 装载的 builtin plugin capability。

负责：

- 承载 agent orchestration
- 基于 VFS 公开能力读写运行时状态
- 依赖 `domain-context`、`acp`、`pi` 等下游能力模块完成解释、协议或集成
- 通过兼容适配承接遗留 workspace materialization
- 吸纳只服务 agent execution 的内部实现模块，而不是继续扩散新的顶层包边界

不负责：

- 成为系统组合根
- 绕过 `daemon` 直接向 bridge 暴露宿主能力
- 绕过 VFS 建立第二套系统状态真相源
- 把 legacy workspace materialization adapter 升级成新的顶层扩展模型
- 充当其他插件直接 import 的公共实现入口

### SDK Layer

`sdk` 是 builtin / third-party plugin 的稳定可导入表面。

负责：

- 暴露 service token、types、DTO、client helper、builder
- 为跨包 / 跨仓 plugin 提供 semver 管理的公共 contract

不负责：

- 承载 daemon side 状态
- 暴露 plugin 内部 manager / watcher / launcher / mutable collection 实现
- 因为 family 归属而被嵌回某个 plugin 实现目录

### Support Layer

`support` 是主要给 builtin plugin 复用的实现积木层。

负责：

- 提供 command/page/provider/handler helper
- 沉淀多个 builtin plugin 共用、但不应升级为公共 capability contract 的实现工具

不负责：

- 取代 `sdk` 成为外部稳定依赖面
- 取代 `plugins` 成为 capability 实现层
- 因为 family 归属而被视为 plugin 实现目录的子层

### Third-Party Layer

`third-party` 是外部插件的开发、安装、兼容、审核、物化层。

负责：

- plugin devkit / scaffold
- source fetch / install / materialization / lockfile
- compatibility shim / manifest migration
- permission / risk / audit review

不负责：

- 成为 runtime host
- 直接承载 builtin capability 实现

### Plugin Family Grouping

`plugin family` 是能力归属维度，不是物理目录层。

规则：

- 一个 family 可同时包含 `sdk`、`support`、`plugins`、`third-party` 中的多个包
- 运行时被 daemon 装载的只有 `plugins` 中的 plugin implementation package
- `sdk` / `support` / `third-party` 若属于某个 family，仍应保留各自独立的物理层级与依赖规则

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

- 成为独立 runtime integration host
- 绕过 `agent-runtime` / `daemon` 直接进入系统主线

## 2.1 Frozen Package Retention Matrix

后端基线下的最终保留 / 合并 / 删除清单固定如下：

| 状态 | 包 | 结论 |
| --- | --- | --- |
| `keep` | `@actant/vfs` | 唯一 VFS 内核 |
| `planned` | `@actant/mountfs-*` | 单一挂载类型实现包；逐步替代 `packages/vfs/src/sources/*` |
| `keep` | `@actant/api` | `Surface Stack` 里的 daemon 组合与 project-context 入口 |
| `keep` | `@actant/agent-runtime` | `AgentRuntime Stack` 核心 |
| `keep` | `@actant/domain-context` | `AgentRuntime Stack` 里的 parser / schema / validator / local authoring collection |
| `keep` | `@actant/acp` | 协议 / transport / gateway 能力 |
| `keep` | `@actant/pi` | backend package |
| `keep` | `@actant/shared` | 共享契约、错误、RPC shape、path helper |
| `keep` | `@actant/cli`, `@actant/rest-api`, `@actant/dashboard`, `@actant/mcp-server` | bridge surfaces |
| `keep` | `@actant/tui`, `@actant/channel-*` | UI / adapter packages，不是宿主层 |
| `keep` | `@actant/actant` | 打包层 / 分发层 / 产品壳 |
| `delete` | `@actant/context` | 本轮并入 `@actant/api` 并删除 |
| `delete` | `@actant/catalog`, `@actant/core`, `@actant/domain` | 已退出活跃边界 |

面向后续目录收口时，活跃仓库的目标包层级固定为：

| 层级 | 目标职责 |
| --- | --- |
| `core` | 宿主、内核、plugin runtime、共享合同 |
| `sdk` | 可稳定 import 的公共 contract 表面 |
| `support` | builtin plugin 复用积木 |
| `plugins` | builtin capability 与 future third-party capability 实现 |
| `bridges` | CLI / REST / Dashboard / MCP 入口壳 |
| `third-party` | 开发、安装、兼容、审核、物化 |
| `app` | 打包与分发壳 |

`@actant/context -> @actant/api` 合并口径固定为：

- `project-manifest` 这一类 helper 迁入 `@actant/api`
- 新的 namespace / hub / runtime 入口统一落在 `@actant/api`
- 仓库中不再保留 `@actant/context`

## 2.2 Bridge Audit Conclusions

本轮对 bridge / edge 包的审查结论固定如下：

| 包 | 结论 | 说明 |
| --- | --- | --- |
| `@actant/rest-api` | `pure RPC bridge` | 只通过 `RpcBridge` 转发到 daemon，不直接装配 VFS / runtime |
| `@actant/dashboard` | `UI shell over rest-api` | 只消费 `@actant/rest-api` 和静态前端资源；不是组合根 |
| `@actant/cli` | `RPC bridge shell` | `hub` / runtime 访问只能经 RPC 进入 daemon；保留 `actant init` 与 daemon entry 这类产品壳路径 |
| `@actant/mcp-server` | `RPC bridge shell` | 所有 VFS / runtime 能力都必须经 RPC 消费 daemon；无 standalone namespace fallback |
| `@actant/tui` | `not a bridge` | 纯 UI 组件库，只消费流类型，不承担 RPC/daemon 边界 |
| `@actant/channel-*` | `adapter, not bridge` | 协议/SDK 适配层，可消费 `agent-runtime` channel contract，但不是 daemon host |

对 bridge 的进一步约束：

- bridge 包不得直接持有第二套 runtime 组合逻辑
- bridge 包不得持有 `mount table`、`filesystem type registry`
- bridge 包不得提供 standalone namespace fallback 或任何本地只读 VFS 旁路
- `rest-api` / `dashboard` 不应引入 standalone VFS kernel 组装逻辑
- `cli` / `mcp-server` 的 bridge 访问必须严格收口为 `RPC -> daemon`

## 2.3 Frozen Runtime And Support Roles

当前 M8 freeze 基线额外固定以下角色：

- `daemon`: 运行时宿主与生命周期边界，负责持有 namespace / runtime state，并承接 `RPC` 调用
- `domain-context`: 模板、组件定义、provider 描述与校验解析所在层；不是聚合中心，不持有 `mount namespace` 或 `VFS` 生命周期
- `manager`: session / process / backend lifecycle orchestration；消费 `domain-context` 产物并驱动 daemon / backend，但不定义 `filesystem type`、`mount rule` 或 `node semantics`

边界要求：

- hosted runtime 路径固定经 `bridge -> RPC -> daemon`
- daemon 内部实现链固定为 `daemon -> builtin plugin / runtime integration -> VFS`
- runtime integration 不得旁路 `mount namespace`、`mount table` 或 permission chain 暴露第二套访问内核
- 无 daemon 时 bridge 层不提供 runtime / namespace public contract
- bridge 与 third-party tooling 都不得直接依赖 plugin 实现包；稳定复用面必须经 `sdk` 或 `support`

---

## 3. V1 Required Types

V1 后端实现必须围绕以下固定类型工作：

- `mount type`: `root` / `direct`
- `filesystem type`: `hostfs` / `runtimefs`
- `node type`: `directory` / `regular` / `control` / `stream`

实现文档和代码评审时，必须先回答：

- 它属于哪个 `filesystem type`
- 它会暴露哪些 `node type`
- 哪些 capability 支持，哪些不支持
- permission 由谁判定
- 生命周期由谁持有
- 具体挂载语义属于哪个 `mountfs`

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
- `agent-runtime` 等机制模块通过稳定公开边界接入系统
- `agent-runtime` 对 `domain-context` / `acp` / `pi` 的使用属于下游依赖，不改变宿主层级
- `acp` / `pi` 进入系统主线时，必须经 `agent-runtime` 或 `daemon` 已定义的边界接入
- runtime 集成层如需暴露文件系统能力，必须经稳定公开边界进入 `VFS`

---

## 5. V1 Non-Goals

后端实现阶段不得把以下内容偷偷带回 V1：

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 兼容旧中心化 orchestration model
- 兼容旧资源分类中心模型
- bridge 层自带组合根
- 重新引入新的中心扩展模型

---

## 6. Review Checklist

任何后端相关设计或实现评审，至少确认：

1. 是否符合 [spec/index.md](../index.md) 的 Linux 语义基线
2. 是否遵守 [ContextFS Architecture](../../../docs/design/contextfs-architecture.md) 的对象模型
3. 是否遵守 [Actant VFS Reference Architecture](../../../docs/design/actant-vfs-reference-architecture.md) 的实现分层
4. 是否明确了 `filesystem type`、`node type` 与 capability 边界
5. 是否仍遵守 `Contracts Layer / VFS Stack / AgentRuntime Stack / Surface Stack` 的边界
6. 是否避免把 consumer interpretation 写回内核对象模型
7. 是否同步更新 spec/design/roadmap
