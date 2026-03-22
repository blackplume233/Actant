# ContextFS Roadmap

> Active planning truth source. Use checklist status only.
> Owner: Actant core architecture

## Baseline Constraints

- [x] 产品层统一为 `ContextFS`
- [x] 实现层统一为 `VFS Kernel`
- [x] V1 只承认 `Project`、`SourceType`、`Source`、`Trait`、`Capability`
- [x] 历史迁移说明不再占用默认入口
- [x] 活跃 roadmap 必须用 checklist / todolist 表达状态

## Milestone Overview

- [x] M0 文档基线重置
- [x] M1 契约与类型替换
- [x] M2 VFS Kernel 重建
- [x] M3 ContextFS 编排层重建
- [x] M4 Built-In Sources 落地
- [x] M5 控制节点执行模型 + SourceType / Trait 体系
- [x] M6 Facade 统一（内部收敛）
- [ ] M7 Source 配置面 + 自举就绪
- [ ] M8 V1 Freeze

## Milestones

### [x] M0 文档基线重置

Status: completed
Owner: Actant core architecture

Definition of done:

- [x] 重写 spec / design / roadmap
- [x] 清理默认入口中的历史迁移说明
- [x] 保证 `ContextFS` 只表示产品层
- [x] 保证 `VFS Kernel` 只表示实现层
- [x] 不再把 `workflow` 写成 V1 顶层对象

### [x] M1 契约与类型替换

Status: completed
Owner: backend contracts

Definition of done:

- [x] 公共对象模型统一到 `Project` / `Source` / `Capability`
- [x] 活跃实现面不再依赖遗留核心契约命名
- [x] 相关 spec / terminology 已同步

### [x] M2 VFS Kernel 重建

Status: completed
Owner: `packages/vfs`

Definition of done:

- [x] direct mount 可用
- [x] middleware 权限链可用
- [x] `read/write/list/stat/watch/stream` 路由可用
- [x] 主线已合并 `PR #305`

### [x] M3 ContextFS 编排层重建

Status: completed
Owner: `packages/context`

Definition of done:

- [x] `ProjectManifest` 装载模型可工作
- [x] root / child project 语义清晰
- [x] 权限边界与收窄规则明确
- [x] 主线已合并 `PR #306`

### [x] M4 Built-In Sources 落地

Status: completed
Owner: ContextFS built-in sources

Definition of done:

- [x] `SkillSource`
- [x] `McpConfigSource`
- [x] `McpRuntimeSource`
- [x] `AgentRuntime`
- [x] 四类资源都经统一 ContextFS / VFS 接口访问
- [x] 主线已合并 `PR #308`

### [x] M5 控制节点执行模型 + SourceType / Trait 体系

Status: completed
Owner: execution model + source registry

Definition of done:

- [x] 控制节点写入触发执行
- [x] 流节点稳定消费输出
- [x] SourceType 注册表替代 hardcoded switch-case 工厂
- [x] `Trait` 替代旧 `VfsSourceType` 名义标签
- [x] 新增 SourceType 不需要修改中心 discriminated union
- [x] 主线已合并 `PR #309`
- [x] 主线已合并 `PR #311`

### [x] M6 Facade 统一（内部收敛）

Status: completed
Owner: VFS facade convergence

Definition of done:

- [x] 所有外部调用面经同一 `VfsFacade` / `VfsKernel` 路径分派
- [x] middleware 对全部数据操作生效
- [x] Hub 路径映射收敛到 `@actant/shared/hub-paths`
- [x] ACP `VfsInterceptor` 收敛到 `VfsKernel`
- [x] `@actant/context` 不再导出 legacy `ContextManager` / `DomainContextSource`
- [x] 主线已包含 `d8ecf2b` 与 `8bbd75c`
- [x] 已取消的 standalone 收敛项不会继续进入活跃任务池

Canceled scope:

- [x] 已取消: Phase 5 MCP standalone 收敛
- [x] 已取消: Phase 6 CLI hub standalone 收敛

### [ ] M7 Source 配置面 + 自举就绪

Status: todo
Owner: external bootstrap flow

Definition of done:

- [ ] M7.1 声明式 Source 配置：`actant.project.json` mounts 生效
- [ ] M7.2 `actant init` 命令
- [ ] M7.3 `actant vfs mount add` CLI
- [ ] M7.4 挂载持久化：`VfsDataStore` 接入 daemon
- [ ] M7.5 Bootstrap 写策略解除 Codex 冷启动限制
- [ ] M7.7 E2E 验收测试覆盖自举开发流程
- [ ] M7.8 Quickstart 文档

Canceled scope:

- [x] 已取消: M7.6 CLI VFS Standalone Fallback

### [ ] M8 V1 Freeze

Status: todo
Owner: release hardening

Definition of done:

- [ ] 清理剩余遗留接口
- [ ] 完成全量回归
- [ ] 冻结 V1 边界
- [ ] 全仓 lint / type-check / test 通过

## Next Actions

- [ ] 从 M7.1 开始推进声明式 Source 配置
- [ ] 为 M7 建立新的 active task，而不是复用已完成的 M0-M6 任务目录
- [ ] release 前继续把 changelog draft 汇总进 `docs/stage/<version>/changelog.md`
