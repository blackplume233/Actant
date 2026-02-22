---
id: 45
title: 组件管理 RPC Handlers + CLI 命令扩展
status: closed
labels:
  - feature
  - cli
  - api
  - "priority:P0"
  - phase3a
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 38
  - 43
  - 44
relatedFiles:
  - packages/api/src/handlers/domain-handlers.ts
  - packages/shared/src/types/rpc.types.ts
  - packages/cli/src/commands/skill.ts
  - packages/cli/src/commands/prompt.ts
  - packages/cli/src/commands/plugin.ts
taskRef: null
githubRef: null
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T07:59:11"
closedAt: "2026-02-22T07:59:11"
---

**Related Issues**: [[0038-rename-agentcraft-to-actant]], [[0043-base-component-manager-crud]], [[0044-e2e-cli-esm-module-resolution]]
**Related Files**: `packages/api/src/handlers/domain-handlers.ts`, `packages/shared/src/types/rpc.types.ts`, `packages/cli/src/commands/skill.ts`, `packages/cli/src/commands/prompt.ts`, `packages/cli/src/commands/plugin.ts`

---

## 目标

为 Skill/Prompt/Plugin 新增完整 CRUD 的 RPC handlers 和 CLI 命令。

## 依赖

- #43 BaseComponentManager CRUD
- #44 PluginManager

## RPC Handlers

```
domain.skill.add / domain.skill.update / domain.skill.remove / domain.skill.import
domain.prompt.add / domain.prompt.update / domain.prompt.remove
domain.plugin.list / domain.plugin.show / domain.plugin.add / domain.plugin.remove / domain.plugin.install
```

修改文件: `packages/api/src/handlers/domain-handlers.ts`
新增 RPC 类型: `packages/shared/src/types/rpc.types.ts`

## CLI 命令

**skill** (修改 `packages/cli/src/commands/skill.ts`):
- `skill add <file>` / `skill remove <name>` / `skill export <name>`

**prompt** (修改 `packages/cli/src/commands/prompt.ts`):
- `prompt add <file>` / `prompt remove <name>` / `prompt export <name>`

**plugin** (新建 `packages/cli/src/commands/plugin.ts`):
- `plugin list` / `plugin show` / `plugin add` / `plugin remove` / `plugin install <name> <agent>`

## 验收标准

- [ ] 全部 RPC handlers 注册 + 实现
- [ ] CLI skill/prompt CRUD 命令可用
- [ ] CLI plugin 全套命令可用
- [ ] RPC 类型定义完整
- [ ] 集成测试覆盖

---

## Comments

### cursor-agent — 2026-02-22T07:59:11

Closed as completed
