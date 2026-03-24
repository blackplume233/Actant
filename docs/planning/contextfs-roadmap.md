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
- [x] M8.7 hosted runtime 边界固定为 `bridge -> RPC -> daemon`
- [x] M8.8 hosted implementation 链固定为 `daemon -> plugin -> provider -> VFS`
- [x] M8.9 `domain-context` / `manager` 最终职责在 active docs 中锁定
- [x] M8.10 active roadmap / TODO truth sources 已与 freeze 基线同步

## Next Actions

- [x] 在 `#322` 审计基线之上完成 Workstream A：去中心注册结构
- [x] 在 `#322` 审计基线之上完成 Workstream B：收口 `daemon / plugin / provider / VFS` 契约
- [x] 在 `#322` 审计基线之上完成 Workstream C：同步活文档与门禁
- [x] 在 `#322` 收口后推进 `#323`：完成历史残留目录与活跃引用清理
- [x] 按 release 流程整理 changelog 汇总与下一阶段里程碑入口

## Active Task

### [x] #322 File-First 下 `domain-context` 最终定位与 VFS 中心边界收口

Status: completed
Owner: architecture convergence

Execution order:

- [x] 先串行冻结 `#322` 基线
- [x] 再串行完成违规路径盘点与包边界决策
- [x] 在基线冻结后并行推进三条工作流：
  - [x] Workstream A: 去中心注册结构
  - [x] Workstream B: 收口 `daemon / plugin / provider / VFS` 契约
  - [x] Workstream C: 同步活文档与门禁
- [x] 最后与 `#323` 联动完成历史残留清理与最终验收

Progress notes:

