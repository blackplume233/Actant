---
name: "Phase 3b: #39 Workspace 构造器"
overview: "Strategy Pattern 重构 workspace 构建，替换 ContextMaterializer"
todos:
  - id: b1-interface-types
    content: "P0: 定义 BackendBuilder 接口 + BuildResult/VerifyResult 类型"
    status: pending
  - id: b2-cursor-claude-builder
    content: "P0: 实现 CursorBuilder + ClaudeCodeBuilder"
    status: pending
  - id: b3-workspace-builder
    content: "P0: WorkspaceBuilder 编排层 + 迁移 AgentInitializer"
    status: pending
  - id: b4-custom-tests
    content: "P1: CustomBuilder + ContextMaterializer deprecate + E2E 测试"
    status: pending
isProject: false
---

# Phase 3b: #39 Workspace 构造器

## 前置条件

- Phase 3a (#38) 完成 — 需要 PluginManager 用于 plugin 物化

## 目标

用 Strategy Pattern 重构 workspace 构建流程，不同后端产出各自最优的文件结构。

## 当前问题

- ContextMaterializer 路径硬编码，不区分后端
- 无 scaffold（不创建项目骨架）
- 无 Plugin 物化
- 无构建后验证

## Todo 1: 接口 + 类型

**新文件**: `packages/core/src/builder/backend-builder.ts`

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

## Todo 2: CursorBuilder + ClaudeCodeBuilder

**CursorBuilder** — `.cursor/rules/*.mdc` + `.cursor/mcp.json` + AGENTS.md
**ClaudeCodeBuilder** — `.claude/*` + CLAUDE.md + plugins.json + settings.local.json

## Todo 3: WorkspaceBuilder + 迁移

Pipeline: resolve → validate → scaffold → materialize → inject → verify

迁移 AgentInitializer 从 ContextMaterializer 到 WorkspaceBuilder。

## Todo 4: CustomBuilder + 测试

- CustomBuilder 支持 `builderConfig` 自定义路径
- ContextMaterializer 标记 @deprecated
- E2E 测试验证新 Builder

## 验收标准

- [ ] CursorBuilder 正确生成 Cursor 项目结构
- [ ] ClaudeCodeBuilder 正确生成 Claude Code 项目结构
- [ ] CustomBuilder 支持配置化路径
- [ ] Pipeline 六步骤全部实现
- [ ] 现有测试全部通过
- [ ] ContextMaterializer 标记 deprecated
