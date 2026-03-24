# Backend Development Guidelines

> 本文档定义 ContextFS / VFS 基线下的后端实现方向。

---

## 1. Current Backend Baseline

后端开发当前必须以前述 Linux 语义对象模型为前提：

- `daemon`
- `bridge`
- `Contracts Layer`
- `VFS Stack`
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
- 承载 `agent-runtime`、`domain-context`、`acp`、`pi` 等运行时能力
- 维护 agent 生命周期、执行状态与集成能力

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

### Agent Runtime Layer

`agent-runtime` 在 V1 中是由 `daemon` 装载的运行机制模块。

负责：

- 承载 agent orchestration
- 基于 VFS 公开能力读写运行时状态
- 依赖 `domain-context`、`acp`、`pi` 等下游能力模块完成解释、协议或集成
 - 通过兼容适配承接遗留 workspace materialization

不负责：

- 成为系统组合根
- 绕过 `daemon` 直接向 bridge 暴露宿主能力
- 绕过 VFS 建立第二套系统状态真相源
- 把 legacy workspace materialization adapter 升级成新的顶层扩展模型

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
| `@actant/cli` | `bridge shell with bounded local exceptions` | 默认是 RPC bridge；允许 `actant init`、daemon entry、hub standalone namespace fallback 这类受控本地路径 |
| `@actant/mcp-server` | `bridge shell with bounded local exceptions` | 默认经 RPC 消费 daemon；允许 standalone namespace fallback 以提供只读/有限本地 VFS 视图 |
| `@actant/tui` | `not a bridge` | 纯 UI 组件库，只消费流类型，不承担 RPC/daemon 边界 |
| `@actant/channel-*` | `adapter, not bridge` | 协议/SDK 适配层，可消费 `agent-runtime` channel contract，但不是 daemon host |

对 bridge 的进一步约束：

- bridge 包不得直接持有第二套 runtime 组合逻辑
- bridge 包不得持有 `mount table`、`filesystem type registry`
- bridge 包允许存在受控的 local namespace fallback，但该 fallback 只能：
  - 用于无 daemon 的本地读取 / 诊断 / 初始化路径
  - 复用既有 namespace projection helper
  - 不得演化成第二套系统组合根
- `rest-api` / `dashboard` 不应引入 standalone VFS kernel 组装逻辑
- `cli` / `mcp-server` 的本地 fallback 必须继续显式标记为 `standalone namespace mode`

## 2.3 Frozen Runtime And Support Roles

当前 M8 freeze 基线额外固定以下角色：

- `daemon`: 运行时宿主与生命周期边界，负责持有 namespace / runtime state，并承接 `RPC` 调用
- `domain-context`: 模板、组件定义、provider 描述与校验解析所在层；不是聚合中心，不持有 `mount namespace` 或 `VFS` 生命周期
- `manager`: session / process / backend lifecycle orchestration；消费 `domain-context` 产物并驱动 daemon / backend，但不定义 `filesystem type`、`mount rule` 或 `node semantics`

边界要求：

- hosted runtime 路径固定经 `bridge -> RPC -> daemon`
- daemon 内部实现链固定为 `daemon -> runtime integration -> VFS`
- runtime integration 不得旁路 `mount namespace`、`mount table` 或 permission chain 暴露第二套访问内核
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