- [x] Phase 0 baseline freeze 已完成并通过 `ship-sub`
- [x] Draft PR: `#324`
- [x] Merged to `master`: `d4ff12a`
- [x] Phase 1 audit and package-boundary baseline 已完成
- [x] Detailed audit note: `docs/agent/2026-03-23-cursor-322-phase1-audit.md`
- [x] Phase 2 standalone/project-context derived mounts 已切到 snapshot-backed VFS source
- [x] Phase 3 daemon app-context derived mounts 已切到 snapshot-backed VFS source，并在 template / domain 变更后刷新挂载
- [x] Phase 3 verification passed: `pnpm lint`, `pnpm type-check`, `pnpm test`
- [x] Phase 4 overlay cut 已完成并已继续收口：早期 catalog snapshot 实验已退场，当前主线不再保留 `CatalogManager`、catalog overlay 或 namespace `catalogs` 声明
- [x] Phase 4 verification passed: `pnpm type-check`, `pnpm lint`, `pnpm test`
- [x] Phase 5 manager contract cut 已完成：builder / API handler / overlay 读取层已切到 `ComponentResolver` / `MutableComponentCollection` / `ComponentCollection`
- [x] Phase 5 verification passed: `pnpm type-check`, `pnpm lint`, `pnpm test`
- [x] Full Todo 主题 1 已完成一次 ship：`codex/03-24-322-host-runtime-governance` @ `a5a2caf`
- [x] Full Todo 主题 2 已完成一次 ship：`codex/03-24-322-module-structure-governance` @ `10cb9f7`
- [x] Full Todo 主题 3 已完成一次 ship：`codex/03-24-322-daemon-plugin-model` @ `107f5e8`
- [x] Full Todo 主题 4 已完成一次 ship：`codex/03-24-322-provider-contribution-governance` @ `e8adbff`
- [x] Full Todo 主题 5 已完成一次 ship：`codex/03-24-322-vfs-core-governance` @ `e68fb7f`
- [x] 当前已完成一轮 VFS core boundary freeze：core terminology、显式 filesystem metadata、lifecycle contract 与 `agent-runtime` 根导出收口已落地
- [x] A4 keep / migrate / delete baseline 已形成：`docs/agent/2026-03-24-cursor-322-a4-domain-context-boundary.md`
- [x] Full Todo 主题 6 已完成一次 ship：`codex/03-24-322-agent-runtime-positioning` @ `ce84a19`
- [x] `agent-runtime` 活跃定位已冻结为 daemon-hosted runtime module / daemon plugin boundary，死掉的 `domain/template` 兼容入口已删除
- [x] `TemplateRegistry` / `TemplateFileWatcher` 已明确降级为本地 authoring collection / watcher，并纳入 terminology gate
- [x] `acp` / `pi` 的活跃定位已锁定为协议/transport 模块与 backend package，不能越级成为新的宿主层
- [x] `packages/api` 已改为直接依赖 `@actant/domain-context` / `@actant/vfs`；本地 template watcher 已迁到 `packages/api`
- [x] B3 provider SPI / runtimefs contract freeze 已完成：`runtimefs` provider contribution 现在强制为 `data-source`，且必须显式声明 `filesystemType=runtimefs` 与精确 `mountPoint`
- [x] B3 verification passed: `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/vfs type-check`，`PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/vfs/src/__tests__/b3-runtimefs-provider-contract.test.ts packages/vfs/src/__tests__/m5-control-stream-e2e.test.ts`
- [x] dead `packages/domain-context/src/template/watcher/*` 已删除；活跃 template watcher 只保留 `packages/api/src/services/template-directory-watcher.ts`
- [x] `BackendManager` 已脱离 `BaseComponentManager` 继承，`agent-runtime` 保留 API 兼容的本地 backend store / persistence / validation 逻辑
- [x] backend-manager compatibility verification passed: `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/agent-runtime type-check`，`PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/agent-runtime/src/domain/backend/backend-manager-install.test.ts packages/agent-runtime/src/manager/launcher/backend-resolver.test.ts packages/agent-runtime/src/manager/launcher/build-provider-env.test.ts packages/api/src/services/__tests__/hub-context.test.ts`
- [x] `TemplateRegistry` 已脱离 `BaseComponentManager` 继承，并收口为本地 authoring collection；活跃接口不再为 `catalog-manager` 保留兼容
- [x] template-registry compatibility verification passed: `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/domain-context type-check`，`PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/domain-context/src/template/registry/template-registry.test.ts packages/api/src/handlers/__tests__/template-handlers.test.ts packages/agent-runtime/src/initializer/agent-initializer.test.ts`
- [x] `catalog` 已从活跃模块边界删除：`packages/catalog` 物理目录、`catalog/preset` CLI/RPC/REST、plugin `catalogs` contribution、namespace `catalogs` 声明与 overlay 试验实现均已移除
- [x] focused deletion verification passed: `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/shared/src/__tests__/host-types.test.ts packages/agent-runtime/src/plugin/plugin-host.test.ts packages/rest-api/src/server.test.ts packages/mcp-server/src/context-backend.test.ts packages/api/src/services/__tests__/host-profile-compat.test.ts`
- [x] `BaseComponentManager` 已从活跃实现删除；`domain-context` concrete manager 统一收口到 `FileBackedComponentCollection`
- [x] focused collection verification passed: `node node_modules/vitest/vitest.mjs run packages/domain-context/src/domain/component-collection.test.ts packages/domain-context/src/domain/skill/skill-manager.test.ts packages/domain-context/src/domain/prompt/prompt-manager.test.ts packages/domain-context/src/domain/mcp/mcp-config-manager.test.ts packages/domain-context/src/domain/workflow/workflow-manager.test.ts`，`node node_modules/vitest/vitest.mjs run packages/agent-runtime/src/builder/workspace-builder.test.ts packages/agent-runtime/src/domain/domain-context-resolver.test.ts`
- [x] 活跃生产路径中的 `createDomainSource(...)` 已清空；`app-context` / `project-context` derived mounts 统一改为 snapshot-backed registrations，`createDomainSource` 公共 re-export 已移除
- [x] snapshot mount verification passed: `node node_modules/vitest/vitest.mjs run packages/vfs/src/__tests__/domain-source.test.ts packages/mcp-server/src/context-backend.test.ts packages/api/src/handlers/__tests__/vfs-handlers.test.ts`
- [x] `packages/api` 中遗留的 catalog overlay / projection 测试已删除，不再让已退场概念污染活跃回归面
- [x] `TemplateRegistry` 已并入 `FileBackedComponentCollection` 模型；active template 写路径统一改为 `set/delete` 或 `add/remove`
- [x] template collection verification passed: `node node_modules/vitest/vitest.mjs run packages/domain-context/src/template/registry/template-registry.test.ts packages/api/src/handlers/__tests__/template-handlers.test.ts packages/agent-runtime/src/initializer/agent-initializer.test.ts packages/api/src/services/__tests__/domain-context-integration.test.ts`，`node node_modules/vitest/vitest.mjs run packages/agent-runtime/src/manager/agent-manager.test.ts packages/agent-runtime/src/manager/agent-lifecycle-scenarios.test.ts`
- [x] `/skills` daemon derived mount 已切到 snapshot-backed registration；`createSkillSource` 已从活跃生产路径与顶层 public export 移除
- [x] skill snapshot verification passed: `node node_modules/vitest/vitest.mjs run packages/api/src/handlers/__tests__/vfs-handlers.test.ts packages/mcp-server/src/context-backend.test.ts packages/vfs/src/__tests__/m5-filesystem-type-features-e2e.test.ts`
- [x] test-only `createDomainSource` / `createSkillSource` helper 已删除；`domain-source` / `m5` 断言已改成只覆盖当前 snapshot-backed 基线
- [x] helper retirement verification passed: `node node_modules/vitest/vitest.mjs run packages/vfs/src/__tests__/domain-source.test.ts packages/vfs/src/__tests__/m5-filesystem-type-features-e2e.test.ts packages/api/src/handlers/__tests__/vfs-handlers.test.ts packages/mcp-server/src/context-backend.test.ts`
- [x] `BackendManager` singleton 生命周期边界已收口：daemon `AppContext` 现在持有显式 backend manager，并注入 `WorkspaceBuilder` / `AgentInitializer` / `AgentManager` / `ProcessLauncher` / resolver
- [x] backend manager injection verification passed: `node node_modules/vitest/vitest.mjs run packages/agent-runtime/src/builder/workspace-builder.test.ts packages/agent-runtime/src/initializer/agent-initializer.test.ts packages/agent-runtime/src/manager/agent-manager.test.ts packages/agent-runtime/src/manager/launcher/backend-resolver.test.ts`，`node node_modules/vitest/vitest.mjs run packages/api/src/services/__tests__/domain-context-integration.test.ts packages/api/src/services/__tests__/hub-context.test.ts packages/api/src/handlers/__tests__/vfs-handlers.test.ts packages/mcp-server/src/context-backend.test.ts`
- [x] 包层级冻结与 bridge 审查结论已写回活跃 spec/design：最终保留 / 合并 / 删除包表、`actant` 最小职责边界、bridge 审查结论与受控本地例外路径已固定
- [x] `cli hub` 与 `mcp-server` 的 standalone namespace 组装已回收进 `@actant/api#createStandaloneProjectContextRuntime`；bridge 层不再直接 new/mount `VfsRegistry` / `VfsKernel`
- [x] standalone assembly verification passed: `node node_modules/vitest/vitest.mjs run packages/api/src/services/__tests__/project-context-standalone-runtime.test.ts packages/api/src/services/__tests__/hub-context.test.ts`，`node node_modules/vitest/vitest.mjs run packages/mcp-server/src/context-backend.test.ts`，`node node_modules/vitest/vitest.mjs run packages/cli/src/commands/__tests__/commands.test.ts`
- [x] bridge assembly gate passed: `node node_modules/vitest/vitest.mjs run packages/shared/src/__tests__/contextfs-terminology-gate.test.ts`
- [x] final boundary gates passed: `node node_modules/vitest/vitest.mjs run packages/shared/src/__tests__/contextfs-boundary-gate.test.ts`
- [x] daemon/VFS state convergence verification passed: `node node_modules/vitest/vitest.mjs run packages/api/src/services/__tests__/vfs-state-convergence.test.ts`
- [x] release changelog draft created: `docs/agent/changelog-drafts/2026-03-24-codex-322-323-boundary-closure.md`
- [x] release changelog aggregated: `docs/stage/0.5.0/changelog.md`

