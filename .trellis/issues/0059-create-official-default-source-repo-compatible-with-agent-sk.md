---
id: 59
title: 创建官方默认 Source 仓库 — 兼容 Agent Skills (skill.sh) 格式的 GitHub 组件包
status: closed
closedAt: "2026-02-22"
labels:
  - feature
  - "priority:P1"
  - source
  - architecture
  - domain
  - devx
milestone: phase-3
author: cursor-agent
assignees: []
relatedIssues:
  - 52
  - 53
  - 58
  - 38
  - 54
  - 55
relatedFiles:
  - packages/core/src/source/github-source.ts
  - packages/core/src/source/local-source.ts
  - packages/core/src/source/component-source.ts
  - packages/shared/src/types/source.types.ts
  - packages/shared/src/types/domain-component.types.ts
taskRef: null
githubRef: "blackplume233/Actant#111"
closedAs: null
createdAt: "2026-02-22T03:45:42"
updatedAt: "2026-02-22T03:46:35"
---

**Related Issues**: [[0052-shareable-agent-template-source]], [[0053-shareable-component-versioning]], [[0058-domain-config-format-redesign]], [[0038-rename-agentcraft-to-actant]], [[0054-domain-context-extensibility-guide]], [[0055-installation-help-update-mechanism]]
**Related Files**: `packages/core/src/source/github-source.ts`, `packages/core/src/source/local-source.ts`, `packages/core/src/source/component-source.ts`, `packages/shared/src/types/source.types.ts`, `packages/shared/src/types/domain-component.types.ts`

---

## 目标

