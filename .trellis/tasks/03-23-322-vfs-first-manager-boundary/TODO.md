# TODO

> Task: `#322`
> Working view only. Authority remains `docs/planning/contextfs-roadmap.md`.

## Execution Order

- [x] 先串行冻结 `#322` 基线
- [x] 再串行完成违规路径盘点与包边界决策
- [ ] 在基线冻结后并行推进三条工作流：
  - [ ] Workstream A: 去中心注册结构
  - [x] Workstream B: 收口 `daemon / plugin / provider / VFS` 契约
  - [x] Workstream C: 同步活文档与门禁
- [ ] 最后与 `#323` 联动完成历史残留清理与最终验收

## Progress Notes

- [x] Phase 0 baseline freeze 已完成并通过 `ship-sub`
- [x] Draft PR: `#324`
- [x] Merged to `master`: `d4ff12a`
- [x] Phase 1 audit and package-boundary baseline 已完成
- [x] Draft PR: `#325`
- [x] Merged to `master`: `15bdfc9`
- [x] Phase 2 standalone/project-context derived mounts 已完成
- [x] Draft PR: `#326`
- [x] Merged to `master`: `2f34108`
- [x] Phase 3 daemon app-context derived mounts 已完成
- [x] Draft PR: `#327`
- [x] Merged to `master`: `PR #327`
- [x] Phase 4 catalog snapshot / overlay cut 已完成
- [x] Draft PR: `#328`
- [x] Merged to `master`: `39529e7`
- [x] `CatalogManager` 改为持有 namespaced snapshot state，daemon 与 project-context 不再依赖 catalog 注入 domain managers
- [x] verification passed:
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm test`
- [x] Phase 5 manager contract cut 已完成
- [x] Draft PR: `#329`
- [x] Merged to `master`: `3ac92b7`
- [x] builder / API handler 合同已从 `BaseComponentManager` 收窄到 `ComponentResolver` / `MutableComponentCollection`
- [x] overlay 读取层已改为只读 `OverlayComponentView`，不再伪装成 manager
- [x] verification passed:
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm test`
- [x] Full Todo 主题 1 已完成一次 ship
- [x] Branch: `codex/03-24-322-host-runtime-governance`
- [x] Commit: `a5a2caf`
- [x] Full Todo 主题 2 已完成一次 ship
- [x] Branch: `codex/03-24-322-module-structure-governance`
- [x] Commit: `10cb9f7`
- [x] Full Todo 主题 3 已完成一次 ship
- [x] Branch: `codex/03-24-322-daemon-plugin-model`
- [x] Commit: `107f5e8`
- [x] Full Todo 主题 4 已完成一次 ship
- [x] Branch: `codex/03-24-322-provider-contribution-governance`
- [x] Commit: `e8adbff`
- [x] Full Todo 主题 5 已完成一次 ship
- [x] Branch: `codex/03-24-322-vfs-core-governance`
- [x] Commit: `e68fb7f`
- [x] 当前已完成一轮 VFS core boundary freeze：core terminology、显式 filesystem metadata、lifecycle contract 与 `agent-runtime` 根导出收口已落地
- [x] A4 keep / migrate / delete baseline 已形成：`docs/agent/2026-03-24-cursor-322-a4-domain-context-boundary.md`
- [x] Full Todo 主题 6 已完成一次 ship
- [x] Branch: `codex/03-24-322-agent-runtime-positioning`
- [x] Commit: `ce84a19`
- [x] `agent-runtime` 活跃定位已冻结为 daemon-hosted runtime module / daemon plugin boundary，不再保留中心层或组合根叙述
- [x] `packages/agent-runtime/src/domain/index.ts` 与 `packages/agent-runtime/src/template/index.ts` 两个死掉的兼容入口已删除
- [x] `TemplateRegistry` / `TemplateFileWatcher` 已在活跃代码和文档中收口为本地 authoring collection / watcher，不再被描述为系统真相源
- [x] `acp` / `pi` 的活跃定位已锁定为协议/transport 模块与 backend package；它们不能越级成为新的宿主层
- [x] `packages/api` 已改为直接依赖 `@actant/domain-context` / `@actant/catalog` / `@actant/vfs`；本地 template watcher 已迁到 `packages/api`
- [x] B3 provider SPI / runtimefs contract freeze 已完成：`runtimefs` provider contribution 现在强制为 `data-source`，且必须显式声明 `filesystemType=runtimefs` 与精确 `mountPoint`
- [x] B3 verification passed:
  - `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/vfs type-check`
  - `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/vfs/src/__tests__/b3-runtimefs-provider-contract.test.ts packages/vfs/src/__tests__/m5-control-stream-e2e.test.ts`
- [ ] Remaining Workstream A scope: `BaseComponentManager` 已降级为 `domain-context` 本地 mutable collection；`TemplateRegistry` / `TemplateFileWatcher` 与 `BackendManager` 的最终 keep / migrate / delete 仍需继续收口

## Phase 1 Audit Baseline

- [x] `catalog -> manager` 直接注入路径已盘点
- [x] `manager -> VFS` 反向投影路径已盘点
- [x] `register / unregister / inject` 真相源式调用点已盘点
- [x] `keep / converge / delete` 包边界决策基线已形成
- [x] Detailed audit note: `docs/agent/2026-03-23-cursor-322-phase1-audit.md`

## Phase 2 Implementation Cut

- [x] standalone/project-context 的 `/skills` `/prompts` `/mcp` `/workflows` `/templates` 不再直接以 manager 作为挂载真相源
- [x] snapshot-backed domain source 已加入 `@actant/vfs`
- [x] focused verification passed:
  - `pnpm --filter @actant/vfs type-check`
  - `pnpm --filter @actant/api type-check`
  - `pnpm --filter @actant/mcp-server type-check`
  - `pnpm exec vitest run packages/vfs/src/__tests__/domain-source.test.ts packages/mcp-server/src/context-backend.test.ts`

## Phase 3 Daemon Projection Cut

- [x] daemon app-context 的 `/skills` `/prompts` `/mcp` `/workflows` `/templates` 已切到 snapshot-backed VFS source
- [x] template / domain / catalog 变更会触发 `refreshContextMounts()`，保持 daemon derived mounts 与最新快照一致
- [x] merge-worktree verification passed:
  - `pnpm lint`
  - `pnpm type-check`
  - `pnpm test`

## Phase 4 Catalog Snapshot / Overlay Cut

- [x] `CatalogManager` 不再把 catalog 组件写入 `SkillManager` / `PromptManager` / `McpConfigManager` / `WorkflowManager` / `TemplateRegistry`
- [x] daemon `AppContext` 通过 overlay resolver + aggregate reads 支持 catalog-backed `skill/prompt/mcp/workflow/template` 读取与 `agent create`
- [x] standalone `project-context` 通过 local manager + catalog resolved snapshot 聚合读取 catalog 组件
- [x] 新增回归测试：
  - `packages/api/src/services/__tests__/catalog-overlay-integration.test.ts`
  - `packages/api/src/services/__tests__/project-context-catalog-projection.test.ts`

## Phase 5 Manager Contract Cut

- [x] `BaseComponentManager` 不再作为 builder / API / overlay 的跨包合同类型
- [x] 读取侧 overlay 已收敛到 `ComponentCollection` 只读视图

## Current TODO List

- [x] A1. 盘点剩余 `manager-first` / `manager -> VFS` / live public export 路径
- [x] A2. 删除 live `domain-source` 在 `@actant/vfs` / `@actant/agent-runtime` 的 public re-export
- [x] A3. 删除 `BaseComponentManager` 在 `@actant/agent-runtime` 的 public re-export
- [x] A4. 收敛 `domain-context` 内 concrete manager 基类，明确 keep / migrate / delete 清单
- [x] A5. 为 Workstream A 增加 public export / terminology / regression gate
- [x] B1. 固化 `daemon -> daemon plugin -> provider contribution -> VFS` 与 `bridge -> RPC -> daemon`
- [x] B2. 收口 `agent-runtime` / `domain-context` / `acp` / `pi` 的层级与依赖方向
- [x] B3. 冻结 provider SPI 与 runtimefs / VFS core 边界
- [x] C1. 同步活文档到最终层级口径
- [x] C2. 为活文档与 help surface 增加 grep / contract gate
- [ ] Z1. 与 `#323` 联动清理历史残留并完成最终验收

