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
- [x] M7 Mount Namespace 配置面 + Filesystem Type 闭环
- [x] M8 V1 Freeze

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
- [x] `@actant/context` 不再导出 legacy source-centric orchestration exports
- [x] 主线已包含 `d8ecf2b` 与 `8bbd75c`
- [x] 已取消的 standalone 收敛项不会继续进入活跃任务池

Canceled scope:

- [x] 已取消: Phase 5 MCP standalone 收敛
- [x] 已取消: Phase 6 CLI hub standalone 收敛

### [x] M7 Mount Namespace 配置面 + Filesystem Type 闭环

Status: completed
Owner: namespace and filesystem convergence

Definition of done:

- [x] M7.1 声明式 namespace 配置：`actant.namespace.json` 生效
- [x] M7.2 `mount table` 语义闭环：用户配置面声明 `direct mount`，隐式 `root mount` 经 VFS 解析与描述稳定可见
- [x] M7.3 `filesystem type` 闭环：`hostfs` / `runtimefs` / `memfs` 可注册、可实例化、可描述
- [x] M7.4 `node type` 出口闭环：`stat` / `describe` / CLI / RPC 都稳定暴露 `directory` / `regular` / `control` / `stream`
- [x] M7.5 `actant init` 与 `actant vfs mount add` 生成新 namespace 配置，而不是旧 Source 配置入口
- [x] M7.6 挂载状态持久化：mount instance 与 namespace 状态可恢复，且不把普通读取绑定到 daemon
- [x] M7.7 无常驻进程读取闭环：`hostfs` / `memfs` 直连读取可用，runtime 增强路径与常驻进程解耦
- [x] M7.8 E2E 验收测试覆盖 namespace 配置、自举读取、控制节点、流节点
- [x] M7.9 Quickstart 与工作目录文档改写完成，默认术语切到 Linux 语义

Canceled scope:

- [x] 已取消: 旧 `Source` 配置面作为 V1 默认用户入口
- [x] 已取消: CLI VFS standalone fallback 作为独立里程碑项

### [x] M8 V1 Freeze

Status: completed
Owner: release hardening

Definition of done:

- [x] M8.1 共享类型与公共契约 freeze
- [x] M8.2 `@actant/context` source-centric 残留清理
- [x] M8.3 `source -> catalog` 全仓强清
- [x] M8.4 standalone / proxy / host-profile legacy path 切断
- [x] M8.5 active docs / help / gates 冻结
- [x] M8.6 端到端回归与 release 汇总

## Next Actions

- [ ] 激活 `#322` 作为当前主线：收敛 `domain-context / catalog / manager` 边界，固定 `VFS` 为唯一真相源、`daemon` 为唯一组合根
- [ ] 以本文件中的 `#322` 全量 todo 作为当前活跃任务的权威清单，并在后续任务推进中持续维护
- [ ] 在 `#322` 收口后推进 `#323`：删除 `packages/core` 与 `packages/domain` 等历史残留
- [ ] 按 release 流程整理 changelog 汇总与下一阶段里程碑入口

## Active Task

### [ ] #322 File-First 下 `domain-context` 最终定位与 VFS 中心边界收口

Status: in progress
Owner: architecture convergence

Execution order:

- [x] 先串行冻结 `#322` 基线
- [ ] 再串行完成违规路径盘点与包边界决策
- [ ] 在基线冻结后并行推进三条工作流：
  - [ ] Workstream A: 去中心注册结构
  - [ ] Workstream B: 收口 `daemon / plugin / provider / VFS` 契约
  - [ ] Workstream C: 同步活文档与门禁
- [ ] 最后与 `#323` 联动完成历史残留清理与最终验收

Progress notes:

- [x] Phase 0 baseline freeze 已完成并通过 `ship-sub`
- [x] Draft PR: `#324`
- [x] Merged to `master`: `d4ff12a`

Authority rule:

- [ ] 本节是 `#322` 的全量执行清单真相源
- [ ] 后续围绕 `#322` 的任务推进、拆分、状态变更都必须持续回写本节

#### 1. 宿主与运行时口径治理

- [ ] 固化 `daemon` 是唯一运行时宿主
- [ ] 固化 `daemon` 是唯一组合根
- [ ] 固化 `bridge` 只负责通过 RPC 与 `daemon` 交互
- [ ] 固化 `actant` 只是打包层 / 分发层 / 产品壳
- [ ] 删除 `actant app` 作为组合根的旧叙述
- [ ] 删除 bridge 层“自带装配能力”的旧叙述
- [ ] 清理活文档中所有与上述口径冲突的表述

#### 2. 模块结构治理

- [ ] 固化简化模块结构图
- [ ] 固化 VFS 内部结构图
- [ ] 明确 `daemon -> daemon plugin -> provider contribution -> VFS` 的装载方向
- [ ] 明确 `bridge -> RPC -> daemon` 的调用方向
- [ ] 明确哪些模块属于 daemon 内部模块
- [ ] 明确哪些模块属于 bridge 层
- [ ] 明确哪些模块属于打包层

#### 3. 插件模型治理

- [x] 定义 `daemon plugin` 是系统唯一有效扩展单元
- [x] 定义 `daemon plugin` 的最小契约
- [x] 定义 plugin 生命周期：`activate / deactivate / dispose`
- [x] 定义 plugin 可贡献能力集合：`provider / rpc / hooks / services`
- [x] 定义 plugin 元信息模型
- [x] 定义 plugin 装载位置只能在 `daemon`
- [x] 禁止 bridge 层直接装载 plugin
- [x] 禁止 `provider` 继续被当作系统顶层插件模型

#### 4. Provider contribution 治理

- [ ] 定义 `provider contribution` 的最小 SPI
- [ ] 明确 `provider` 只是 `daemon plugin` 的子能力
- [ ] 明确 `provider` 只负责向 VFS 注入 mount/backend/数据来源
- [ ] 禁止 `provider` 直接注册领域内容
- [ ] 禁止 `provider` 成为中心注册结构
- [ ] 禁止 `provider` 替代 `daemon plugin`
- [ ] 明确现有来源能力如何迁移为 provider contribution

#### 5. VFS 核心治理

- [ ] 固化 `@actant/vfs` 是唯一核心
- [ ] 固化 `@actant/vfs` 是唯一真相源
- [ ] 固化 `@actant/vfs` 内部结构：`facade / kernel / mount / path / node / permission / lifecycle / storage / index / schema / SPI`
- [ ] 明确 `kernel` 只负责统一调度
- [ ] 明确 `mount / path / node` 是 VFS 核心骨架
- [ ] 明确 `permission / lifecycle / storage / index` 是支撑层
- [ ] 明确 `provider SPI` 是插件接入面，不是业务注册面
- [ ] 禁止 `domain/catalog/manager` 逻辑进入 VFS core
- [ ] 定义 `mount / watch / stream / dispose` 生命周期契约
- [ ] 定义 runtimefs 建模边界

#### 6. `agent-runtime` 定位治理

- [ ] 固化 `agent-runtime` 是 daemon plugin
- [ ] 明确 `agent-runtime` 不是中心层
- [ ] 明确 `agent-runtime` 不是组合根
- [ ] 明确 `domain-context` / `acp` / `pi` 是 `agent-runtime` 依赖
- [ ] 评估是否拆出 `agent-runtime plugin adapter`
- [ ] 明确 `agent-runtime` 可向 VFS 注入哪些 provider contribution
- [ ] 明确 `agent-runtime` 只通过 VFS 读写系统状态

#### 7. `domain-context` 治理

