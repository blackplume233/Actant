# ContextFS Roadmap

> Active planning truth source. Use checklist status only.
> Owner: Actant core architecture

## Baseline Constraints

- [x] 产品层统一为 `ContextFS`
- [x] 实现层统一为 `VFS`
- [x] V1 只承认 `mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- [x] 历史迁移说明不再占用默认入口
- [x] 活跃 roadmap 必须用 checklist / todolist 表达状态

## Milestone Overview

- [x] M0 文档基线重置
- [x] M1 契约与类型替换
- [x] M2 VFS 重建
- [x] M3 ContextFS 编排层重建
- [x] M4 内置挂载族首轮落地
- [x] M5 控制节点执行模型 + 开放类型注册
- [x] M6 Facade 统一（内部收敛）
- [ ] M7 Mount Namespace 配置面 + Filesystem Type 闭环
- [ ] M8 V1 Freeze

## Milestones

### [x] M0 文档基线重置

Status: completed
Owner: Actant core architecture

Definition of done:

- [x] 重写 spec / design / roadmap
- [x] 清理默认入口中的历史迁移说明
- [x] 保证 `ContextFS` 只表示产品层
- [x] 保证 `VFS` 只表示实现层
- [x] 不再把 `workflow` 写成 V1 顶层对象

### [x] M1 契约与类型替换

Status: completed
Owner: backend contracts

Definition of done:

- [x] 公共契约开始向当前 V1 对象边界收敛
- [x] 活跃实现面不再依赖更早一代核心契约命名
- [x] 相关 spec / terminology 已同步

### [x] M2 VFS 重建

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

- [x] namespace 声明装载模型可工作
- [x] root / child mount 语义清晰
- [x] 权限边界与收窄规则明确
- [x] 主线已合并 `PR #306`

### [x] M4 内置挂载族首轮落地

Status: completed
Owner: built-in mounts

Definition of done:

- [x] skill 类内容、MCP 配置、MCP runtime、agent runtime 首轮纳入统一访问面
- [x] 内置挂载族都经统一 ContextFS / VFS 接口访问
- [x] 主线已合并 `PR #308`

### [x] M5 控制节点执行模型 + 开放类型注册

Status: completed
Owner: execution model + registry

Definition of done:

- [x] 控制节点写入触发执行
- [x] 流节点稳定消费输出
- [x] 注册表替代 hardcoded switch-case 工厂
- [x] 类型扩展不再依赖旧名义标签体系
- [x] 新增挂载家族不需要修改中心 discriminated union
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

### [ ] M7 Mount Namespace 配置面 + Filesystem Type 闭环

Status: todo
Owner: namespace and filesystem convergence

Definition of done:

- [ ] M7.1 声明式 namespace 配置：`actant.namespace.json` 生效
- [ ] M7.2 `mount table` 配置闭环：`root` / `direct` mount 可声明、可解析、可持久化
- [ ] M7.3 `filesystem type` 闭环：`hostfs` / `runtimefs` / `memfs` 可注册、可实例化、可描述
- [ ] M7.4 `node type` 出口闭环：`stat` / `describe` / CLI / RPC 都稳定暴露 `directory` / `regular` / `control` / `stream`
- [ ] M7.5 `actant init` 与 `actant vfs mount add` 生成新 namespace 配置，而不是旧 Source 配置入口
- [ ] M7.6 挂载状态持久化：mount instance 与 namespace 状态可恢复，且不把普通读取绑定到 daemon
- [ ] M7.7 无常驻进程读取闭环：`hostfs` / `memfs` 直连读取可用，runtime 增强路径与常驻进程解耦
- [ ] M7.8 E2E 验收测试覆盖 namespace 配置、自举读取、控制节点、流节点
- [ ] M7.9 Quickstart 与工作目录文档改写完成，默认术语切到 Linux 语义

Canceled scope:

- [x] 已取消: 旧 `Source` 配置面作为 V1 默认用户入口
- [x] 已取消: CLI VFS standalone fallback 作为独立里程碑项

### [ ] M8 V1 Freeze

Status: todo
Owner: release hardening

Definition of done:

- [ ] 清理剩余遗留接口
- [ ] 完成全量回归
- [ ] 冻结 V1 边界
- [ ] 全仓 lint / type-check / test 通过

## Next Actions

- [ ] 从 M7.1 开始推进 `actant.namespace.json` 与 `mount table` 配置闭环
- [ ] 优先打通 `hostfs` / `runtimefs` / `memfs` 的 `filesystem type` 最小闭环
- [ ] 为公共接口补齐 `node type`
- [ ] 为 M7 建立新的 active task，而不是复用已完成的 M0-M6 任务目录
- [ ] release 前继续把 changelog draft 汇总进 `docs/stage/<version>/changelog.md`
