---
id: 150
title: "RFC: Backend Materialization Plugin System"
status: open
labels:
  - rfc
  - architecture
  - "priority:P1"
  - core
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 131
  - 99
  - 100
  - 45
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/builder/workspace-builder.ts
  - packages/core/src/builder/backend-builder.ts
  - packages/core/src/builder/cursor-builder.ts
  - packages/core/src/builder/claude-code-builder.ts
  - packages/core/src/builder/custom-builder.ts
  - packages/pi/src/pi-builder.ts
  - packages/core/src/domain/backend/backend-manager.ts
  - packages/core/src/manager/launcher/builtin-backends.ts
taskRef: null
githubRef: "blackplume233/Actant#150"
closedAs: null
createdAt: 2026-02-24T12:00:00
updatedAt: 2026-02-24T12:00:00
closedAt: null
---

**Related Issues**: [[0131-pluggable-backend-registry]], [[0099-backend-builder-implementations]], [[0100-workspace-builder-migration]], [[0045-workspace-builder]]
**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/builder/workspace-builder.ts`, `packages/core/src/builder/backend-builder.ts`, `packages/core/src/builder/cursor-builder.ts`, `packages/core/src/builder/claude-code-builder.ts`, `packages/core/src/builder/custom-builder.ts`, `packages/pi/src/pi-builder.ts`, `packages/core/src/domain/backend/backend-manager.ts`, `packages/core/src/manager/launcher/builtin-backends.ts`

---

## 背景

当前 Agent 后端的物化（materialization）逻辑分散在独立的 `BackendBuilder` 实现类中（`CursorBuilder`、`ClaudeCodeBuilder`、`PiBuilder`、`CustomBuilder`），而 `BackendDefinition`（`template.types.ts`）仅描述运行时启动配置（命令、模式、安装方式），**完全没有物化流程的描述**。

这导致：
- 新增后端必须手写一个完整的 Builder 类并硬编码注册
- `WorkspaceBuilder` 构造函数中硬编码了 `cursor` 和 `claude-code` 两个 builder
- 用户自定义后端（`custom` 类型）无法声明自己的物化逻辑，只能继承 CursorBuilder
- 物化差异不可序列化、不可分发、不可在运行时动态加载

## 问题

需要一种 **插件式的、可声明的、可执行的物化流程描述机制**，使得：
1. `BackendDefinition` 能自包含或引用物化逻辑
2. 第三方/用户自定义后端可通过配置文件（而非源码修改）注册物化策略
3. 不同后端的物化差异被清晰归类和文档化

## 现有后端物化差异分析

| 维度 | Cursor | Claude Code | Pi | Custom |
|------|--------|------------|-----|--------|
| **配置目录** | `.cursor/` | `.claude/` | `.pi/` | `.cursor/`（继承） |
| **Skills 产物** | `.cursor/rules/*.mdc` + `AGENTS.md` | `AGENTS.md` + `CLAUDE.md` | `.pi/skills/*.md` + `AGENTS.md` | 同 Cursor |
| **Prompts 产物** | `prompts/system.md`（合并） | `prompts/system.md`（合并） | `.pi/prompts/*.md`（按文件拆分） | 同 Cursor |
| **MCP 配置** | `.cursor/mcp.json` | `.claude/mcp.json` | 不支持（warn 跳过） | 同 Cursor |
| **Plugins 产物** | `.cursor/extensions.json` | `.claude/plugins.json` | 不支持（no-op） | 同 Cursor |
| **权限注入** | `.cursor/settings.json`（best-effort） | `.claude/settings.local.json`（完整 allow/deny/ask） | `.pi/settings.json`（仅 tools 列表） | 同 Cursor |
| **Workflow** | `.trellis/workflow.md` | `.trellis/workflow.md` | `.trellis/workflow.md` | 同 Cursor |
| **Verify 检查** | `.cursor/` dir + `AGENTS.md` | `.claude/` dir + `AGENTS.md` + `CLAUDE.md` | `AGENTS.md` only | 同 Cursor |

### 关键差异维度

1. **目录结构差异**：每个后端有不同的配置根目录
2. **Skills 格式差异**：Cursor 用 `.mdc` frontmatter 格式；Claude Code 额外生成 `CLAUDE.md`；Pi 用纯 `.md` 拆分文件
3. **MCP 支持差异**：Pi 完全不支持 MCP，但 Cursor 和 Claude Code 格式基本一致
4. **Plugins 格式差异**：Cursor 用 VSCode 风格 `extensions.json`；Claude Code 用自定义 `plugins.json`
5. **权限模型差异**：Claude Code 最完整（allow/deny/ask + sandbox）；Cursor best-effort；Pi 最简化
6. **Prompts 拆分差异**：Cursor/ClaudeCode 合并到单文件；Pi 按 prompt 拆分为多文件

## 方案

### Phase 1: 物化描述模型（MaterializationSpec）

在 `BackendDefinition` 中增加可选的 `materialization` 字段，声明式描述物化行为。

### Phase 2: 插件式执行器（MaterializationPlugin）

允许后端通过可执行代码（外部文件/npm 包）定义物化逻辑。

### Phase 3: WorkspaceBuilder 动态加载

`WorkspaceBuilder` 从 `BackendManager` 动态解析 builder，不再硬编码。

## 验收标准

- [ ] `BackendDefinition` 增加 `materialization?` 和 `materializationPlugin?` 字段
- [ ] 现有 4 个 Builder 的物化行为可通过 `MaterializationSpec` 声明式描述
- [ ] 新增 `DeclarativeBuilder`：基于 `MaterializationSpec` 自动执行物化
- [ ] `WorkspaceBuilder` 支持从 `BackendManager` 动态解析 builder
- [ ] `materializationPlugin` 支持从外部文件/npm 包动态加载自定义 Builder
- [ ] 用户可通过 `~/.actant/configs/backends/` 注册包含物化描述的自定义后端
- [ ] 单元测试覆盖所有物化策略组合
- [ ] 文档更新

---

## Comments
