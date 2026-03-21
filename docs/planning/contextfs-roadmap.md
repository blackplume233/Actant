# ContextFS Roadmap

> Status: `M5 completed, M6 in-progress`
> Owner: Actant core architecture
> Scope: 文档基线重置 -> 实现前准备 -> V1 实施顺序

---

## Background

Actant 需要收敛到一个更单一的核心：

- 产品层：`ContextFS`
- 实现层：`VFS Kernel`
- 核心对象：`Project`、`SourceType`、`Source`、`Trait`、`Capability`

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

- 兼容层设计
- workflow 设计
- query/view mount
- overlay/fallback mount 的行为实现
- 完整 cache / distributed consistency
- 无 daemon standalone 模式（已确认 daemon 启动是可接受的）

---

## Architecture Baseline

### Product Layer: ContextFS

- Actant 的核心是上下文管理，而不是 Agent 管理
- 所有上下文以文件式资源接口暴露
- `Agent` 是最复杂、最有价值的一类资源
- `Tool` 不是独立顶层系统，而是带执行/流能力的文件式资源
- `Project` 是编排单元、权限边界，以及 VFS 中的投影文件
- `SourceType` 是带逻辑的类型定义（传输策略、配置 schema、实例化工厂）
- `Source` 是 `SourceType` 的实例，是挂载单位
- `Trait` 是 Source 声明的原子能力特征，替代旧 `VfsSourceType` 名义标签
- `Capability` 是具体操作能力

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

- `read` / `read_range`
- `write` / `edit` / `delete`
- `list` / `stat`
- `tree` / `glob` / `grep`
- `watch` / `stream`

### V1 Exclusions

- `workflow`
- view/query mount
- overlay/fallback 行为实现
- 历史迁移说明作为默认入口
- 旧 `VfsSourceType` 名义类型标签
- 无 daemon standalone 模式

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

### M5. 控制节点执行模型 + SourceType/Trait 体系

目标：

- 通过控制节点写入触发执行
- 通过流节点消费输出
- 引入 SourceType 注册表，替代 hardcoded switch-case 工厂
- 移除 `VfsSourceType` 名义类型标签，以 Trait 声明替代
- 每个 SourceType 自定义配置结构（去中心化，不依赖中心 discriminated union）
- 上层通过 required/optional trait 约束 Source

验收标准：

- agent/runtime 可执行且流输出稳定
- 无需引入额外顶层执行系统
- `VfsSourceRegistration` 使用 `traits: Set<Trait>` 替代旧 `sourceType: VfsSourceType`
- 新增 SourceType 不需修改中心类型定义，只需注册进 SourceType 注册表
- 内置 4 个 Source 均声明各自的 Trait 集合
- 上层编排可通过 trait 约束做 Source 匹配

### M6. Facade 统一（内部收敛）

目标：

- 所有外部调用面经同一 VfsFacade 分派，middleware 对所有操作生效
- 消除重复逻辑，建立单一调用路径

已完成：

- **Phase A**: VfsKernel 扩展到 12 个操作 + VfsFacade 模块创建
- **Phase 3**: 共享 Hub 路径映射模块提取（`@actant/shared/hub-paths`）
- **Phase 4**: API vfs-handlers 收敛到 VfsKernel（edit/delete/tree/glob/grep/readRange 全部经 kernel）

剩余：

- **Phase 7**: ACP VfsInterceptor 收敛到 VfsKernel
- **Phase 8**: 清理 ContextManager / DomainContextSource 遗留导出

已取消（standalone 模式不再需要）：

- ~~Phase 5: MCP standalone 收敛~~
- ~~Phase 6: CLI hub standalone 收敛~~

验收标准：

1. VfsKernel 支持全部 12 个数据操作，全部经 middleware 链
2. vfs-handlers.ts 无 `registry.resolve` + `source.handlers.*` 直调
3. ACP interceptor 使用 VfsKernel
4. Hub 路径映射单一来源（`@actant/shared/hub-paths`）
5. `@actant/context` 不再导出 ContextManager
6. lint / type-check / 全量测试通过

### M7. Source 配置面 + 自举就绪（外部可用）

目标：

- 外部用户（Codex / 开发者）可以通过配置文件和 CLI 完整配置 VFS source
- 实现 Actant 自举开发
- 基于项目的隔离和动态加卸载

子项：

- **M7.1** 声明式 Source 配置 — `actant.project.json` mounts 字段生效
- **M7.2** `actant init` 命令 — 项目配置脚手架
- **M7.3** `actant vfs mount add` CLI — 动态挂载命令
- **M7.4** 挂载持久化 — VfsDataStore 接入 daemon
- **M7.5** Bootstrap 写策略 — 解除 Codex 冷启动限制
- **M7.7** E2E 验收测试 — 模拟 Codex 自举开发流程
- **M7.8** Quickstart 文档

已取消：

- ~~M7.6 CLI VFS Standalone Fallback — 无 daemon 只读模式~~（daemon 启动是可接受的）

验收标准：

1. `actant.project.json` 中 `mounts` 声明被 hub activate 正确应用
2. `actant init` 可用
3. `actant vfs mount add` 可用，动态挂载持久化
4. Bootstrap 写限制不阻塞 Codex 工作流
5. E2E 测试全部通过
6. Quickstart 可独立跑通

### M8. V1 Freeze

目标：

- 清理剩余遗留接口
- 完成全量回归
- 冻结 V1 边界

验收标准：

- 全仓 lint / type-check / test 通过
- 无历史迁移说明残留在默认入口
- V1 scope 文档化冻结

---

## Risks And Constraints

- 不保留兼容层意味着文档和实现必须先完全收口
- 入口索引必须同步更新，不能让历史迁移说明继续停留在主入口
- V1 必须保持收缩，不能在实现前重新引入 workflow 或虚拟视图系统
- 历史迁移说明应按需读取，不应成为默认阅读路径
- Trait 替代 VfsSourceType 需要同步更新所有 source 实现的注册代码

---

## Current Status

| Item | Status |
|------|--------|
| M0 文档基线重置 | completed |
| M1 契约与类型替换 | completed |
| M2 VFS Kernel 重建 | completed |
| M3 ContextFS 编排层重建 | completed |
| M4 4 个 Built-In Source 落地 | completed |
| M5 控制节点执行模型 + SourceType/Trait 体系 | completed |
| M6 Facade 统一（内部收敛） | in-progress (Phase A/3/4 done, Phase 7/8 remaining) |
| M7 Source 配置面 + 自举就绪 | planned |
| M8 V1 Freeze | planned |

当前下一步：
1. 完成 M6 Phase 7（ACP interceptor 收敛到 VfsKernel）
2. 完成 M6 Phase 8（清理 ContextManager / DomainContextSource 遗留）
3. 进入 M7 声明式 Source 配置 + 动态挂载
