# #322 Phase 1 Audit

## Scope

本阶段只做两件事：

1. 盘点当前 `catalog -> manager`、`manager -> VFS`、`register / unregister / inject` 真相源式路径。
2. 给出后续实现阶段的包边界决策基线。

本文件是 Phase 1 的详细审计记录；活跃进度真相仍以 `docs/planning/contextfs-roadmap.md` 为准。

## A. 违规路径盘点

### A1. `catalog -> manager` 直接注入路径

这些路径说明 `catalog` 仍然把领域内容直接写入中心 manager，而不是把能力经由 plugin/provider/VFS 收敛。

| Path | Current behavior | Why it violates `#322` |
| --- | --- | --- |
| `packages/catalog/src/catalog-manager.ts` `injectComponents()` | 将 catalog fetch 结果逐项 `register()` 到 `skillManager` / `promptManager` / `mcpConfigManager` / `workflowManager` / `templateRegistry` | `CatalogManager` 仍承担中心注册职责 |
| `packages/catalog/src/catalog-manager.ts` `restoreCatalogState()` | sync 失败回滚时，把快照重新 `register()` 回 manager | 继续把 manager 当成系统状态真相 |
| `packages/catalog/src/catalog-manager.ts` `removeNamespacedComponents()` | 按前缀遍历 registry，再逐项 `unregister()` | catalog 生命周期仍直接操纵领域注册中心 |
| `packages/api/src/services/project-context.ts` `injectCatalogComponents()` | standalone namespace 装载时，直接把 fetched catalog 内容写入本地 managers | project-context 仍复制一套 catalog 注入模型 |
| `packages/api/src/services/app-context.ts` constructor | `CatalogManager` 直接依赖各类 manager 实例 | app/daemon 组合根仍以 manager registry 为 catalog 注入目标 |

### A2. `manager -> VFS` 反向投影路径

这些路径说明系统先把内容装进 manager，再反向投影成 VFS 节点；这与 `VFS` 为唯一真相源的目标冲突。

| Path | Current behavior | Why it violates `#322` |
| --- | --- | --- |
| `packages/api/src/services/project-context.ts` `createProjectContextRegistrations()` | 对 `skillManager` / `promptManager` / `mcpConfigManager` / `workflowManager` / `templateRegistry` 调用 `createDomainSource()` | manager 状态被当成 VFS 子树的数据源 |
| `packages/api/src/services/app-context.ts` `mountCoreResourceSources()` | 通过 `createSkillSource()` / `createDomainSource()` / `createMcpConfigSource()` / `createAgentRuntimeSource()` 挂出 `/skills` `/prompts` `/mcp` `/workflows` `/templates` `/agents` | daemon VFS 默认资源面仍由 manager registry 派生 |
| `packages/api/src/services/app-context.ts` `refreshContextMounts()` | 领域内容变化后重新 mount context resources | 继续把 VFS 当成 manager state 的投影面 |

### A3. `register / unregister / inject` 真相源式调用点

以下路径是后续 Workstream A 必须优先处理的高价值切口。

| Path | Hotspot | Observation |
| --- | --- | --- |
| `packages/domain-context/src/domain/base-component-manager.ts` | `register()` / `unregister()` / `add()` / `update()` / `remove()` / `importFromFile()` / `loadFromDirectory()` | `BaseComponentManager` 仍是中心注册抽象 |
| `packages/catalog/src/catalog-manager.ts` | `injectComponents()` / `restoreCatalogState()` / `removeNamespacedComponents()` | catalog 负责 registry 注入、回滚与删除 |
| `packages/api/src/services/project-context.ts` | `injectCatalogComponents()` | standalone/project-context path 复制一套 registry 写入逻辑 |
| `packages/api/src/services/app-context.ts` | `mountCoreResourceSources()` | daemon 启动路径把 manager registry 扩散成默认 VFS 资源树 |

## B. 包边界决策基线

本节不是最终重构结果，而是后续 Workstream 的决策基线。

### B1. Keep

- `@actant/vfs`
  - 保留为唯一核心与唯一真相源。
- `packages/api` 中的 daemon composition root
  - 保留为 daemon 宿主与组合根。
- bridge 层包：`packages/cli`、`packages/rest-api`、`packages/mcp-server`、`packages/tui`、`packages/dashboard`
  - 保留，但后续必须继续收敛为纯 RPC/adapter。

### B2. Converge / shrink

- `@actant/domain-context`
  - 保留 `parser / schema / validator / renderer / resolver`
  - 收缩并移除 `manager-first / registry-first` 角色
- `@actant/catalog`
  - 保留 fetch/validation/provider-facing 装载能力
  - 移除“中心注册 + 直接写 manager”职责
- `@actant/context`
  - 继续向 `@actant/api` 收口
  - 只保留 projection / permission compilation 等仍有必要的薄层能力

### B3. Delete / retire

- `BaseComponentManager` 作为“中心注册抽象”的角色
- `CatalogManager` 作为“中心注册协调器”的角色
- `createDomainSource()` 这一类“manager state -> VFS”投影路径
- `packages/core` 与 `packages/domain`
  - 继续并入 `#323` 的历史残留删除范围

## C. 后续实现拆分输入

### Workstream A: 去中心注册结构

- 先从 `BaseComponentManager` 和 `CatalogManager` 的注入/回滚/删除路径入手
- 目标是把 registry 降级为索引/缓存，而不是系统真相

### Workstream B: `daemon / plugin / provider / VFS` 契约收口

- 先处理 `app-context` 和 `project-context` 里的 manager 投影路径
- 目标是把资源暴露面直接建模到 VFS/plugin/provider，而不是从 manager 派生

### Workstream C: 文档与门禁

- 把本审计结论同步进 roadmap、spec 和 gate
- 后续 gate 应明确禁止新增 `catalog -> manager -> VFS` 回流路径