- [ ] 列出 `domain-context` keep / migrate / delete 全清单
- [ ] 保留 parser / schema / validator / renderer / resolver
- [ ] 删除 manager-first / registry-first 结构
- [ ] 删除或迁出 watcher 中非 VFS 驱动部分
- [ ] 禁止 `domain-context` 反向生成 VFS
- [ ] 禁止 `domain-context` 成为系统状态中心
- [ ] 明确哪些能力继续作为 `agent-runtime` 依赖保留

#### 8. `acp` / `pi` 治理

- [ ] 明确 `acp` 是 `agent-runtime` 依赖还是 daemon plugin contribution
- [ ] 明确 `pi` 是 `agent-runtime` 依赖还是独立 plugin
- [ ] 清理 `acp` / `pi` 在文档中的层级漂移描述
- [ ] 明确它们与 VFS 的依赖关系不能绕过 `agent-runtime` / `daemon`

#### 9. 去中心注册结构治理

- [ ] 删除 `CatalogManager` 的中心注册职责
- [ ] 删除 `BaseComponentManager` 中心抽象
- [ ] 删除 `domain-source` 这类 `manager -> VFS` 投影结构
- [ ] 清点所有 `register/unregister` 真相源式调用点
- [ ] 删除所有“内容先进入注册表，再投影回 VFS”的路径
- [ ] 将剩余 manager 降级为索引 / 缓存 / 派生视图
- [ ] 禁止新增任何中心注册结构

#### 10. 包层级治理

- [ ] 定义最终保留包清单
- [ ] 定义最终合并包清单
- [ ] 定义最终删除包清单
- [ ] 明确 `@actant/context -> @actant/api` 合并口径
- [ ] 明确 `@actant/catalog` 是拆散为 plugin contribution 还是彻底删除
- [ ] 明确 bridge 包的最终保留清单
- [ ] 明确 daemon-hosted modules 的最终保留清单
- [ ] 明确打包层 `actant` 的最小职责边界

#### 11. 历史残留治理

- [ ] 延续 `#323`，删除 `packages/domain`
- [ ] 延续 `#323`，删除 `packages/core`
- [ ] 清理 `dist/` / `tsbuildinfo` 等残留
- [ ] 修正活文档中的 `core/domain` 旧架构描述
- [ ] 审视 `actant` 对外导出的 `./core` 别名是否保留
- [ ] 对历史文档 / issue / 报告统一标记 `legacy` / `archive`

#### 12. 文档与术语治理

- [ ] 更新 `.trellis/spec/index.md`
- [ ] 更新 `.trellis/spec/terminology.md`
- [ ] 更新 `.trellis/spec/backend/index.md`
- [ ] 更新 `docs/design/actant-vfs-reference-architecture.md`
- [ ] 统一 `daemon / bridge / daemon plugin / provider contribution` 术语
- [ ] 统一 `domain-context` 的最终定义
- [ ] 统一 `manager/index/cache/view` 的边界定义
- [ ] 增补“禁止中心注册结构”的明确设计约束

#### 13. Bridge 层治理

- [ ] 审查 `cli` 是否纯 RPC bridge
- [ ] 审查 `rest-api` 是否纯 RPC bridge
- [ ] 审查 `tui` 是否纯 RPC bridge
- [ ] 审查 `dashboard` 是否只是 bridge 的 UI 外壳
- [ ] 审查 `mcp-server` 是否只是 bridge
- [ ] 审查 `channel-*` 是否只是 bridge / adapter
- [ ] 清理 bridge 层任何自行装载系统的能力

#### 14. 验收治理

- [ ] 形成最终模块结构图
- [ ] 形成最终 VFS 内部结构图
- [ ] 形成最终依赖方向图
- [ ] 形成最终保留 / 合并 / 删除包表
- [ ] 验证 `daemon` 是唯一组合根
- [ ] 验证 bridge 只通过 RPC 与 daemon 交互
- [ ] 验证 `provider` 只是 plugin contribution
- [ ] 验证系统内不存在中心注册表真相源
- [ ] 验证所有真实状态最终收敛到 VFS
- [ ] 验证 `domain-context` 只负责解释文件
