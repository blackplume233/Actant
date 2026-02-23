---
id: 43
title: 统一组件管理体系 — Skill / Prompt / Plugin 完整 CRUD
status: closed
labels:
  - feature
  - domain
  - "priority:P1"
milestone: mid-term
author: human
assignees: []
relatedIssues:
  - 29
  - 30
  - 44
  - 14
relatedFiles:
  - packages/core/src/domain/base-component-manager.ts
  - packages/core/src/domain/skill/skill-manager.ts
  - packages/core/src/domain/prompt/prompt-manager.ts
  - packages/core/src/domain/mcp/mcp-config-manager.ts
  - packages/core/src/domain/index.ts
  - packages/core/src/template/schema/template-schema.ts
  - packages/cli/src/commands/skill.ts
  - packages/cli/src/commands/prompt.ts
  - packages/api/src/handlers/domain-handlers.ts
taskRef: null
githubRef: "blackplume233/Actant#43"
closedAs: completed
createdAt: "2026-02-21T12:00:00"
updatedAt: "2026-02-22T12:00:00"
closedAt: "2026-02-22T12:00:00"
---

**Related Issues**: [[0029-issue-assignee]], [[0030-core-type-check]], [[0044-session-lease-mock-untestable]], [[0014-plugin-heartbeat-scheduler-memory]]
**Related Files**: `packages/core/src/domain/base-component-manager.ts`, `packages/core/src/domain/skill/skill-manager.ts`, `packages/core/src/domain/prompt/prompt-manager.ts`, `packages/core/src/domain/mcp/mcp-config-manager.ts`, `packages/core/src/domain/index.ts`, `packages/core/src/template/schema/template-schema.ts`, `packages/cli/src/commands/skill.ts`, `packages/cli/src/commands/prompt.ts`, `packages/api/src/handlers/domain-handlers.ts`

---

## 目标

将 Skill、Prompt、Plugin（Cloud Code 插件）纳入统一的组件管理框架，支持完整 CRUD + import/export + 搜索过滤。

**当前状态**：Domain Managers（Skill/Prompt/MCP/Workflow）只有 list/show 只读能力，缺乏 add/remove/update/import/export。Plugin 管理完全不存在。

## Plugin 概念

Plugin 指 **Agent 侧的能力扩展**：
- Claude Code Plugin（memory plugin、web-search plugin 等）
- Cursor Extension
- Custom tool packages

不同于 Actant 自身的系统级插件（#13 Phase 4）。

## 设计要点

### 1. 增强 BaseComponentManager

```typescript
// 新增方法
async add(component: T, persist?: boolean): Promise<void>;
async update(name: string, patch: Partial<T>): Promise<T>;
async remove(name: string, persist?: boolean): Promise<boolean>;
async importFromFile(filePath: string): Promise<T>;
async importFromUrl(url: string): Promise<T>;
async exportToFile(name: string, filePath: string): Promise<void>;
search(query: string): T[];
filter(predicate: (c: T) => boolean): T[];
```

### 2. PluginManager + PluginDefinition

```typescript
const PluginDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["claude-code", "cursor", "universal"]),
  install: z.discriminatedUnion("method", [
    z.object({ method: z.literal("npm"), package: z.string(), version: z.string().optional() }),
    z.object({ method: z.literal("file"), path: z.string() }),
    z.object({ method: z.literal("config"), target: z.string(), content: z.record(z.string(), z.unknown()) }),
  ]),
  permissions: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  compatibleBackends: z.array(z.enum(["claude-code", "cursor", "custom"])).optional(),
  tags: z.array(z.string()).optional(),
});
```

### 3. CLI 命令扩展

```bash
# Skill CRUD
actant skill add <file|url>
actant skill create
actant skill remove <name>
actant skill export <name> [--out]

# Prompt CRUD
actant prompt add <file|url>
actant prompt create
actant prompt remove <name>
actant prompt export <name> [--out]

# Plugin 全套
actant plugin list
actant plugin show <name>
actant plugin add <file|url>
actant plugin create
actant plugin remove <name>
actant plugin install <name> <agent>
```

### 4. RPC 方法

```
domain.skill.add / domain.skill.update / domain.skill.remove / domain.skill.import
domain.prompt.add / domain.prompt.update / domain.prompt.remove
domain.plugin.list / domain.plugin.show / domain.plugin.add / domain.plugin.remove / domain.plugin.install
```

### 5. DomainContext 扩展

`domainContext.plugins: string[]` — 模板中引用 Plugin 名称列表。

## 实现计划

1. 增强 `BaseComponentManager`：add/update/remove/import/export/search
2. 创建 `PluginManager` + `PluginDefinition` schema（`packages/core/src/domain/plugin/`）
3. 扩展 CLI 命令：skill/prompt CRUD + plugin 全套
4. 扩展 RPC handlers
5. `configs/plugins/` 目录 + 至少 3 个示例插件定义
6. 集成测试

## 验收标准

- [ ] Skill/Prompt 支持 add/update/remove + 持久化
- [ ] PluginManager 完整实现，支持 CRUD
- [ ] CLI 新增 skill/prompt/plugin 管理命令
- [ ] configs/plugins/ 至少 3 个示例插件定义
- [ ] 导入/导出功能可用
- [ ] 模板 domainContext 支持 plugins 字段
- [ ] RPC 方法全部实现并测试

---

## Comments

### cursor-agent — 2026-02-22T12:00:00

Closed as completed — Phase 3a epic complete: BaseComponentManager CRUD (#43), PluginManager (#44), RPC+CLI (#45) all implemented and tested