Actant 需要一个**官方默认 GitHub 仓库**作为内置 Source（类似 Homebrew 的 homebrew-core），用户安装后即可开箱获取一套基础组件。同时该仓库的目录结构应尽量与 [Agent Skills](https://agentskills.io/specification)（skill.sh）格式兼容，实现 **一个仓库，两个生态** 的共享能力。

## 背景

### 当前现状

1. Actant Source 系统已支持 GitHub 仓库（`GitHubSource`）和本地目录（`LocalSource`）作为组件源
2. `actant.json` 作为 PackageManifest，声明 `skills/`、`prompts/`、`mcp/`、`workflows/`、`presets/` 目录
3. 但**没有一个官方的默认仓库**，用户需要手动添加 Source
4. Agent Skills 生态（skill.sh）采用 `SKILL.md` + frontmatter + `scripts/` / `references/` / `assets/` 的目录约定，已有 71,000+ 个 skill，被 Claude Code、Cursor、Gemini CLI 等 10+ 平台支持

### 兼容性分析

| 维度 | Actant Source 格式 | Agent Skills 格式 | 兼容策略 |
|------|-------------------|-------------------|---------|
| 入口文件 | `actant.json` (PackageManifest) | `SKILL.md` (YAML frontmatter) | 共存：仓库根目录放 `actant.json`，每个 skill 子目录放 `SKILL.md` |
| Skill 格式 | `skills/*.json` (SkillDefinition) | `skill-name/SKILL.md` (Markdown) | Actant 的 `LocalSource` 扩展为同时支持 `.json` 和 `SKILL.md` 格式 |
| 目录结构 | 扁平：`skills/`、`prompts/`、`mcp/` | 每个 skill 一个子目录 | 双层：`skills/skill-name/SKILL.md` + `skills/skill-name.json` |
| 元数据 | JSON 中的 `name`、`description`、`tags` | YAML frontmatter 中的 `name`、`description`、`metadata` | 可互转 |
| 安装方式 | `actant source add` | `npx skills add owner/repo` | 两种方式均可使用 |

## 方案

### 1. 仓库名称与结构

建议仓库：`blackplume233/actant-hub`（或 `actant-official-source`）

```
actant-hub/
├── actant.json              # Actant PackageManifest
├── README.md
├── LICENSE
│
├── skills/                  # Skill 组件（双格式）
│   ├── code-review/         # Agent Skills 兼容目录
│   │   ├── SKILL.md         # skill.sh 标准入口
│   │   ├── scripts/         # 可选脚本
│   │   └── references/      # 可选参考文档
│   ├── code-review.json     # Actant SkillDefinition（可由 SKILL.md 自动生成）
│   ├── test-writer/
│   │   └── SKILL.md
│   └── test-writer.json
│
├── prompts/                 # Prompt 组件
│   ├── system-prompt.json
│   └── code-assistant.json
│
├── mcp/                     # MCP Server 配置
│   └── memory-server.json
│
├── workflows/               # Workflow 定义
│   └── tdd-workflow.json
│
├── plugins/                 # Plugin 定义（#58 定义后补充）
│   └── memory-plugin.json
│
├── templates/               # AgentTemplate（#52 完成后）
│   └── code-reviewer.json
│
└── presets/                 # 预设组合包
    └── full-dev-suite.json
```

### 2. actant.json 示例

```json
{
  "name": "actant-hub",
  "version": "0.1.0",
  "description": "Actant 官方组件仓库 — 内置 Skills、Prompts、MCP 配置、Workflows 和预设",
  "components": {
    "skills": ["skills/code-review.json", "skills/test-writer.json"],
    "prompts": ["prompts/system-prompt.json"],
    "mcp": ["mcp/memory-server.json"],
    "workflows": ["workflows/tdd-workflow.json"]
  },
  "presets": ["presets/full-dev-suite.json"]
}
```

### 3. Skill 双格式策略

每个 Skill 同时提供两种格式：

**SKILL.md**（skill.sh 兼容）：

```markdown

name: code-review
description: 代码审查技能，指导 Agent 进行系统化的代码审查。
license: MIT
metadata:
  author: blackplume233
  version: "1.0.0"
  actant-tags: "code-quality,review"

# Code Review Skill

（skill 正文内容）
```

**code-review.json**（Actant SkillDefinition）：

```json
{
  "name": "code-review",
  "description": "代码审查技能",
  "content": "（从 SKILL.md body 提取）",
  "tags": ["code-quality", "review"]
}
```

可提供 `scripts/build.mjs` 从 SKILL.md 自动生成 .json，保证单一数据源（SKILL.md 为 source of truth）。

### 4. Actant 内置默认 Source

Actant 安装后自动注册该仓库为默认 Source：

```typescript
const DEFAULT_SOURCE: SourceEntry = {
  name: 'actant-hub',
  config: {
    type: 'github',
    url: 'https://github.com/blackplume233/actant-hub.git',
    branch: 'main',
  },
};
```

### 5. LocalSource 扩展支持 SKILL.md

当前 `LocalSource.loadJsonDir()` 仅加载 `.json` 文件。需扩展为：
- 扫描子目录中的 `SKILL.md` 文件
- 解析 YAML frontmatter 和 Markdown body
- 转换为 `SkillDefinition` 格式
- 与 `.json` 文件合并（`.json` 优先）

这样 Actant 就能直接消费任何 Agent Skills 格式的仓库。

### 6. 与 skill.sh 生态的互操作

- 用户可以 `npx skills add blackplume233/actant-hub` 将 Actant 官方 skill 安装到 Claude Code / Cursor
- 用户可以 `actant source add` 任何 skill.sh 上的仓库（只要包含 `SKILL.md`）
- `actant.json` 不会干扰 skill.sh CLI 的识别（它只关注 SKILL.md）

## 验收标准

- [ ] GitHub 仓库 `blackplume233/actant-hub` 创建并初始化
- [ ] 包含 `actant.json` PackageManifest
- [ ] 至少 2 个示例 Skill（同时有 SKILL.md 和 .json）
- [ ] 至少 1 个示例 Prompt、1 个 MCP 配置、1 个 Preset
- [ ] `npx skills add blackplume233/actant-hub` 可正常安装 skill
- [ ] Actant `source add` 可正常同步该仓库
- [ ] `LocalSource` 扩展支持解析 SKILL.md 格式（或作为后续子任务）
- [ ] Actant 初始化时默认注册该 Source（或作为后续子任务）
- [ ] 包含 `scripts/build.mjs` 从 SKILL.md 生成 .json（可选）
- [ ] README 说明仓库用途、贡献指南和目录结构
