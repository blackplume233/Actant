---
id: 58
title: DomainContext 各类型目录结构与格式设计 — 每种类型一个完整的文件体系
status: open
labels:
  - architecture
  - design
  - dx
  - "priority:P0"
milestone: phase-4
author: human
assignees: []
relatedIssues:
  - 56
  - 55
relatedFiles:
  - docs/design/domain-context-formats.md
  - packages/core/src/domain/base-component-manager.ts
  - packages/core/src/domain/skill/skill-manager.ts
  - packages/core/src/domain/prompt/prompt-manager.ts
  - packages/core/src/domain/workflow/workflow-manager.ts
  - packages/core/src/domain/mcp/mcp-config-manager.ts
  - packages/core/src/domain/plugin/plugin-manager.ts
  - packages/core/src/source/source-manager.ts
  - packages/api/src/services/app-context.ts
  - packages/shared/src/types/domain-component.types.ts
  - packages/shared/src/types/template.types.ts
  - configs/skills/code-review.json
  - configs/prompts/system-code-reviewer.json
  - configs/workflows/trellis-standard.json
  - configs/mcp/filesystem.json
  - configs/plugins/memory-plugin.json
  - configs/templates/code-review-agent.json
  - docs/stage/v0.1.0/config-schemas.md
taskRef: null
githubRef: "blackplume233/Actant#110"
closedAs: null
createdAt: "2026-02-22T18:30:00"
updatedAt: "2026-02-22T20:00:00"
closedAt: null
---

**Related Issues**: [[0056-actant-and-instance-working-directory-design]], [[0055-installation-help-update-mechanism]]
**Related Files**: `docs/design/domain-context-formats.md`, `packages/core/src/domain/base-component-manager.ts`, `packages/core/src/domain/skill/skill-manager.ts`, `packages/core/src/domain/prompt/prompt-manager.ts`, `packages/core/src/domain/workflow/workflow-manager.ts`, `packages/core/src/domain/mcp/mcp-config-manager.ts`, `packages/core/src/domain/plugin/plugin-manager.ts`, `packages/core/src/source/source-manager.ts`, `packages/api/src/services/app-context.ts`, `packages/shared/src/types/domain-component.types.ts`, `packages/shared/src/types/template.types.ts`, `configs/skills/code-review.json`, `configs/prompts/system-code-reviewer.json`, `configs/workflows/trellis-standard.json`, `configs/mcp/filesystem.json`, `configs/plugins/memory-plugin.json`, `configs/templates/code-review-agent.json`, `docs/stage/v0.1.0/config-schemas.md`

---

## 背景

当前 Actant 的每种 Domain Context 组件（Skills、Prompts 等）都是一个扁平的 JSON 文件。这种设计对于 MVP 足够，但无法支撑真正有深度的领域组件。

Claude Code 的 Skill 系统是优秀参考：一个 Skill 是一个**目录**，包含 SKILL.md + scripts/ + examples/ + templates/ 等子结构。Actant 的每种 Domain Context 类型都应当有同等深度的设计。

**这些格式定义本身是项目的重要产出。**

完整设计文档: `docs/design/domain-context-formats.md`

---

## 设计原则

1. **目录即组件**：每个组件是一个目录，不是单个文件
2. **manifest.json 是入口**：每个目录必须有 `manifest.json` 作为元数据和配置入口（JSON 格式）
3. **内容文件用自然格式**：指令/文档用 `.md`，脚本用 `.sh/.py`，结构化数据用 `.json`
4. **向后兼容**：仍支持单个 `.json` 文件作为简单模式
5. **公共信封 + 类型特有字段**：所有类型共享一组基础字段（`$type`, `$version`, `name`, `description`, `version`, `tags`, `origin`），各自扩展专属字段

---

## 公共信封（Common Envelope）

所有类型的 manifest.json 共享：

```json
{
  "$type": "skill",
  "$version": 1,
  "name": "code-review",
  "description": "...",
  "version": "1.0.0",
  "tags": ["review"],
  "origin": { "type": "builtin" }
}
```

Origin 三种类型：`builtin`（内置）、`source`（Source 同步，含 syncHash/syncedAt/modified）、`local`（用户创建）。

---