Authority rule:

- [ ] 本节是 `#322` 的全量执行清单真相源
- [ ] 后续围绕 `#322` 的任务推进、拆分、状态变更都必须持续回写本节

#### 1. 宿主与运行时口径治理

- [x] 固化 `daemon` 是唯一运行时宿主
- [x] 固化 `daemon` 是唯一组合根
- [x] 固化 `bridge` 只负责通过 RPC 与 `daemon` 交互
- [x] 固化 `actant` 只是打包层 / 分发层 / 产品壳
- [x] 删除 `actant app` 作为组合根的旧叙述
- [x] 删除 bridge 层“自带装配能力”的旧叙述
- [x] 清理活文档中所有与上述口径冲突的表述

#### 2. 模块结构治理

- [x] 固化简化模块结构图
- [x] 固化 VFS 内部结构图
- [x] 明确 `daemon -> daemon plugin -> provider contribution -> VFS` 的装载方向
- [x] 明确 `bridge -> RPC -> daemon` 的调用方向
- [x] 明确哪些模块属于 daemon 内部模块
- [x] 明确哪些模块属于 bridge 层
- [x] 明确哪些模块属于打包层

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

- [x] 定义 `provider contribution` 的最小 SPI
- [x] 明确 `provider` 只是 `daemon plugin` 的子能力
- [x] 明确 `provider` 只负责向 VFS 注入 mount/backend/数据来源
- [x] 禁止 `provider` 直接注册领域内容
- [x] 禁止 `provider` 成为中心注册结构
- [x] 禁止 `provider` 替代 `daemon plugin`
- [x] 明确现有来源能力如何迁移为 provider contribution

