---
id: 143
title: "enhancement: ActantHub 文档完善与数据校验功能"
status: open
labels:
  - enhancement
  - "priority:P2"
  - docs
  - core
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - examples/actant-hub/
  - packages/core/src/source/source-manager.ts
  - packages/core/src/source/local-source.ts
  - packages/core/src/template/schema/template-schema.ts
  - docs/design/actant-hub-registry-design.md
taskRef: null
githubRef: "blackplume233/Actant#143"
closedAs: null
createdAt: "2026-02-24T05:41:02"
updatedAt: "2026-02-24T05:41:02"
closedAt: null
---

**Related Files**: `examples/actant-hub/`, `packages/core/src/source/source-manager.ts`, `packages/core/src/source/local-source.ts`, `packages/core/src/template/schema/template-schema.ts`, `docs/design/actant-hub-registry-design.md`

---

## 目标

优化 ActantHub（官方默认组件注册表），为其补齐三方面能力：
1. **使用文档**：编写面向用户的 ActantHub 使用指南
2. **一键构建文档**：编写如何从零开始创建一个自定义 ActantHub 的完整指南
3. **数据校验功能**：增加 CLI 命令或脚本，验证 ActantHub 中所有组件数据的有效性

## 背景

ActantHub（`actant-hub`）是 Actant 平台的官方默认组件仓库（类比 Homebrew 的 homebrew-core），提供 Skills、Prompts、MCP 配置、Workflows、Templates、Presets 等组件。

当前状态：
- 有设计文档 `docs/design/actant-hub-registry-design.md` 和示例 `examples/actant-hub/`
- `examples/actant-hub/README.md` 仅有简短说明
- 组件数据仅在 `JSON.parse` 阶段做基本解析，缺少运行时 schema 校验（Templates 除外，已有 Zod schema）
- 缺少面向终端用户的使用文档和自定义 Hub 创建指南

## 方案

### 1. ActantHub 使用文档 (`docs/guides/actant-hub-usage.md`)

内容应覆盖：
- ActantHub 是什么、解决什么问题
- 如何添加/同步官方 Source（`actant source add`、`actant source sync`）
- 如何浏览可用组件（`actant source list`）
- 如何安装模板（`actant template install actant-hub@code-reviewer`）
- 如何使用 Preset 一键安装组件组合
- 本地 Source vs GitHub Source 的区别
- 离线场景下的行为说明

### 2. 一键构建 ActantHub 指南 (`docs/guides/create-custom-hub.md`)

核心目标：用户读完这一篇指南，就能从零创建一个全新的 Git 仓库作为 ActantHub Source，发布到 GitHub 后可被任意 Actant 实例使用。

内容应覆盖：
- **从 `git init` 开始**：创建新仓库，初始化正确的目录结构
- 目录结构规范（`actant.json` + `skills/` `prompts/` `mcp/` `workflows/` `templates/` `presets/`）
- `actant.json`（PackageManifest）字段详解及最小示例
- 各组件类型的 JSON schema 说明（SkillDefinition、PromptDefinition、McpServerDefinition、WorkflowDefinition、AgentTemplate、PresetDefinition）
- SKILL.md 格式（YAML frontmatter + Markdown content）
- **本地调试**：`actant source add <name> --local ./path` 注册为本地 Source 并测试
- **发布到 GitHub**：push 到远程仓库，通过 `actant source add <name> --github <url>` 注册
- **持续同步**：`actant source sync` 保持本地缓存与远程同步
- 完整端到端示例：从 `mkdir` → `git init` → 编写组件 → 本地测试 → 推送 GitHub → 远程注册 的全流程

### 3. 数据校验功能

分为三层交付：

#### 3a. 核心校验脚本

- 独立脚本 `scripts/validate-hub.mjs`（零外部依赖，仅依赖 Node.js）
- 同时作为 CLI 命令暴露：`actant source validate [source-name]`
- 校验内容：
  - `actant.json` manifest 结构完整性（必填字段、路径引用存在性）
  - 各组件 JSON 文件符合对应的 TypeScript 类型定义
  - SKILL.md frontmatter 必填字段齐全（name、description）
  - Template 组件通过已有 Zod schema 校验
  - 组件间引用一致性（Preset 引用的 skill/prompt 名称在 manifest 中存在）
  - 输出校验报告（pass/warn/error），exit code 反映结果（0=全部通过，1=存在 error）

#### 3b. GitHub Action Workflow

- 提供可复用的 `.github/workflows/validate-hub.yml`
- 触发条件：`push` 和 `pull_request` 到 main 分支
- 运行核心校验脚本，在 Actions 日志中输出清晰的 pass/warn/error 报告
- 存在 error 级别问题时 workflow 失败
- 可选：PR 场景下以 comment 形式输出校验摘要

#### 3c. 可复用 Composite Action（可选）

- 提供 `action.yml`，使第三方 Hub 仓库可通过 `uses: blackplume233/actant-hub-validate@v1` 引用
- 输入参数：hub 根目录路径、是否严格模式
- 输出：校验结果 JSON、是否通过

## 相关文件

- `examples/actant-hub/` — 示例 Hub 目录
- `packages/core/src/source/source-manager.ts` — Source 管理核心逻辑
- `packages/core/src/source/local-source.ts` — 本地 Source 加载
- `packages/core/src/source/github-source.ts` — GitHub Source 克隆
- `packages/core/src/template/schema/template-schema.ts` — Template Zod 校验
- `packages/shared/src/types/source.types.ts` — Source 类型定义
- `packages/shared/src/types/domain-component.types.ts` — 组件类型定义
- `docs/design/actant-hub-registry-design.md` — 设计文档

## 验收标准

- [ ] `docs/guides/actant-hub-usage.md` 已编写，覆盖添加/同步/安装/Preset 等核心用法
- [ ] `docs/guides/create-custom-hub.md` 已编写，覆盖从零创建到发布的完整流程
- [ ] 核心校验脚本已实现（`scripts/validate-hub.mjs`），能检测 manifest 结构、组件 schema、引用一致性
- [ ] CLI 命令 `actant source validate` 可用
- [ ] 校验功能对 `examples/actant-hub/` 运行通过
- [ ] GitHub Action workflow（`.github/workflows/validate-hub.yml`）已提供，push/PR 时自动校验
- [ ] 第三方 Hub 仓库可通过 composite action 复用校验能力
- [ ] 现有测试不受影响
