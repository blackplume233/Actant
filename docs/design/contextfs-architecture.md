# ContextFS Architecture

> Status: Draft
> Date: 2026-03-19
> Scope: 产品层对象模型
> Related: [Actant VFS Reference Architecture](./actant-vfs-reference-architecture.md), [ContextFS Roadmap](../planning/contextfs-roadmap.md)

---

## 1. Positioning

Actant 的核心不是“管理 Agent 的平台”，而是“为 Agent 提供统一上下文访问的系统”。

在新的基线里：

- `ContextFS` 是产品层名称
- `VFS Kernel` 是其实现内核
- `Agent` 是资源，不是平台唯一中心
- `Tool` 是带执行与流能力的文件式资源，不是独立顶层系统

一句话概括：

> **Actant = 面向 Agent 的上下文文件系统。**

---

## 2. Core Claims

### 2.1 上下文管理是平台核心

Actant 优先解决的问题是：

- 统一上下文表示
- 统一上下文寻址
- 统一上下文操作
- 统一权限与生命周期
- 让不同 Agent 通过同一模型消费和暴露上下文

因此，平台的顶层抽象不再是旧 `ContextManager`，而是 `ContextFS`。

### 2.2 一切上下文以文件式资源接口暴露

ContextFS 不要求所有东西底层都存成真实文件，但要求所有上下文都可通过统一文件式接口被访问。

最小操作面：

- `read`
- `write`
- `list`
- `stat`
- `watch`
- `stream`

这是一种接口哲学，而不是存储限制。

### 2.3 Agent 是最复杂、最有价值的一类资源

Agent 仍然是系统中的关键对象，但它不再凌驾于资源模型之上。

在 ContextFS 中：

- Agent 有文件式资源视图
- Agent 具备执行和流能力
- Agent 可以消费上下文
- Agent 也可以暴露上下文

因此 Agent 的角色是：

- 资源
- 资源消费者
- 资源生产者

### 2.4 Tool 不是单独的顶层系统

Tool 在 V1 中不单独作为第二套平台中心出现。

它被建模为带执行/流能力的文件式资源，统一纳入 ContextFS 的资源语义，而不是保留旧“tool 注册中心”路线。

---

## 3. Core Objects

### 3.1 Project

`Project` 是：

- 编排单元
- 权限边界
- VFS 中的投影文件

Project 决定：

- 哪些 Source 被挂载
- 挂载到哪些路径
- 谁可以访问哪些路径
- 子 Project 如何收窄父 Project 的可见性和权限

Project 不是 `Source`。

### 3.2 Source

`Source` 是可挂载的资源提供者。

一个 Source：

- 自包含
- 有明确能力集合
- 通过统一文件式接口暴露内容
- 被挂载到 ContextFS 的某个路径前缀

V1 只内置 4 类 Source：

- `SkillSource`
- `McpConfigSource`
- `McpRuntimeSource`
- `AgentRuntime`

### 3.3 Capability

`Capability` 是 Source 的横切 trait，而不是独立 Source。

V1 关注的能力：

- `Readable`
- `Writable`
- `Listable`
- `Watchable`
- `Streamable`
- `Searchable`

`Versionable` 允许保留为后续能力，但不进入 V1 完成交付要求。

---

## 4. V1 Namespace

V1 固定根路径为：

- `/_project.json`
- `/skills/*`
- `/mcp/configs/*`
- `/mcp/runtime/*`
- `/agents/*`
- `/projects/*`

说明：

- `/_project.json` 是当前 Project 的投影文件
- `/projects/*` 用于子 Project 暴露
- V1 不引入 query/view mount
- V1 不引入 overlay/fallback 行为

---

## 5. Execution Model

V1 不引入独立的顶层 `invoke` 系统。  
执行能力通过“控制节点 + 流节点”表达：

- 写入控制节点触发执行
- 从流节点消费输出

最小约定：

- `/agents/<name>/control/request.json`
- `/agents/<name>/streams/<id>`
- `/mcp/runtime/<name>/streams/<id>`

这样可以保持“文件式资源接口”在 V1 内部的一致性。

---

## 6. Permissions And Lifecycle

权限由 Project 边界负责，不由 Source 自主定义为主入口。

V1 规则：

- 先按 `Project` 判断 caller 可见性
- 再按路径规则决定 `read/write/watch/stream`
- 最后由 Source/Backend 判定该能力是否真实支持

子 Project 只能：

- 收窄可见资源
- 收窄权限

不能扩大父 Project 已声明的能力或权限。

---

## 7. V1 Scope

### Included

- `ContextFS`
- `Project`
- `Source`
- `Capability`
- 4 个 built-in sources
- `read/write/list/stat/watch/stream`
- 控制节点与流节点执行模型

### Excluded

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 完整 cache 架构
- distributed consistency
- 旧 `ContextManager` 平台中心模型
- 旧 `DomainContext` 聚合中心模型

---

## 8. Product/Implementation Split

这份文档只定义产品层对象模型：

- 系统是什么
- 对象是什么
- V1 包含什么
- V1 不包含什么

实现层问题：

- namespace 如何解析
- mount 如何路由
- middleware 如何组织
- node/backend 如何分层
- metadata/lifecycle/events 如何模块化

统一交给 [Actant VFS Reference Architecture](./actant-vfs-reference-architecture.md) 定义。