## A1 Inventory

- [x] `BaseComponentManager` 剩余 public 暴露原位于 `packages/agent-runtime/src/domain/index.ts`
- [x] live `createDomainSource` 剩余 public 暴露原位于 `packages/vfs/src/index.ts` 与 `packages/agent-runtime/src/vfs/index.ts`
- [x] live `createDomainSource(...)` 生产调用已清空，当前只剩 `packages/vfs/src/sources/domain-source.ts` 与其测试
- [x] A2 / A3 已完成：live manager / live domain source public re-export 已从 active public boundary 移除
- [x] focused verification passed:
  - `pnpm --filter @actant/vfs type-check`
  - `pnpm --filter @actant/agent-runtime type-check`
  - `pnpm exec vitest run packages/vfs/src/__tests__/domain-source.test.ts packages/agent-runtime/src/builder/workspace-builder.test.ts`

## A4 Inventory

- [x] `SkillManager` / `PromptManager` / `McpConfigManager` / `WorkflowManager` / `TemplateRegistry` 仍在 `packages/api/src/services/app-context.ts` 与 `packages/api/src/services/project-context.ts` 作为本地 mutable collection 使用
- [x] `BackendManager` 仍在 `packages/agent-runtime/src/manager/launcher/backend-registry.ts` 作为单例 backend store 使用
- [x] `PluginManager` 当前仍在 `AppContext` 本地使用，并在 `workspace-builder` 测试中作为 resolver 夹具出现
- [x] `TemplateFileWatcher` 仍直接依赖 `TemplateRegistry.register/unregister`
- [x] keep / migrate / delete 清单已形成：`docs/agent/2026-03-24-cursor-322-a4-domain-context-boundary.md`
- [ ] 下一步要继续从 `TemplateRegistry` / `TemplateFileWatcher` 与 `BackendManager` 单例切口下刀

