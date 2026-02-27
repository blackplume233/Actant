---
id: 223
title: "RFC: Skill 组件模型重构 — 扩增 MCP 依赖、去除 Presets、合并 Workflow"
status: open
labels:
  - rfc
  - architecture
  - "priority:P1"
milestone: null
author: human
assignees: []
relatedIssues:
  - 132
  - 135
  - 204
  - 137
relatedFiles:
  - packages/shared/src/types/domain-component.types.ts
  - packages/shared/src/types/source.types.ts
  - packages/shared/src/types/template.types.ts
  - packages/shared/src/types/domain-context.types.ts
taskRef: null
githubRef: "blackplume233/Actant#223"
closedAs: null
createdAt: 2026-02-27T00:00:00
updatedAt: 2026-02-27T00:00:00
closedAt: null
---

**Related Issues**: [[0132-deprecate-workflow-merge-into-skill]], [[0135-workflow-as-hook-package]], [[0204-actant-hub-default-employee-agent-templates]], [[0137-runtime-mcp-manager]]
**Related Files**: `packages/shared/src/types/domain-component.types.ts`, `packages/shared/src/types/source.types.ts`, `packages/shared/src/types/template.types.ts`, `packages/shared/src/types/domain-context.types.ts`

---

## 背景

当前 Actant 的组件模型包含 6 种组件类型：Skill、Prompt、McpServer、Workflow、Template、Plugin，外加 Preset 作为组合层。经过实际使用和 #132 / #135 的讨论，发现以下问题：

1. **Skill 缺乏 MCP 依赖声明**：一个 Skill 往往需要特定 MCP 工具才能工作（如 "database-ops" 技能需要数据库 MCP Server），但当前 `SkillDefinition` 无法表达这种依赖关系，导致用户必须手动在 Template 层额外配置 MCP Server
2. **Preset 定位模糊，价值有限**：`PresetDefinition` 只是将 skills/prompts/mcpServers/workflows/templates 打包在一起，但 Template 本身已经通过 `DomainContextConfig` 完成了组合。Preset 增加了概念复杂度却没有带来足够收益
3. **Workflow（内容型）与 Skill 职责重叠**：#132 已提出合并方向；#135 将 Workflow 重定义为 Hook Package 后，原本的"内容型 Workflow"（纯 markdown 工作流文档）与 Skill 几乎无法区分

## 提案：三项变更

### 变更 1：Skill 扩增 MCP 依赖声明

在 `SkillDefinition` 中新增 `mcpDependencies` 字段，允许 Skill 声明其依赖的 MCP Server。

**效果**：
- Skill 成为更自包含的能力单元，安装一个 Skill 可以自动拉取所需 MCP Server
- Template 层的 `domainContext.mcpServers` 仍保留作为显式配置，两层会合并去重
- 实质化时，`SkillMaterializationStrategy` 需要同时处理技能内容和 MCP 依赖

### 变更 2：去除 Preset 概念

从组件模型中移除 `PresetDefinition`。Template 的 `DomainContextConfig` 已经是组件组合的正确层级。#204 中规划的 4 个 Preset 可以直接用多个 Template 变体实现。

### 变更 3：合并 Workflow（内容型）到 Skill

纯内容型 Workflow 迁移为 Skill（可加 `tags: ["workflow"]`）。Hook Package 型 Workflow 保留为独立类型或吸收进 Skill。

详细设计见 GitHub Issue body。

## 待讨论

1. 方案 A vs B：Skill 是否应同时承载知识注入 + 事件自动化？
2. mcpDependencies 解析时机：安装时 vs 实质化时？
3. Preset 的迁移窗口
4. DomainContextConfig.workflow 字段如何平滑废弃？
