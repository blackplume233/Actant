---
name: "Phase 3a: #38 统一组件管理体系"
overview: "增强 BaseComponentManager CRUD + 新建 PluginManager + 扩展 RPC/CLI"
todos:
  - id: a1-base-enhance
    content: "P0: 增强 BaseComponentManager — add/update/remove + persistDir 持久化"
    status: pending
  - id: a2-plugin-schema
    content: "P0: PluginDefinition schema + PluginManager + configs/plugins/ 示例"
    status: pending
  - id: a3-rpc-cli
    content: "P0: 扩展 RPC handlers + CLI 命令 (skill/prompt/plugin CRUD)"
    status: pending
  - id: a4-template-tests
    content: "P1: 模板 plugins 字段 + 集成测试"
    status: pending
isProject: false
---

# Phase 3a: #38 统一组件管理体系

## 目标

将 Skill / Prompt / Plugin 纳入统一组件管理框架，支持完整 CRUD + 持久化 + 导入导出。

## 当前状态

- BaseComponentManager 仅有 register/unregister/get/list/loadFromDirectory
- Skill/Prompt/MCP/Workflow Manager 只读
- 无 PluginManager
- CLI 仅 list/show

## Todo 1: 增强 BaseComponentManager

**范围**: `packages/core/src/domain/base-component-manager.ts`

新增方法：
- `add(component, persist?)` — register + 可选写磁盘
- `update(name, patch)` — 部分更新 + 可选持久化
- `remove(name, persist?)` — unregister + 可选删文件
- `importFromFile(filePath)` — 从文件加载并注册
- `exportToFile(name, filePath)` — 导出为 JSON
- `search(query)` — 模糊搜索（name + description）
- `filter(predicate)` — 条件过滤
- `persistDir` 属性 — 持久化目标目录

**影响**: 所有子类（SkillManager/PromptManager/McpConfigManager/WorkflowManager）自动继承新能力。

## Todo 2: PluginManager + Schema

**新文件**:
- `packages/shared/src/types/domain-component.types.ts` — 追加 PluginDefinition
- `packages/core/src/domain/plugin/plugin-manager.ts` — PluginManager
- `packages/core/src/domain/plugin/index.ts`
- `configs/plugins/memory-plugin.json`
- `configs/plugins/web-search-plugin.json`
- `configs/plugins/github-plugin.json`

**AppContext 注入**: `app-context.ts` 新增 pluginManager，启动时加载 configs/plugins/。

## Todo 3: RPC + CLI 扩展

**RPC handlers** (`packages/api/src/handlers/domain-handlers.ts`):
```
domain.skill.add / update / remove / import
domain.prompt.add / update / remove
domain.plugin.list / show / add / remove / install
```

**CLI 命令**:
- `packages/cli/src/commands/skill.ts` — 追加 add/remove/export 子命令
- `packages/cli/src/commands/prompt.ts` — 追加 add/remove/export 子命令
- `packages/cli/src/commands/plugin.ts` — 新文件，全套命令

## Todo 4: 模板扩展 + 测试

- `template-schema.ts` 中 domainContext 增加 `plugins: string[]`
- `packages/shared/src/types/rpc.types.ts` 新增参数/返回类型
- 集成测试：CRUD + 持久化 + 导入导出

## 验收标准

- [ ] Skill/Prompt 支持 add/update/remove + 持久化
- [ ] PluginManager 完整 CRUD
- [ ] CLI 新增 skill/prompt/plugin 管理命令
- [ ] configs/plugins/ 至少 3 个示例
- [ ] 导入/导出功能可用
- [ ] 模板 domainContext 支持 plugins 字段
- [ ] lint + typecheck 通过
- [ ] test:changed 通过