#### 5. VFS 核心治理

- [x] 固化 `@actant/vfs` 是唯一核心
- [x] 固化 `@actant/vfs` 是唯一真相源
- [x] 固化 `@actant/vfs` 内部结构：`facade / kernel / mount / path / node / permission / lifecycle / storage / index / schema / SPI`
- [x] 明确 `kernel` 只负责统一调度
- [x] 明确 `mount / path / node` 是 VFS 核心骨架
- [x] 明确 `permission / lifecycle / storage / index` 是支撑层
- [x] 明确 `provider SPI` 是插件接入面，不是业务注册面
- [x] 禁止 `domain/catalog/manager` 逻辑进入 VFS core
- [x] 定义 `mount / watch / stream / dispose` 生命周期契约
- [x] 定义 runtimefs 建模边界

#### 6. `agent-runtime` 定位治理

- [x] 固化 `agent-runtime` 是 daemon plugin
- [x] 明确 `agent-runtime` 不是中心层
- [x] 明确 `agent-runtime` 不是组合根
- [x] 明确 `domain-context` / `acp` / `pi` 是 `agent-runtime` 依赖
- [x] 评估是否拆出 `agent-runtime plugin adapter`
- [x] 明确 `agent-runtime` 可向 VFS 注入哪些 provider contribution
- [x] 明确 `agent-runtime` 只通过 VFS 读写系统状态

#### 7. `domain-context` 治理