## 一、Skill — 技能

参考：[Claude Code Skills](https://code.claude.com/docs/zh-CN/skills)

### 目录结构

```
skills/code-review/
├── manifest.json          # 元数据 + 调用控制（必需）
├── content.md             # 主要技能内容/指令（必需）
├── templates/             # Agent 需要填写的输出模板
│   └── review-report.md
├── examples/              # 示例输出
│   └── sample-review.md
├── scripts/               # Agent 可执行的脚本
│   └── lint-check.sh
└── references/            # 按需加载的参考文档
    └── style-guide.md
```

### manifest.json 核心字段

| 字段 | 说明 |
|------|------|
| `content` | 主内容文件路径（目录模式）或内联文本（简单模式） |
| `invocation.modelInvocable` | Agent 可否自动加载（默认 true） |
| `invocation.userInvocable` | 用户可否 `/skill-name` 触发（默认 true） |
| `invocation.argumentHint` | 调用时参数提示 |
| `context` | `inline`（当前会话）或 `fork`（子 Agent 运行） |
| `allowedTools` | 激活时可用工具白名单 |
| `dependencies` | 依赖的其他 Skill |
| `files.{templates,examples,scripts,references}` | 子文件引用 |

---

## 二、Prompt — 提示词

### 目录结构

```
prompts/system-code-reviewer/
├── manifest.json          # 元数据 + 变量定义（必需）
├── content.md             # 主模板（支持 {{variable}} 和 {{>partial}}）
├── variants/              # 变体版本
│   ├── zh-CN.md           # 中文版
│   ├── concise.md         # 简洁版
│   └── strict.md          # 严格版
├── partials/              # 可复用片段
│   ├── header.md
│   └── footer.md
└── examples/              # 渲染后示例
```

### manifest.json 核心字段

| 字段 | 说明 |
|------|------|
| `role` | `system` / `user` / `assistant` |
| `content` | 主模板文件路径 |
| `variables` | 带类型/默认值/校验的变量定义 |
| `variables.*.type` | `string` / `number` / `boolean` / `enum` |
| `variables.*.options` | enum 时的可选值列表 |
| `variants` | 命名变体，各指向不同内容文件 |
| `partials` | 可复用片段，`{{>name}}` 语法引用 |
| `compose` | 组合其他 Prompt 内容 |

---

## 三、Workflow — 工作流

### 目录结构

```
workflows/trellis-standard/
├── manifest.json          # 元数据 + 阶段定义（必需）
├── overview.md            # 工作流总体说明
├── phases/                # 各阶段指令（按编号排序）
│   ├── 01-context.md
│   ├── 02-plan.md
│   ├── 03-implement.md
│   ├── 04-test.md
│   └── 05-record.md
├── checklists/            # 质量检查清单
│   └── code-quality.json  # items: [{id, text, command?, auto}]
├── templates/             # 产出物模板
│   ├── session-journal.md
│   └── pr-description.md
├── hooks/                 # 生命周期钩子脚本
│   ├── pre-phase.sh
│   └── post-workflow.sh
└── examples/
```

### manifest.json 核心字段

| 字段 | 说明 |
|------|------|
| `phases[]` | 有序阶段列表 |
| `phases[].{id,name,content,required,estimatedMinutes}` | 阶段定义 |
| `checklists[].{file,appliesTo}` | 质量门，绑定到阶段 |
| `templates` | 产出物模板（日志、PR 等） |
| `hooks.{prePhase,postWorkflow,...}` | 生命周期钩子 |
| `settings.{allowSkipPhase,requireChecklistPass,autoRecord}` | 行为设置 |

Checklist items 支持 `auto: true` + `command` 自动执行判定，或 `auto: false` 需人工/Agent 判断。

---

## 四、MCP Server — MCP 服务配置

### 目录结构

```
mcp/filesystem/
├── manifest.json          # 连接配置 + 工具权限（必需）
├── README.md              # 使用文档
├── profiles/              # 多环境配置
│   ├── development.json   # 局部覆盖
│   └── production.json
└── scripts/
    ├── health-check.sh
    └── setup.sh
```

### manifest.json 核心字段

| 字段 | 说明 |
|------|------|
| `transport.{type,command,args,env,url}` | 传输配置（stdio/sse/streamable-http） |
| `transport.env` | 支持 `{{workspaceDir}}` 插值 |
| `profiles` | 环境特定覆盖 |
| `tools.{autoApprove,deny}` | 工具权限白名单/黑名单 |
| `healthCheck.{enabled,intervalMs,timeoutMs,script}` | 健康检查 |
| `connection.{maxRetries,retryDelayMs,idleTimeoutMs}` | 连接管理 |
| `setup.{script,requiredEnv}` | 首次安装 |

---

## 五、Plugin — 插件

### 目录结构

```
plugins/memory/
├── manifest.json          # 插件元数据 + 配置（必需）
├── README.md              # 使用文档
├── config-schema.json     # 配置项 JSON Schema（校验+自动补全）
├── scripts/
│   ├── setup.sh
│   └── migrate.sh
└── examples/
    └── custom-config.json
```

### manifest.json 核心字段

| 字段 | 说明 |
|------|------|
| `pluginType` | `npm` / `file` / `config` |
| `source` | npm 包名或文件路径 |
| `enabled` | 是否启用 |
| `config` | 插件配置参数 |
| `configSchema` | JSON Schema 文件路径 |
| `compatibility.{backends,minBackendVersion}` | 后端兼容性 |
| `lifecycle.{setup,migrate}` | 安装/迁移脚本 |
| `dependencies` | 依赖的其他插件 |

---

## 六、Template — Agent 模板

### 目录结构

```
templates/code-review-agent/
├── manifest.json          # 完整 Agent 蓝图（必需）
├── README.md              # 模板使用文档
├── overrides/             # 预设覆盖方案
│   ├── strict.json
│   └── quick.json
├── initializer/           # 自定义初始化脚本
│   └── post-create.sh
└── examples/
    └── usage.md
```

### manifest.json 核心字段

| 字段 | 说明 |
|------|------|
| `extends` | 父模板——继承+增量覆盖 |
| `backend` / `provider` | Agent 后端和模型提供者 |
| `domainContext.{skills,prompts,mcpServers,workflow,plugins}` | 引用的领域组件（支持 `@source/name` FQN） |
| `parameters` | 类型化参数——创建 Instance 时传入 |
| `overrides` | 预设覆盖方案文件 |
| `initializer.steps[]` | 初始化步骤序列 |
| `schedule` | 调度配置（雇员型 Agent） |

继承机制：数组字段用 `"...inherit"` 保留父模板内容并追加，不含则直接替换。

---

## 七、未来类型

遵循同样的目录模式：
- **Knowledge** — 知识库：documents/ + index.json，按需检索
- **Evaluator** — 评估器：rubric.json + test-cases/，评估 Agent 输出质量
- **Guardrail** — 安全规则：rules.json + patterns/，行为边界约束

---

## 八、加载机制

组件发现顺序：
1. 目录 + `manifest.json` → 目录模式
2. `.json` 文件（非 `_` 前缀）→ 简单模式
3. `@` 前缀目录 → 递归扫描（Source 命名空间）

FQN 解析优先级：本地精确匹配 → `@*/` 搜索 → 多 Source 同名则报错要求 FQN。

---

## 速查表

| 类型 | 入口 | 核心子文件 | 关键特性 |
|------|------|-----------|----------|
| **Skill** | manifest.json | content.md, scripts/, templates/, examples/, references/ | 调用控制, 工具白名单, 依赖链, fork 执行 |
| **Prompt** | manifest.json | content.md, variants/, partials/ | 类型化变量, 多语言变体, 片段复用, 组合引用 |
| **Workflow** | manifest.json | overview.md, phases/, checklists/, templates/, hooks/ | 有序阶段, 质量门, 生命周期钩子, 产出物模板 |
| **MCP** | manifest.json | README.md, profiles/, scripts/ | 多环境, 健康检查, 工具权限, 连接管理 |
| **Plugin** | manifest.json | README.md, config-schema.json, scripts/ | 配置 schema, 兼容性, 生命周期脚本, 依赖 |
| **Template** | manifest.json | README.md, overrides/, initializer/, examples/ | 继承/组合, 参数化, 覆盖方案, 预览/dry-run |
