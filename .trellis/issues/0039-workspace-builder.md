---
id: 39
title: Workspace 构造器 — 面向不同 Agent 后端的差异化构建
status: closed
labels:
  - feature
  - architecture
  - "priority:P1"
milestone: mid-term
author: human
assignees: []
relatedIssues:
  - 23
  - 38
  - 26
relatedFiles:
  - packages/core/src/initializer/context/context-materializer.ts
  - packages/core/src/initializer/agent-initializer.ts
  - packages/core/src/template/schema/template-schema.ts
  - packages/core/src/domain/skill/skill-manager.ts
  - packages/core/src/domain/prompt/prompt-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#45"
closedAs: completed
createdAt: "2026-02-21T12:00:00"
updatedAt: "2026-02-22T12:00:00"
closedAt: "2026-02-22T12:00:00"
---

**Related Issues**: [[0023-issue-assignee]], [[0038-rename-agentcraft-to-actant]], [[0026-]]
**Related Files**: `packages/core/src/initializer/context/context-materializer.ts`, `packages/core/src/initializer/agent-initializer.ts`, `packages/core/src/template/schema/template-schema.ts`, `packages/core/src/domain/skill/skill-manager.ts`, `packages/core/src/domain/prompt/prompt-manager.ts`

---

## 目标

用 Strategy Pattern 重构 workspace 构建流程，使不同 Agent 后端（Cursor / Claude Code / Custom）能产出各自最优的 workspace 文件结构。

**当前问题**：
- `ContextMaterializer` 路径硬编码（AGENTS.md、prompts/system.md 等），不区分后端差异
- 无目录骨架（scaffold），只写 domain context 文件
- 无 Plugin 物化能力
- 无构建后验证

## 设计方案：Strategy-based WorkspaceBuilder

### BackendBuilder 接口

```typescript
interface BackendBuilder {
  readonly backendType: AgentBackendType;
  scaffold(workspaceDir: string, meta: AgentInstanceMeta): Promise<void>;
  materializeSkills(workspaceDir: string, skills: SkillDefinition[]): Promise<void>;
  materializePrompts(workspaceDir: string, prompts: PromptDefinition[]): Promise<void>;
  materializeMcpConfig(workspaceDir: string, servers: McpServerRef[]): Promise<void>;
  materializePlugins(workspaceDir: string, plugins: PluginDefinition[]): Promise<void>;
  injectPermissions(workspaceDir: string, permissions: PermissionSet): Promise<void>;
  materializeWorkflow(workspaceDir: string, workflow: WorkflowDefinition): Promise<void>;
  verify(workspaceDir: string): Promise<VerifyResult>;
}
```

### 各后端差异

**CursorBuilder**:
- `.cursor/rules/*.mdc` — 每个 skill 一个规则文件
- `.cursor/mcp.json` — MCP 配置
- `.cursor/extensions.json` — 推荐扩展（plugins）
- `AGENTS.md` — skill 概述
- `prompts/system.md` — system prompt

**ClaudeCodeBuilder**:
- `.claude/mcp.json` — MCP 配置
- `.claude/settings.local.json` — 权限
- `.claude/plugins.json` — Cloud Code plugins
- `CLAUDE.md` — 主指令文件（skills + prompts 聚合）
- `AGENTS.md` — Agent Skills 声明

**CustomBuilder**:
- 通过 `template.backend.config.builderConfig` 自定义所有路径

### 构建 Pipeline

```
WorkspaceBuilder.build():
  1. resolve     → 解析 template 引用的所有组件
  2. validate    → 检查组件兼容性
  3. scaffold    → 创建目录结构 + 骨架文件
  4. materialize → 逐项物化 domain context + plugins
  5. inject      → 注入权限、环境变量、后端特定配置
  6. verify      → 检查文件完整性
```

### 迁移策略

1. 新建 WorkspaceBuilder + CursorBuilder + ClaudeCodeBuilder
2. AgentInitializer 注入 WorkspaceBuilder
3. ContextMaterializer 标记 @deprecated
4. 迁移所有调用方 → 删除 ContextMaterializer

## 实现计划

1. 定义 `BackendBuilder` 接口 + `BuildResult` 类型
2. 实现 `CursorBuilder`
3. 实现 `ClaudeCodeBuilder`
4. 实现 `WorkspaceBuilder` 编排层
5. 迁移 `AgentInitializer` 使用新 Builder
6. `CustomBuilder` + 可配置路径
7. 集成测试 + E2E 测试更新

## 文件路径

```
packages/core/src/builder/
  ├── workspace-builder.ts        # 编排层
  ├── backend-builder.ts          # 接口定义
  ├── cursor-builder.ts           # Cursor 后端
  ├── claude-code-builder.ts      # Claude Code 后端
  ├── custom-builder.ts           # 可配置自定义后端
  └── index.ts
```

## 验收标准

- [ ] CursorBuilder 正确生成 Cursor 项目结构
- [ ] ClaudeCodeBuilder 正确生成 Claude Code 项目结构（含 CLAUDE.md、plugins）
- [ ] CustomBuilder 支持配置化路径
- [ ] Pipeline 六步骤全部实现
- [ ] 现有测试全部通过（兼容性）
- [ ] ContextMaterializer 标记 deprecated
- [ ] E2E 测试使用新 Builder 验证

---

## Comments

### cursor-agent — 2026-02-22T12:00:00

Closed as completed — Phase 3b epic complete: BackendBuilder (#46), WorkspaceBuilder Pipeline + migration (#47) all implemented and tested
