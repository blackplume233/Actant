# ContextFS Roadmap

> Status: `in progress`
> Owner: Actant core architecture
> Scope: 文档基线重置 -> 实现前准备 -> V1 实施顺序

---

## Background

Actant 需要从“围绕 AgentManager/ContextManager 演进的多层平台叙事”收敛到一个更单一的核心：

- 产品层：`ContextFS`
- 实现层：`VFS Kernel`
- 核心对象：`Project`、`Source`、`Capability`

这不是一次局部重构，而是一次模型替换。  
因此第一步不是写代码，而是重写文档并删除过时架构描述，确保仓库中只有一种有效真相。

---

## Goals

- 建立 ContextFS 的单一产品叙述
- 建立 VFS Kernel 的单一实现叙述
- 固定 V1 的对象模型、路径约定、操作面与非目标
- 在进入实现前清除旧 `ContextManager` / `DomainContext` 主线造成的文档污染

---

## Non-Goals

本 roadmap 的第一阶段不包含：

- `packages/` 下的代码重构
- 兼容层设计
- 测试迁移
- CLI/API/daemon 行为修改
- workflow 设计
- query/view mount
- overlay/fallback mount 的行为实现
- 完整 cache / distributed consistency

---

## Architecture Baseline

### Product Layer: ContextFS

- Actant 的核心是上下文管理，而不是 Agent 管理
- 所有上下文以文件式资源接口暴露
- `Agent` 是最复杂、最有价值的一类资源
- `Tool` 不是独立顶层系统，而是带执行/流能力的文件式资源
- `Project` 是编排单元、权限边界，以及 VFS 中的投影文件
- `Source` 是挂载单位
- `Capability` 是横切 trait

### Implementation Layer: VFS Kernel

- Kernel 是 resource kernel，不是 source router
- Kernel 负责：
  - namespace
  - mount
  - middleware
  - node/backend
  - metadata
  - lifecycle
  - events
- V1 只实现 `direct mount`

### V1 Built-In Sources

- `SkillSource`
- `McpConfigSource`
- `McpRuntimeSource`
- `AgentRuntime`

### V1 Operation Surface

- `read`
- `write`
- `list`
- `stat`
- `watch`
- `stream`

### V1 Exclusions

- `workflow`
- view/query mount
- overlay/fallback 行为实现
- 旧 `ContextManager` 模型
- 旧 tool registry 作为顶层系统

---

## Milestones

### M0. 文档基线重置

目标：

- 重写 spec/design/roadmap
- 删除过时架构文档
- 清理旧术语和旧引用

验收标准：

- `ContextFS` 只表示产品层
- `VFS Kernel` 只表示实现层
- `Project` 不被定义成 `Source`
- `workflow` 不在 V1 顶层对象列表中
- `ContextManager` 不再作为当前架构核心术语出现

### M1. 契约与类型替换

目标：

- 一次性替换公共对象模型和类型命名
- 删除旧 `ContextManager` / `ContextSourceType` / handler-centric 契约

验收标准：

- 新的公共类型可完整表达 `Project`、`Source`、`Capability`
- 全仓不再引用旧核心类型作为活跃实现接口

### M2. VFS Kernel 重建

目标：

- 重建 `packages/vfs`
- 从 source-centric 路由切到 kernel 分层

验收标准：

- direct mount 可用
- middleware 权限链可用
- `read/write/list/stat/watch/stream` 路由可用

### M3. ContextFS 编排层重建

目标：

- 重建 `packages/context`
- 引入 `ProjectManifest`
- 建立 project/permissions 语义

验收标准：

- root project 与 child project 装载可工作
- 权限边界与收窄规则清晰

### M4. 4 个 Built-In Source 落地

目标：

- 实现 `SkillSource`
- `McpConfigSource`
- `McpRuntimeSource`
- `AgentRuntime`

验收标准：

- 四类资源都经 ContextFS/VFS 同一接口访问
- 动态资源支持 watch/stream

### M5. 控制节点与流节点执行模型

目标：

- 通过控制节点写入触发执行
- 通过流节点消费输出

验收标准：

- agent/runtime 可执行且流输出稳定
- 无需恢复旧 tool registry

### M6. 外部调用面接入

目标：

- CLI/API/daemon/adapter 统一接入新 facade

验收标准：

- 外部调用面不再直接接旧 registry/handler 体系

### M7. V1 Freeze

目标：

- 清理剩余旧接口
- 完成回归
- 冻结 V1 边界

验收标准：

- 测试、lint、typecheck 全部通过
- 仓库中无旧模型残留为当前真相

---

## Risks And Constraints

- 不保留兼容层意味着文档和实现必须先完全收口
- 删除旧文档后，所有入口索引必须同步更新，不能留下死链作为主入口
- V1 必须保持收缩，不能在实现前重新引入 workflow 或虚拟视图系统
- 历史信息依赖 git，不在工作树保留过时文档副本

---

## Current Status

| Item | Status |
|------|--------|
| M0 文档基线重置 | in progress |
| M1-M7 实施阶段 | planned |

当前下一步：

1. 完成 spec/design/roadmap 重写
2. 清理与新基线冲突的旧设计文档
3. 做一轮全仓术语检查，确认进入实现前没有双重真相