## Sync Rule

- [ ] 本文件是 `#322` 的实时执行视图
- [ ] `docs/planning/contextfs-roadmap.md` 中的 `#322` 节是权威清单真相源
- [ ] 后续围绕 `#322` 的任务推进、拆分、状态变更都必须持续回写 roadmap，并保持本文件同步

## Full Todo

### 1. 宿主与运行时口径治理

- [x] 固化 `daemon` 是唯一运行时宿主
- [x] 固化 `daemon` 是唯一组合根
- [x] 固化 `bridge` 只负责通过 RPC 与 `daemon` 交互
- [x] 固化 `actant` 只是打包层 / 分发层 / 产品壳
- [x] 删除 `actant app` 作为组合根的旧叙述
- [x] 删除 bridge 层“自带装配能力”的旧叙述
- [x] 清理活文档中所有与上述口径冲突的表述

### 2. 模块结构治理

- [x] 固化简化模块结构图
- [x] 固化 VFS 内部结构图
- [x] 明确 `daemon -> daemon plugin -> provider contribution -> VFS` 的装载方向
- [x] 明确 `bridge -> RPC -> daemon` 的调用方向
- [x] 明确哪些模块属于 daemon 内部模块
- [x] 明确哪些模块属于 bridge 层
- [x] 明确哪些模块属于打包层

### 3. 插件模型治理

- [x] 定义 `daemon plugin` 是系统唯一有效扩展单元
- [x] 定义 `daemon plugin` 的最小契约
- [x] 定义 plugin 生命周期：`activate / deactivate / dispose`
- [x] 定义 plugin 可贡献能力集合：`provider / rpc / hooks / services`
- [x] 定义 plugin 元信息模型
- [x] 定义 plugin 装载位置只能在 `daemon`
- [x] 禁止 bridge 层直接装载 plugin
- [x] 禁止 `provider` 继续被当作系统顶层插件模型

### 4. Provider contribution 治理

- [x] 定义 `provider contribution` 的最小 SPI
- [x] 明确 `provider` 只是 `daemon plugin` 的子能力
- [x] 明确 `provider` 只负责向 VFS 注入 mount/backend/数据来源
- [x] 禁止 `provider` 直接注册领域内容
- [x] 禁止 `provider` 成为中心注册结构
- [x] 禁止 `provider` 替代 `daemon plugin`
- [x] 明确现有来源能力如何迁移为 provider contribution

