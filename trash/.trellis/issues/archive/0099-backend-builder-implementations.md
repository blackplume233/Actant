---
id: 99
title: BackendBuilder 接口 + CursorBuilder + ClaudeCodeBuilder 实现
status: closed
labels:
  - feature
  - architecture
  - "priority:P0"
  - phase3b
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 44
  - 96
relatedFiles:
  - packages/core/src/builder/backend-builder.ts
  - packages/core/src/builder/cursor-builder.ts
  - packages/core/src/builder/claude-code-builder.ts
  - packages/core/src/initializer/context/context-materializer.ts
taskRef: null
githubRef: "blackplume233/Actant#99"
closedAs: completed
createdAt: "2026-02-21T21:00:00"
updatedAt: "2026-02-22T07:59:11"
closedAt: "2026-02-22T07:59:11"
---

**Related Issues**: [[0044-session-lease-mock-untestable]], [[0096-e2e-cli-esm-module-resolution]]
**Related Files**: `packages/core/src/builder/backend-builder.ts`, `packages/core/src/builder/cursor-builder.ts`, `packages/core/src/builder/claude-code-builder.ts`, `packages/core/src/initializer/context/context-materializer.ts`

---

## 目标

定义 BackendBuilder Strategy 接口，实现 Cursor 和 Claude Code 两种后端的差异化 workspace 构建。

## 依赖

- #44 PluginManager（用于 plugin 物化）

## 交付物

### 1. BackendBuilder 接口 + 类型

```typescript
interface BackendBuilder {
  readonly backendType: AgentBackendType;
  scaffold(workspaceDir, meta): Promise<void>;
  materializeSkills(workspaceDir, skills): Promise<void>;
  materializePrompts(workspaceDir, prompts): Promise<void>;
  materializeMcpConfig(workspaceDir, servers): Promise<void>;
  materializePlugins(workspaceDir, plugins): Promise<void>;
  injectPermissions(workspaceDir, permissions): Promise<void>;
  materializeWorkflow(workspaceDir, workflow): Promise<void>;
  verify(workspaceDir): Promise<VerifyResult>;
}
```

`BuildResult`, `VerifyResult`, `PermissionSet` 类型定义。

### 2. CursorBuilder

- `.cursor/rules/*.mdc` — 每个 skill 一个规则文件
- `.cursor/mcp.json` — MCP 配置
- `.cursor/extensions.json` — 推荐扩展
- `AGENTS.md` — skill 概述
- `prompts/system.md` — system prompt

### 3. ClaudeCodeBuilder

- `.claude/mcp.json` — MCP 配置
- `.claude/settings.local.json` — 权限
- `.claude/plugins.json` — Cloud Code plugins
- `CLAUDE.md` — 主指令文件
- `AGENTS.md` — Agent Skills 声明

## 文件路径

```
packages/core/src/builder/
  ├── backend-builder.ts
  ├── cursor-builder.ts
  ├── claude-code-builder.ts
  └── index.ts
```

## 验收标准

- [ ] BackendBuilder 接口定义清晰
- [ ] CursorBuilder 所有方法实现
- [ ] ClaudeCodeBuilder 所有方法实现
- [ ] 单元测试覆盖两个 Builder

---

## Comments

### cursor-agent — 2026-02-22T07:59:11

Closed as completed
