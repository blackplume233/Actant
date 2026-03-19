# ContextFS Roadmap

> Status: `M0 completed, M1 next`
> Owner: Actant core architecture
> Scope: 文档基线重置 -> 实现前准备 -> V1 实施顺序

---

## Background

Actant 需要收敛到一个更单一的核心：

- 产品层：`ContextFS`
- 实现层：`VFS Kernel`
- 核心对象：`Project`、`Source`、`Capability`

这不是一次局部重构，而是一次模型替换。  
因此第一步不是写代码，而是先完成文档收口与入口清理，确保仓库中只有一种默认真相。

---

## Goals

- 建立 ContextFS 的单一产品叙述
- 建立 VFS Kernel 的单一实现叙述
- 固定 V1 的对象模型、路径约定、操作面与非目标
- 在进入实现前把历史迁移说明移出主线入口

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
- 历史迁移说明作为默认入口

---

## Milestones

### M0. 文档基线重置

目标：

- 重写 spec/design/roadmap
- 清理默认入口中的历史迁移说明
- 把历史背景集中到单独文档

验收标准：

- `ContextFS` 只表示产品层
- `VFS Kernel` 只表示实现层
- `Project` 不被定义成 `Source`
- `workflow` 不在 V1 顶层对象列表中
- 主线入口不再要求先阅读历史迁移说明

### M1. 契约与类型替换

目标：

- 一次性替换公共对象模型和类型命名
- 删除与当前基线冲突的遗留公共契约

验收标准：

- 新的公共类型可完整表达 `Project`、`Source`、`Capability`
- 全仓不再引用遗留核心类型作为活跃实现接口

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
- 无需引入额外顶层执行系统

### M6. 外部调用面接入

目标：

- CLI/API/daemon/adapter 统一接入新 facade

验收标准：

- 外部调用面只接当前 facade

### M7. V1 Freeze

目标：

- 清理剩余遗留接口
- 完成回归
- 冻结 V1 边界

验收标准：

- 测试、lint、typecheck 全部通过
- 仓库中无历史迁移说明残留在默认入口

---

## Risks And Constraints

- 不保留兼容层意味着文档和实现必须先完全收口
- 入口索引必须同步更新，不能让历史迁移说明继续停留在主入口
- V1 必须保持收缩，不能在实现前重新引入 workflow 或虚拟视图系统
- 历史迁移说明应按需读取，不应成为默认阅读路径

---

## Current Status

| Item | Status |
|------|--------|
| M0 文档基线重置 | completed |
| M1 契约与类型替换 | next |
| M2-M7 实施阶段 | planned |

当前下一步：
1. 以当前 ContextFS / VFS Kernel 文档基线作为唯一真相源进入 M1
2. 替换公共对象模型与类型命名，清理遗留公共契约
3. 为后续 `packages/context` / `packages/vfs` 重建准备新的契约边界