- [x] 列出 `domain-context` keep / migrate / delete 全清单
- [x] 保留 parser / schema / validator / renderer / resolver
- [x] 删除 manager-first / registry-first 结构
- [x] 删除或迁出 watcher 中非 VFS 驱动部分
- [x] 禁止 `domain-context` 反向生成 VFS
- [x] 禁止 `domain-context` 成为系统状态中心
- [x] 明确哪些能力继续作为 `agent-runtime` 依赖保留

#### 8. `acp` / `pi` 治理

- [x] 明确 `acp` 是 `agent-runtime` 依赖还是 daemon plugin contribution
- [x] 明确 `pi` 是 `agent-runtime` 依赖还是独立 plugin
- [x] 清理 `acp` / `pi` 在文档中的层级漂移描述
- [x] 明确它们与 VFS 的依赖关系不能绕过 `agent-runtime` / `daemon`

#### 9. 去中心注册结构治理

- [x] 删除活跃 `catalog` 模块与其中心注册职责
- [x] 删除 `BaseComponentManager` 中心抽象
- [x] 删除 `domain-source` 这类 `manager -> VFS` 投影结构
- [x] 清点所有 `register/unregister` 真相源式调用点
- [x] 删除所有“内容先进入注册表，再投影回 VFS”的路径
- [x] 将剩余 manager 降级为索引 / 缓存 / 派生视图
- [x] 禁止新增任何中心注册结构

#### 10. 包层级治理

- [x] 定义最终保留包清单
- [x] 定义最终合并包清单
- [x] 定义最终删除包清单
- [x] 明确 `@actant/context -> @actant/api` 合并口径
- [x] 明确 `@actant/catalog` 彻底删除
- [x] 明确 bridge 包的最终保留清单
- [x] 明确 daemon-hosted modules 的最终保留清单
- [x] 明确打包层 `actant` 的最小职责边界

#### 11. 历史残留治理

- [x] 延续 `#323`，删除 `packages/domain`
- [x] 延续 `#323`，删除 `packages/core`
- [x] 清理 `dist/` / `tsbuildinfo` 等残留
- [x] 修正活文档中的 `core/domain` 旧架构描述
- [x] 审视 `actant` 对外导出的 `./core` 别名是否保留
- [x] 对历史文档 / issue / 报告统一标记 `legacy` / `archive`

#### 12. 文档与术语治理

- [x] 更新 `.trellis/spec/index.md`
- [x] 更新 `.trellis/spec/terminology.md`
- [x] 更新 `.trellis/spec/backend/index.md`
- [x] 更新 `docs/design/actant-vfs-reference-architecture.md`
- [x] 统一 `daemon / bridge / daemon plugin / provider contribution` 术语
- [x] 统一 `domain-context` 的最终定义
- [x] 统一 `manager/index/cache/view` 的边界定义
- [x] 增补“禁止中心注册结构”的明确设计约束

#### 13. Bridge 层治理

- [x] 审查 `cli` 是否纯 RPC bridge
- [x] 审查 `rest-api` 是否纯 RPC bridge
- [x] 审查 `tui` 是否纯 RPC bridge
- [x] 审查 `dashboard` 是否只是 bridge 的 UI 外壳
- [x] 审查 `mcp-server` 是否只是 bridge
- [x] 审查 `channel-*` 是否只是 bridge / adapter
- [x] 清理 bridge 层任何自行装载系统的能力

#### 14. 验收治理

- [x] 形成最终模块结构图
- [x] 形成最终 VFS 内部结构图
- [x] 形成最终依赖方向图
- [x] 形成最终保留 / 合并 / 删除包表
- [x] 验证 `daemon` 是唯一组合根
- [x] 验证 bridge 只通过 RPC 与 daemon 交互
- [x] 验证 `provider` 只是 plugin contribution
- [x] 验证系统内不存在中心注册表真相源
- [x] 验证所有真实状态最终收敛到 VFS
- [x] 验证 `domain-context` 只负责解释文件
