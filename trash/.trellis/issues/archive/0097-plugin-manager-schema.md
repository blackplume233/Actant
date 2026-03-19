---
id: 97
title: PluginManager + PluginDefinition Schema + 示例配置
status: closed
labels:
  - feature
  - domain
  - "priority:P0"
  - phase3a
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 42
  - 94
relatedFiles:
  - packages/shared/src/types/domain-component.types.ts
  - packages/core/src/domain/plugin/plugin-manager.ts
  - packages/core/src/template/schema/template-schema.ts
  - packages/api/src/app-context.ts
taskRef: null
githubRef: "blackplume233/Actant#97"
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T12:00:00"
closedAt: "2026-02-22T12:00:00"
---

**Related Issues**: [[0042-rename-agentcraft-to-actant]], [[0094-base-component-manager-crud]]
**Related Files**: `packages/shared/src/types/domain-component.types.ts`, `packages/core/src/domain/plugin/plugin-manager.ts`, `packages/core/src/template/schema/template-schema.ts`, `packages/api/src/app-context.ts`

---

## 目标

创建 PluginManager（extends BaseComponentManager），定义 PluginDefinition Zod schema，提供示例 Plugin 配置。

## Plugin 概念

Plugin 指 Agent 侧能力扩展（Cloud Code Plugin / Cursor Extension / Custom tool），不同于 Actant 系统级插件（#13）。

## 交付物

1. **PluginDefinition schema** — `packages/shared/src/types/domain-component.types.ts` 追加
2. **PluginManager** — `packages/core/src/domain/plugin/plugin-manager.ts`
3. **示例配置** — `configs/plugins/` 目录：
   - `memory-plugin.json` — Claude Code memory plugin
   - `web-search-plugin.json` — Web search plugin
   - `github-plugin.json` — GitHub integration
4. **AppContext 注入** — pluginManager 创建 + configs/plugins/ 自动加载
5. **模板扩展** — domainContext 新增 `plugins: string[]` 字段

## 验收标准

- [ ] PluginDefinition Zod schema 定义完整（name/type/install/permissions/env/tags）
- [ ] PluginManager extends BaseComponentManager，validate 方法实现
- [ ] configs/plugins/ 至少 3 个示例
- [ ] AppContext 启动时加载 plugins
- [ ] template schema 支持 plugins 字段

---

## Comments

### cursor-agent — 2026-02-22T12:00:00

Closed as completed — Phase 3a implementation complete, all tests passing
