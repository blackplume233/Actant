# actant-hub — 官方组件仓库设计

> Issue: [#130](https://github.com/blackplume233/Actant/issues/130)
> Status: Design
> Date: 2026-02-23

## 1. 概述

`actant-hub` 是 Actant 平台的**官方默认组件仓库**，类似 Homebrew 的 `homebrew-core`。用户安装 Actant 后，该仓库作为内置 Source 自动注册，提供开箱即用的 Skills、Prompts、MCP 配置、AgentTemplate 和 Preset 组件。

**仓库地址**：`https://github.com/blackplume233/actant-hub`

**核心原则**：
- 与现有 Source 系统完全兼容（`actant.json` + `PackageManifest`）
- 兼容 Agent Skills (skill.sh) 生态（SKILL.md 双格式）
- 不引入新组件类型，DomainContext 是现有组件的统称
- 不包含 `workflows/` 目录（Workflow 类型将废弃并归并为 Skill，另建 Issue 追踪）

## 2. 仓库结构

```
actant-hub/
├── actant.json              # PackageManifest（Source 系统入口）
├── registry.json            # 增强索引（分类、标签、搜索）
├── README.md
├── CONTRIBUTING.md
├── LICENSE                  # MIT
│
├── skills/                  # Skill 组件（双格式）
│   ├── code-review/
│   │   └── SKILL.md         # Agent Skills (skill.sh) 兼容格式
│   ├── code-review.json     # Actant SkillDefinition 格式
│   ├── test-writer/
│   │   └── SKILL.md
│   ├── test-writer.json
│   ├── doc-writer/
│   │   └── SKILL.md
│   └── doc-writer.json
│
├── prompts/                 # Prompt 组件
│   ├── code-assistant.json
│   └── qa-assistant.json
│
├── mcp/                     # MCP Server 配置
│   ├── filesystem.json
│   └── memory-server.json
│
├── templates/               # AgentTemplate 完整定义
│   ├── code-reviewer.json
│   ├── qa-engineer.json
│   └── doc-writer.json
│
└── presets/                 # 预设组合包（按领域/场景打包）
    ├── web-dev.json
    └── devops.json
```

## 3. 文件格式规范

### 3.1 actant.json（PackageManifest）

沿用现有 `PackageManifest` 接口（`packages/shared/src/types/source.types.ts`），Source 系统通过此文件发现组件。

```json
{
  "name": "actant-hub",
  "version": "0.2.0",
  "description": "Actant official component hub — skills, prompts, MCP configs, templates & presets",
  "components": {
    "skills": [
      "skills/code-review.json",
      "skills/test-writer.json",
      "skills/doc-writer.json"
    ],
    "prompts": [
      "prompts/code-assistant.json",
      "prompts/qa-assistant.json"
    ],
    "mcp": [
      "mcp/filesystem.json",
      "mcp/memory-server.json"
    ],
    "templates": [
      "templates/code-reviewer.json",
      "templates/qa-engineer.json",
      "templates/doc-writer.json"
    ]
  },
  "presets": [
    "presets/web-dev.json",
    "presets/devops.json"
  ]
}
```

### 3.2 SkillDefinition（JSON 格式）

```json
{
  "name": "code-review",
  "version": "1.0.0",
  "description": "Systematic code review skill for AI agents",
  "tags": ["code-quality", "review", "best-practices"],
  "content": "# Code Review Skill\n\n..."
}
```

### 3.3 SKILL.md（Agent Skills 兼容格式）

每个 Skill 在 `skills/{name}/SKILL.md` 提供 skill.sh 兼容版本，使得该仓库同时可被 Claude Code、Cursor 等通过 `npx skills add` 直接使用。

```markdown
---
name: code-review
description: Systematic code review skill for AI agents
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "code-quality,review,best-practices"
---

# Code Review Skill

(skill content)
```

**数据源关系**：`SKILL.md` 是 source of truth，`.json` 可由构建脚本从 SKILL.md 生成。

### 3.4 PromptDefinition

```json
{
  "name": "code-assistant",
  "version": "1.0.0",
  "description": "System prompt for a code assistant agent",
  "content": "You are a code assistant...",
  "variables": ["language", "framework"]
}
```

### 3.5 McpServerDefinition

```json
{
  "name": "filesystem",
  "version": "1.0.0",
  "description": "File system access MCP server",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
  "env": {}
}
```

### 3.6 AgentTemplate

```json
{
  "name": "code-reviewer",
  "version": "1.0.0",
  "description": "A code review agent with systematic review skills",
  "backend": { "type": "claude-code" },
  "provider": { "type": "anthropic" },
  "domainContext": {
    "skills": ["code-review"],
    "prompts": ["code-assistant"],
    "mcpServers": []
  }
}
```

### 3.7 PresetDefinition

Preset 是按领域/场景打包的组件组合，用户可通过 `actant preset apply` 一键引入。

```json
{
  "name": "web-dev",
  "version": "1.0.0",
  "description": "Web development preset — code review, testing, and filesystem access",
  "skills": ["code-review", "test-writer"],
  "prompts": ["code-assistant"],
  "mcpServers": ["filesystem"],
  "templates": ["code-reviewer"]
}
```

## 4. registry.json 增强索引

`actant.json` 供 Source 系统机读发现组件。`registry.json` 提供人/CLI 友好的增强索引，用于搜索、分类和发现。

```json
{
  "$schema": "https://actant.dev/schemas/registry-v1.json",
  "version": "1.0.0",
  "lastUpdated": "2026-02-23",
  "categories": {
    "web-dev": {
      "label": "Web Development",
      "description": "Skills and templates for web development workflows",
      "presets": ["web-dev"],
      "templates": ["code-reviewer"]
    },
    "devops": {
      "label": "DevOps & CI/CD",
      "description": "Infrastructure, deployment, and CI/CD tooling",
      "presets": ["devops"],
      "templates": []
    }
  },
  "components": {
    "skills": [
      { "name": "code-review", "description": "...", "tags": ["code-quality"], "categories": ["web-dev"] },
      { "name": "test-writer", "description": "...", "tags": ["testing"], "categories": ["web-dev"] },
      { "name": "doc-writer", "description": "...", "tags": ["documentation"], "categories": ["web-dev", "devops"] }
    ],
    "prompts": [
      { "name": "code-assistant", "description": "...", "tags": ["coding"], "categories": ["web-dev"] },
      { "name": "qa-assistant", "description": "...", "tags": ["testing"], "categories": ["web-dev"] }
    ],
    "mcp": [
      { "name": "filesystem", "description": "...", "tags": ["fs"], "categories": ["web-dev", "devops"] },
      { "name": "memory-server", "description": "...", "tags": ["memory"], "categories": ["web-dev", "devops"] }
    ],
    "templates": [
      { "name": "code-reviewer", "description": "...", "tags": ["review"], "categories": ["web-dev"] },
      { "name": "qa-engineer", "description": "...", "tags": ["testing"], "categories": ["web-dev"] },
      { "name": "doc-writer", "description": "...", "tags": ["documentation"], "categories": ["web-dev"] }
    ],
    "presets": [
      { "name": "web-dev", "description": "...", "tags": ["web"], "categories": ["web-dev"] },
      { "name": "devops", "description": "...", "tags": ["infra"], "categories": ["devops"] }
    ]
  }
}
```

## 5. Skill 双格式策略

延续 Issue #111 的设计。每个 Skill 同时提供两种格式：

| 格式 | 路径 | 消费者 | 角色 |
|------|------|--------|------|
| `SKILL.md` | `skills/{name}/SKILL.md` | skill.sh 生态 (Claude Code, Cursor, Gemini CLI) | Source of truth |
| `.json` | `skills/{name}.json` | Actant Source 系统 | 可自动生成 |

现有 `LocalSource` / `GitHubSource` 已支持读取 SKILL.md 子目录格式（扫描 `skills/*/SKILL.md`，解析 YAML frontmatter + markdown body，转换为 `SkillDefinition`）。

可选提供 `scripts/build.mjs` 从 SKILL.md 自动生成 .json 文件。

## 6. Actant 侧集成

### 6.1 自动注册默认 Source

`SourceManager` 已有常量（`source-manager.ts` L14-19）：

```typescript
export const DEFAULT_SOURCE_NAME = "actant-hub";
export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  type: "github",
  url: "https://github.com/blackplume233/actant-hub.git",
  branch: "main",
};
```

在 `initialize()` 末尾添加自动注册逻辑：若 `sources.json` 中不存在默认源，则尝试注册。网络不可用时静默跳过。

### 6.2 CLI setup 集成

`actant setup` 流程中自动同步默认源，或提示用户确认。

### 6.3 template install 命令

实现 `actant template install <source>@<name>` stub，从默认源或指定源安装模板。

## 7. 版本策略

- 仓库整体版本通过 `actant.json` 的 `version` 字段管理
- 每个组件有独立的 `version` 字段（semver）
- 通过 git tag 标记仓库里程碑版本
- `SourceManager` 的 `SyncReport` 已支持版本变更检测和 breaking change 告警

## 8. 架构决策记录

### ADR: Workflow 类型废弃

**决策**：Workflow 类型将归并为 Skill（策略 A）。actant-hub 不设 `workflows/` 目录。

**理由**：
- `WorkflowDefinition` 与 `SkillDefinition` 数据结构完全相同（`name + content`）
- 唯一区别是物化路径（`.trellis/workflow.md` vs `AGENTS.md`），不值得维护独立的类型/管理器/处理器
- 从 Agent 视角看，workflow 内容作为 Skill 同样可达

**影响范围**：废弃 `WorkflowDefinition`、`WorkflowManager`、`workflowHandler`，更新 `DomainContextConfig`，更新 Builder 和 Trellis 命令。另建 Issue 追踪，不在 #130 范围内。