### 5. VFS 核心治理

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

### 6. `agent-runtime` 定位治理

- [x] 固化 `agent-runtime` 是 daemon plugin
- [x] 明确 `agent-runtime` 不是中心层
- [x] 明确 `agent-runtime` 不是组合根
- [x] 明确 `domain-context` / `acp` / `pi` 是 `agent-runtime` 依赖
- [x] 评估是否拆出 `agent-runtime plugin adapter`
- [x] 明确 `agent-runtime` 可向 VFS 注入哪些 provider contribution
- [x] 明确 `agent-runtime` 只通过 VFS 读写系统状态

### 7. `domain-context` 治理

- [ ] 列出 `domain-context` keep / migrate / delete 全清单
- [ ] 保留 parser / schema / validator / renderer / resolver
- [ ] 删除 manager-first / registry-first 结构
- [x] 删除或迁出 watcher 中非 VFS 驱动部分
- [ ] 禁止 `domain-context` 反向生成 VFS
- [ ] 禁止 `domain-context` 成为系统状态中心
- [ ] 明确哪些能力继续作为 `agent-runtime` 依赖保留

### 8. `acp` / `pi` 治理

- [x] 明确 `acp` 是 `agent-runtime` 依赖还是 daemon plugin contribution
- [x] 明确 `pi` 是 `agent-runtime` 依赖还是独立 plugin
- [x] 清理 `acp` / `pi` 在文档中的层级漂移描述
- [x] 明确它们与 VFS 的依赖关系不能绕过 `agent-runtime` / `daemon`

### 9. 去中心注册结构治理

- [ ] 删除 `CatalogManager` 的中心注册职责
- [ ] 删除 `BaseComponentManager` 中心抽象
- [ ] 删除 `domain-source` 这类 `manager -> VFS` 投影结构
- [ ] 清点所有 `register/unregister` 真相源式调用点
- [ ] 删除所有“内容先进入注册表，再投影回 VFS”的路径
- [ ] 将剩余 manager 降级为索引 / 缓存 / 派生视图
- [ ] 禁止新增任何中心注册结构

### 10. 包层级治理

- [ ] 定义最终保留包清单
- [ ] 定义最终合并包清单
- [ ] 定义最终删除包清单
- [ ] 明确 `@actant/context -> @actant/api` 合并口径
- [ ] 明确 `@actant/catalog` 是拆散为 plugin contribution 还是彻底删除
- [ ] 明确 bridge 包的最终保留清单
- [ ] 明确 daemon-hosted modules 的最终保留清单
- [ ] 明确打包层 `actant` 的最小职责边界

### 11. 历史残留治理

- [ ] 延续 `#323`，删除 `packages/domain`
- [ ] 延续 `#323`，删除 `packages/core`
- [ ] 清理 `dist/` / `tsbuildinfo` 等残留
- [ ] 修正活文档中的 `core/domain` 旧架构描述
- [ ] 审视 `actant` 对外导出的 `./core` 别名是否保留
- [ ] 对历史文档 / issue / 报告统一标记 `legacy` / `archive`

### 12. 文档与术语治理

- [x] 更新 `.trellis/spec/index.md`
- [x] 更新 `.trellis/spec/terminology.md`
- [x] 更新 `.trellis/spec/backend/index.md`
- [x] 更新 `docs/design/actant-vfs-reference-architecture.md`
- [x] 统一 `daemon / bridge / daemon plugin / provider contribution` 术语
- [x] 统一 `domain-context` 的最终定义
- [x] 统一 `manager/index/cache/view` 的边界定义
- [x] 增补“禁止中心注册结构”的明确设计约束

### 13. Bridge 层治理

- [ ] 审查 `cli` 是否纯 RPC bridge
- [ ] 审查 `rest-api` 是否纯 RPC bridge
- [ ] 审查 `tui` 是否纯 RPC bridge
- [ ] 审查 `dashboard` 是否只是 bridge 的 UI 外壳
- [ ] 审查 `mcp-server` 是否只是 bridge
- [ ] 审查 `channel-*` 是否只是 bridge / adapter
- [ ] 清理 bridge 层任何自行装载系统的能力

### 14. 验收治理

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
