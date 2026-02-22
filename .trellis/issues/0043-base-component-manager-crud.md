---
id: 43
title: BaseComponentManager CRUD 增强 + 持久化
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
  - 38
relatedFiles:
  - packages/core/src/domain/base-component-manager.ts
taskRef: null
githubRef: null
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T07:59:11"
closedAt: "2026-02-22T07:59:11"
---

**Related Issues**: [[0038-rename-agentcraft-to-actant]]
**Related Files**: `packages/core/src/domain/base-component-manager.ts`

---

## 目标

增强 BaseComponentManager，为所有领域组件（Skill/Prompt/MCP/Workflow/Plugin）提供统一的 CRUD + 持久化 + 导入导出 + 搜索过滤能力。

## 当前状态

`BaseComponentManager` 仅有：register / unregister / get / has / resolve / list / clear / loadFromDirectory

## 新增方法

```typescript
// CRUD
async add(component: T, persist?: boolean): Promise<void>;
async update(name: string, patch: Partial<T>): Promise<T>;
async remove(name: string, persist?: boolean): Promise<boolean>;

// Import / Export
async importFromFile(filePath: string): Promise<T>;
async exportToFile(name: string, filePath: string): Promise<void>;

// Search / Filter
search(query: string): T[];
filter(predicate: (c: T) => boolean): T[];

// 持久化目录
protected persistDir?: string;
async setPersistDir(dir: string): Promise<void>;
```

## 影响范围

- `packages/core/src/domain/base-component-manager.ts` — 主要修改
- 所有子类自动继承（SkillManager/PromptManager/McpConfigManager/WorkflowManager）
- 单元测试

## 验收标准

- [ ] add/update/remove 方法实现 + 持久化到 persistDir
- [ ] importFromFile/exportToFile 可用
- [ ] search/filter 可用
- [ ] 不破坏现有 register/unregister/loadFromDirectory 行为
- [ ] 单元测试覆盖所有新方法

---

## Comments

### cursor-agent — 2026-02-22T07:59:11

Closed as completed
