# Domain Context 各类型目录结构与格式设计

> **版本**: Draft v1 | **日期**: 2026-02-22 | **关联 Issue**: #58
>
> 每种 Domain Context 类型都有自己的目录结构、manifest.json schema 和子文件体系。
> 这些格式定义是 Actant 项目的核心产出之一。

---

## 目录

1. [通用规范](#1-通用规范)
2. [Skill — 技能](#2-skill--技能)
3. [Prompt — 提示词](#3-prompt--提示词)
4. [Workflow — 工作流](#4-workflow--工作流)
5. [MCP Server — MCP 服务配置](#5-mcp-server--mcp-服务配置)
6. [Plugin — 插件](#6-plugin--插件)
7. [Template — Agent 模板](#7-template--agent-模板)
8. [未来类型](#8-未来类型)
9. [加载机制](#9-加载机制)
10. [命名空间与 Source 集成](#10-命名空间与-source-集成)

---

## 1. 通用规范

### 1.1 两种组件形态

每种 Domain Context 类型同时支持**简单模式**和**目录模式**：

| 形态 | 结构 | 适用场景 |
|------|------|----------|
| 简单模式 | `configs/skills/my-skill.json` | 轻量组件、快速原型、向后兼容 |
| 目录模式 | `configs/skills/my-skill/manifest.json` + 子文件 | 带脚本/示例/模板的完整组件 |

加载器优先识别目录模式（检测 `manifest.json`），回退到单文件模式。

### 1.2 公共信封字段（Common Envelope）

所有类型的 `manifest.json`（或单文件 `.json`）共享以下基础字段：

```json
{
  "$type": "skill",
  "$version": 1,
  "name": "code-review",
  "description": "Rules and guidelines for reviewing code quality",
  "version": "1.0.0",
  "tags": ["review", "quality"],
  "origin": {
    "type": "builtin"
  }
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `$type` | string | 是 | 组件类型标识：`skill`, `prompt`, `workflow`, `mcp`, `plugin`, `template` |
| `$version` | number | 是 | manifest schema 版本号，用于格式演进 |
| `name` | string | 是 | 组件名称，全局唯一（同类型内），`^[a-z0-9][a-z0-9-]*$` |
| `description` | string | 推荐 | 组件说明，也用于搜索和 Agent 自动匹配 |
| `version` | semver | 否 | 组件自身的语义化版本 |
| `tags` | string[] | 否 | 分类标签 |
| `origin` | Origin | 否 | 来源信息（详见 1.3） |

### 1.3 Origin 来源追踪

```json
// 内置组件
{ "type": "builtin" }

// Source 同步
{
  "type": "source",
  "source": "actant-hub",
  "ref": "skills/code-review",
  "syncedAt": "2026-02-22T10:00:00Z",
  "syncHash": "abc1234",
  "modified": false
}

// 用户本地创建
{
  "type": "local",
  "createdBy": "human",
  "createdAt": "2026-02-22T15:00:00Z"
}
```

### 1.4 内容文件引用约定

`manifest.json` 中引用子文件使用**相对路径**（相对于 manifest.json 所在目录）：

```json
{
  "content": "content.md",
  "files": {
    "scripts": ["scripts/validate.sh"],
    "examples": ["examples/sample.md"]
  }
}
```

---

## 2. Skill — 技能

> **参考**: [Claude Code Skills](https://code.claude.com/docs/zh-CN/skills)
>
> Skill 定义 Agent 应遵循的规则、知识和能力。
> Agent 在相关时自动加载 Skill，或由用户通过命令触发。

### 2.1 目录结构

```
configs/skills/code-review/
├── manifest.json          # 元数据 + 配置（必需）
├── content.md             # 主要技能内容/指令（必需）
├── templates/             # Claude 需要填写的输出模板
│   └── review-report.md
├── examples/              # 示例输出，展示期望格式
│   └── sample-review.md
├── scripts/               # Agent 可执行的脚本
│   └── lint-check.sh
└── references/            # 参考文档，按需加载
    └── style-guide.md
```

简单模式（单文件，向后兼容）：
```
configs/skills/code-review.json
```

### 2.2 manifest.json Schema

```json
{
  "$type": "skill",
  "$version": 1,
  "name": "code-review",
  "description": "Rules and guidelines for reviewing code quality. Use when reviewing PRs, auditing code, or checking code standards.",
  "version": "1.0.0",
  "tags": ["review", "quality", "best-practices"],
  "origin": { "type": "builtin" },

  "content": "content.md",

  "invocation": {
    "modelInvocable": true,
    "userInvocable": true,
    "argumentHint": "[file-or-directory]"
  },

  "context": "inline",

  "allowedTools": ["Read", "Grep", "Glob"],

  "dependencies": ["typescript-expert"],

  "files": {
    "templates": ["templates/review-report.md"],
    "examples": ["examples/sample-review.md"],
    "scripts": ["scripts/lint-check.sh"],
    "references": ["references/style-guide.md"]
  }
}
```

### 2.3 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `content` | string | 是 | 主内容文件路径（目录模式）或内联文本（简单模式） |
| `invocation.modelInvocable` | boolean | 否 | Agent 是否可以自动加载此技能。默认 `true` |
| `invocation.userInvocable` | boolean | 否 | 用户是否可通过 `/skill-name` 调用。默认 `true` |
| `invocation.argumentHint` | string | 否 | 调用时的参数提示，如 `[file-or-directory]` |
| `context` | `"inline"` \| `"fork"` | 否 | `inline`：在当前会话中加载；`fork`：在子 Agent 中运行。默认 `inline` |
| `allowedTools` | string[] | 否 | 此技能激活时 Agent 可使用的工具白名单 |
| `dependencies` | string[] | 否 | 依赖的其他 Skill 名称，加载此技能时自动加载依赖 |
| `files.templates` | string[] | 否 | Agent 需要填写的输出模板文件 |
| `files.examples` | string[] | 否 | 展示期望输出格式的示例文件 |
| `files.scripts` | string[] | 否 | Agent 可执行的脚本文件 |
| `files.references` | string[] | 否 | 按需加载的参考文档 |

### 2.4 content.md 示例

```markdown
## Code Review Checklist

When reviewing code, always check:

- **Error handling**: try/catch, error boundaries, graceful degradation
- **Type safety**: no `any`, proper generics, discriminated unions
- **Naming**: descriptive, consistent casing, domain-aligned terminology
- **Performance**: unnecessary re-renders, N+1 queries, missing indexes
- **Tests**: edge cases covered, no flaky assertions
- **Security**: injection, XSS, auth bypass, sensitive data exposure

## Review Format

Use the template at [templates/review-report.md](templates/review-report.md) for output.
For a good example, see [examples/sample-review.md](examples/sample-review.md).

## Automated Checks

Before manual review, run the lint script:
```bash
./scripts/lint-check.sh $ARGUMENTS
```
```

### 2.5 内容类型指南

Skill 的 content.md 可以包含两种类型的内容：

**参考型内容** — Agent 在工作中应用的知识/约定/规则（自动加载）：
- 编码规范、设计模式、API 约定
- `modelInvocable: true`，让 Agent 在相关时自动应用

**任务型内容** — 给 Agent 的具体操作指令（用户触发）：
- 部署流程、发布检查、代码生成
- `modelInvocable: false`，仅用户通过命令触发

### 2.6 CLI 操作

```bash
actant skill list                              # 列出所有技能
actant skill show code-review                  # 展示技能详情
actant skill add ./my-skill/                   # 添加目录型技能
actant skill add ./simple.json                 # 添加单文件技能
actant skill remove code-review                # 删除技能
actant skill create code-review                # 交互式创建技能骨架目录
actant skill test code-review                  # 验证技能格式和引用完整性
```

### 2.7 渲染逻辑

```
resolve("code-review")
  → 找到 configs/skills/code-review/manifest.json
  → 读取 content.md → 作为主指令内容
  → description 进入 Agent 上下文（用于自动匹配）
  → files.templates / examples / references 的路径传递给 Agent 供按需读取
  → files.scripts 路径传递给 Agent 供按需执行
  → dependencies 递归解析并加载
```

---

## 3. Prompt — 提示词

> Prompt 定义系统提示、用户提示或指令模板。
> 支持变量插值 (`{{variable}}`)、多语言变体和角色分段。

### 3.1 目录结构

```
configs/prompts/system-code-reviewer/
├── manifest.json          # 元数据 + 变量定义（必需）
├── content.md             # 主提示词模板（必需）
├── variants/              # 变体版本
│   ├── zh-CN.md           # 中文版
│   ├── concise.md         # 简洁版
│   └── strict.md          # 严格版
├── partials/              # 可复用片段（供其他 Prompt 引用）
│   ├── header.md
│   └── footer.md
└── examples/              # 渲染后的示例输出
    └── rendered-example.md
```

### 3.2 manifest.json Schema

```json
{
  "$type": "prompt",
  "$version": 1,
  "name": "system-code-reviewer",
  "description": "System prompt for a code review agent",
  "version": "1.0.0",
  "tags": ["system-prompt", "code-review"],
  "origin": { "type": "builtin" },

  "role": "system",
  "content": "content.md",

  "variables": {
    "project": {
      "type": "string",
      "description": "Target project name",
      "required": true
    },
    "language": {
      "type": "string",
      "description": "Primary programming language",
      "default": "TypeScript"
    },
    "severity_threshold": {
      "type": "enum",
      "options": ["all", "major", "critical"],
      "default": "all",
      "description": "Minimum severity level to report"
    }
  },

  "variants": {
    "zh-CN": { "content": "variants/zh-CN.md", "description": "Chinese localization" },
    "concise": { "content": "variants/concise.md", "description": "Shorter version for small changes" },
    "strict": { "content": "variants/strict.md", "description": "Stricter review criteria" }
  },

  "partials": {
    "header": "partials/header.md",
    "footer": "partials/footer.md"
  },

  "compose": ["@shared/base-system-prompt"]
}
```

### 3.3 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `role` | `"system"` \| `"user"` \| `"assistant"` | 否 | 提示词的角色定位。默认 `system` |
| `content` | string | 是 | 主模板文件路径或内联文本 |
| `variables` | Record<string, VariableDef> | 否 | 变量定义，带类型、默认值、说明 |
| `variables.*.type` | `"string"` \| `"number"` \| `"boolean"` \| `"enum"` | 是 | 变量数据类型 |
| `variables.*.required` | boolean | 否 | 是否必填。默认 `false` |
| `variables.*.default` | any | 否 | 默认值 |
| `variables.*.options` | string[] | 当 type=enum | 枚举可选值 |
| `variants` | Record<string, VariantDef> | 否 | 命名变体，每个指向不同内容文件 |
| `partials` | Record<string, string> | 否 | 可复用片段，可被 `{{>partial_name}}` 引用 |
| `compose` | string[] | 否 | 组合引用——此 Prompt 在渲染时会拼接这些 Prompt 的内容 |

### 3.4 content.md 示例

```markdown
{{>header}}

You are a senior code reviewer for the **{{project}}** project.
The primary language is {{language}}.

Your responsibilities:
1. Review code changes for correctness, performance, and maintainability
2. Identify potential bugs, security issues, and anti-patterns
3. Suggest improvements with concrete code examples
4. Ensure coding standards and conventions are followed
5. Verify test coverage for new functionality

Severity threshold: only report issues at **{{severity_threshold}}** level or above.

When reviewing:
- Be constructive and specific in feedback
- Explain the 'why' behind suggestions
- Prioritize issues by severity (critical > major > minor > style)
- Acknowledge good patterns and improvements

{{>footer}}
```

### 3.5 渲染逻辑

```
renderPrompt("system-code-reviewer", { project: "Actant", language: "TypeScript" })
  → 读取 content.md
  → 替换 {{>partial_name}} → 插入 partials 内容
  → 如果有 compose 引用，递归渲染并拼接
  → 替换 {{variable}} → 用传入值或默认值
  → 未传入的 required 变量 → 报错
  → 返回渲染后的纯文本
```

### 3.6 CLI 操作

```bash
actant prompt list
actant prompt show system-code-reviewer
actant prompt show system-code-reviewer --variant zh-CN
actant prompt render system-code-reviewer --var project=Actant --var language=TypeScript
actant prompt create my-prompt                 # 交互式创建骨架
actant prompt validate system-code-reviewer    # 校验变量引用完整性
```

---

## 4. Workflow — 工作流

> Workflow 定义 Agent 的开发/工作流程，由有序的阶段（Phase）组成。
> 每个阶段有独立的指令、检查清单和可选的生命周期钩子。

### 4.1 目录结构

```
configs/workflows/trellis-standard/
├── manifest.json          # 元数据 + 阶段定义（必需）
├── overview.md            # 工作流总体说明
├── phases/                # 各阶段指令（按执行顺序编号）
│   ├── 01-context.md      # Phase 1: 理解上下文
│   ├── 02-plan.md         # Phase 2: 规划
│   ├── 03-implement.md    # Phase 3: 实现
│   ├── 04-test.md         # Phase 4: 测试
│   └── 05-record.md       # Phase 5: 记录
├── checklists/            # 质量检查清单
│   └── code-quality.json
├── templates/             # 产出物模板（日志、PR 等）
│   ├── session-journal.md
│   └── pr-description.md
├── hooks/                 # 生命周期钩子脚本
│   ├── pre-phase.sh       # 每个阶段开始前执行
│   └── post-workflow.sh   # 工作流完成后执行
└── examples/              # 工作流执行示例
    └── sample-session.md
```

### 4.2 manifest.json Schema

```json
{
  "$type": "workflow",
  "$version": 1,
  "name": "trellis-standard",
  "description": "Standard Trellis development workflow with 5 phases",
  "version": "1.0.0",
  "tags": ["development", "trellis"],
  "origin": { "type": "builtin" },

  "overview": "overview.md",

  "phases": [
    {
      "id": "context",
      "name": "Read Context",
      "description": "Understand current project state and task requirements",
      "content": "phases/01-context.md",
      "required": true,
      "estimatedMinutes": 5
    },
    {
      "id": "plan",
      "name": "Plan",
      "description": "Break down the task into actionable steps",
      "content": "phases/02-plan.md",
      "required": true,
      "estimatedMinutes": 10
    },
    {
      "id": "implement",
      "name": "Implement",
      "description": "Write code following project guidelines",
      "content": "phases/03-implement.md",
      "required": true,
      "estimatedMinutes": null
    },
    {
      "id": "test",
      "name": "Test",
      "description": "Run lint, type-check, and tests",
      "content": "phases/04-test.md",
      "required": true,
      "estimatedMinutes": 5
    },
    {
      "id": "record",
      "name": "Record",
      "description": "Document changes in session journal",
      "content": "phases/05-record.md",
      "required": false,
      "estimatedMinutes": 3
    }
  ],

  "checklists": [
    {
      "name": "code-quality",
      "description": "Code quality gate — must pass before completing 'test' phase",
      "file": "checklists/code-quality.json",
      "appliesTo": "test"
    }
  ],

  "templates": {
    "sessionJournal": {
      "file": "templates/session-journal.md",
      "description": "Session work log template"
    },
    "prDescription": {
      "file": "templates/pr-description.md",
      "description": "Pull request description template"
    }
  },

  "hooks": {
    "prePhase": "hooks/pre-phase.sh",
    "postWorkflow": "hooks/post-workflow.sh"
  },

  "settings": {
    "allowSkipPhase": true,
    "requireChecklistPass": true,
    "autoRecord": true
  }
}
```

### 4.3 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `overview` | string | 否 | 工作流总体说明文件路径 |
| `phases` | Phase[] | 是 | 有序的阶段列表 |
| `phases[].id` | string | 是 | 阶段标识符，用于钩子和跳转引用 |
| `phases[].content` | string | 是 | 该阶段的详细指令文件路径 |
| `phases[].required` | boolean | 否 | 是否必须执行。默认 `true` |
| `phases[].estimatedMinutes` | number \| null | 否 | 预估耗时，`null` 表示不定 |
| `checklists` | Checklist[] | 否 | 质量检查清单 |
| `checklists[].appliesTo` | string | 否 | 关联的阶段 id |
| `templates` | Record<string, TemplateDef> | 否 | 产出物模板 |
| `hooks` | Record<string, string> | 否 | 生命周期钩子脚本路径 |
| `settings.allowSkipPhase` | boolean | 否 | 是否允许跳过非必须阶段 |
| `settings.requireChecklistPass` | boolean | 否 | 检查清单是否必须全部通过 |

### 4.4 checklists/code-quality.json 示例

```json
{
  "name": "code-quality",
  "items": [
    { "id": "lint", "text": "Lint checks pass", "command": "pnpm lint", "auto": true },
    { "id": "typecheck", "text": "Type checks pass", "command": "pnpm typecheck", "auto": true },
    { "id": "test", "text": "Tests pass", "command": "pnpm test:changed", "auto": true },
    { "id": "no-any", "text": "No `any` types introduced", "auto": false },
    { "id": "error-handling", "text": "Error handling is comprehensive", "auto": false },
    { "id": "documented", "text": "Changes documented if needed", "auto": false }
  ]
}
```

`auto: true` 的项目可以通过执行 `command` 自动判定通过/失败；`auto: false` 需要 Agent 或人类主观判断。

### 4.5 CLI 操作

```bash
actant workflow list
actant workflow show trellis-standard
actant workflow show trellis-standard --phase implement
actant workflow create my-workflow              # 交互式创建骨架
actant workflow validate trellis-standard       # 校验阶段引用完整性
```

---

## 5. MCP Server — MCP 服务配置

> MCP Server 定义 Agent 可连接的外部工具服务。
> 支持多环境配置、健康检查和工具权限控制。

### 5.1 目录结构

```
configs/mcp/filesystem/
├── manifest.json          # 连接配置 + 工具权限（必需）
├── README.md              # 使用文档
├── profiles/              # 多环境配置
│   ├── development.json   # 开发环境覆盖
│   └── production.json    # 生产环境覆盖
└── scripts/
    ├── health-check.sh    # 健康检查脚本
    └── setup.sh           # 首次安装/配置脚本
```

### 5.2 manifest.json Schema

```json
{
  "$type": "mcp",
  "$version": 1,
  "name": "filesystem",
  "description": "MCP server for filesystem access — read, write, search files within workspace",
  "version": "1.0.0",
  "tags": ["filesystem", "io"],
  "origin": { "type": "builtin" },

  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@anthropic/mcp-filesystem"],
    "env": {
      "ROOT_DIR": "{{workspaceDir}}"
    }
  },

  "profiles": {
    "development": "profiles/development.json",
    "production": "profiles/production.json"
  },

  "tools": {
    "autoApprove": ["read_file", "list_directory", "search_files"],
    "deny": ["write_file_unsafe"]
  },

  "healthCheck": {
    "enabled": true,
    "intervalMs": 30000,
    "timeoutMs": 5000,
    "script": "scripts/health-check.sh"
  },

  "connection": {
    "maxRetries": 3,
    "retryDelayMs": 1000,
    "idleTimeoutMs": 300000
  },

  "setup": {
    "script": "scripts/setup.sh",
    "requiredEnv": ["ROOT_DIR"]
  }
}
```

### 5.3 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `transport.type` | `"stdio"` \| `"sse"` \| `"streamable-http"` | 是 | MCP 传输协议类型 |
| `transport.command` | string | stdio 时必需 | 启动命令 |
| `transport.args` | string[] | 否 | 命令参数 |
| `transport.env` | Record<string, string> | 否 | 环境变量，支持 `{{workspaceDir}}` 等插值 |
| `transport.url` | string | sse/http 时必需 | 远程服务 URL |
| `profiles` | Record<string, string> | 否 | 环境特定的配置覆盖文件路径 |
| `tools.autoApprove` | string[] | 否 | 自动批准的工具名称列表 |
| `tools.deny` | string[] | 否 | 禁止使用的工具名称列表 |
| `healthCheck` | HealthCheckConfig | 否 | 健康检查配置 |
| `connection` | ConnectionConfig | 否 | 连接管理参数 |
| `setup` | SetupConfig | 否 | 首次安装配置 |
| `setup.requiredEnv` | string[] | 否 | 必须设置的环境变量 |

### 5.4 profiles/development.json 示例

Profile 文件是对 manifest.json 中 `transport` 的**局部覆盖**：

```json
{
  "transport": {
    "env": {
      "ROOT_DIR": "/home/dev/workspace",
      "DEBUG": "true"
    }
  },
  "connection": {
    "idleTimeoutMs": 0
  }
}
```

### 5.5 CLI 操作

```bash
actant mcp list
actant mcp show filesystem
actant mcp show filesystem --profile production
actant mcp test filesystem                     # 健康检查
actant mcp add ./my-mcp-server/
actant mcp create my-server                    # 交互式创建骨架
```

---

## 6. Plugin — 插件

> Plugin 是 Agent 端的能力扩展（如 Claude Code 的 memory 插件）。
> 区别于 Actant 系统级插件，这里的 Plugin 作用于 Agent 进程内部。

### 6.1 目录结构

```
configs/plugins/memory/
├── manifest.json          # 插件元数据 + 配置（必需）
├── README.md              # 使用文档
├── config-schema.json     # 插件配置项的 JSON Schema
├── scripts/
│   ├── setup.sh           # 首次安装
│   └── migrate.sh         # 版本升级迁移
└── examples/
    └── custom-config.json # 用户自定义配置示例
```

### 6.2 manifest.json Schema

```json
{
  "$type": "plugin",
  "$version": 1,
  "name": "memory",
  "description": "Persistent memory for Claude Code — enables long-term context retention across sessions",
  "version": "1.0.0",
  "tags": ["memory", "context", "persistence"],
  "origin": { "type": "builtin" },

  "pluginType": "npm",
  "source": "@anthropic/memory",
  "enabled": true,

  "config": {
    "storage": "local",
    "maxEntries": 1000
  },
  "configSchema": "config-schema.json",

  "compatibility": {
    "backends": ["claude-code"],
    "minBackendVersion": "1.0.0"
  },

  "lifecycle": {
    "setup": "scripts/setup.sh",
    "migrate": "scripts/migrate.sh"
  },

  "dependencies": []
}
```

### 6.3 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `pluginType` | `"npm"` \| `"file"` \| `"config"` | 是 | 插件类型 |
| `source` | string | npm/file 时必需 | npm 包名或文件路径 |
| `enabled` | boolean | 否 | 是否启用。默认 `true` |
| `config` | Record<string, unknown> | 否 | 插件配置参数 |
| `configSchema` | string | 否 | 配置项的 JSON Schema 文件路径 |
| `compatibility.backends` | string[] | 否 | 兼容的 Agent 后端类型 |
| `compatibility.minBackendVersion` | string | 否 | 要求的后端最低版本 |
| `lifecycle.setup` | string | 否 | 首次安装脚本 |
| `lifecycle.migrate` | string | 否 | 版本迁移脚本 |
| `dependencies` | string[] | 否 | 依赖的其他插件名称 |

### 6.4 config-schema.json 示例

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storage": {
      "type": "string",
      "enum": ["local", "remote"],
      "default": "local",
      "description": "Memory storage backend"
    },
    "maxEntries": {
      "type": "integer",
      "minimum": 100,
      "maximum": 100000,
      "default": 1000,
      "description": "Maximum number of memory entries"
    }
  }
}
```

用户可以通过 CLI 或直接编辑 manifest.json 的 `config` 字段来调整插件参数，`configSchema` 提供校验和自动补全。

### 6.5 CLI 操作

```bash
actant plugin list
actant plugin show memory
actant plugin enable memory
actant plugin disable memory
actant plugin config memory --set maxEntries=5000
actant plugin add ./my-plugin/
actant plugin create my-plugin                 # 交互式创建骨架
```

---

## 7. Template — Agent 模板

> Template 是创建 Agent Instance 的蓝图/配方。
> 组合引用 Skills、Prompts、MCP Servers、Workflows、Plugins 来定义一个完整的 Agent。
> 支持继承和参数化。

### 7.1 目录结构

```
configs/templates/code-review-agent/
├── manifest.json          # 完整的 Agent 蓝图（必需）
├── README.md              # 模板使用文档
├── overrides/             # 预设的配置覆盖变体
│   ├── strict.json        # 严格模式覆盖
│   └── quick.json         # 快速模式覆盖
├── initializer/           # 自定义初始化脚本
│   └── post-create.sh     # 创建 Instance 后执行
└── examples/
    └── usage.md           # 使用示例
```

### 7.2 manifest.json Schema

```json
{
  "$type": "template",
  "$version": 1,
  "name": "code-review-agent",
  "description": "A code review agent powered by Claude — reviews PRs, audits code quality, suggests improvements",
  "version": "1.0.0",
  "tags": ["code-review", "typescript", "quality"],
  "origin": { "type": "builtin" },

  "extends": null,

  "backend": {
    "type": "claude-code",
    "config": {
      "model": "claude-sonnet-4-20250514"
    }
  },

  "provider": {
    "type": "anthropic",
    "config": {
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    }
  },

  "domainContext": {
    "skills": ["code-review", "typescript-expert"],
    "prompts": ["system-code-reviewer"],
    "mcpServers": ["filesystem"],
    "workflow": "trellis-standard",
    "plugins": ["memory"]
  },

  "initializer": {
    "steps": [
      { "type": "create-workspace" },
      { "type": "apply-workflow" },
      { "type": "run-script", "config": { "script": "initializer/post-create.sh" } }
    ]
  },

  "parameters": {
    "project": {
      "type": "string",
      "description": "Project name — used in prompt rendering",
      "required": true
    },
    "strictness": {
      "type": "enum",
      "options": ["normal", "strict", "relaxed"],
      "default": "normal",
      "description": "Review strictness level"
    }
  },

  "overrides": {
    "strict": { "file": "overrides/strict.json", "description": "Strict mode: lower tolerance, more checks" },
    "quick": { "file": "overrides/quick.json", "description": "Quick mode: focus on critical issues only" }
  },

  "schedule": null,

  "metadata": {
    "author": "Actant Team",
    "license": "MIT",
    "homepage": "https://github.com/anthropics/actant"
  }
}
```

### 7.3 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `extends` | string \| null | 否 | 父模板名称——继承其所有配置，本模板做增量覆盖 |
| `backend` | BackendConfig | 是 | Agent 后端配置 |
| `provider` | ProviderConfig | 是 | 模型提供者配置 |
| `domainContext` | DomainContextRef | 是 | 引用的领域组件名称集合 |
| `domainContext.skills` | string[] | 否 | 引用的 Skill 名称列表（支持 `@source/name` FQN） |
| `domainContext.prompts` | string[] | 否 | 引用的 Prompt 名称列表 |
| `domainContext.mcpServers` | string[] | 否 | 引用的 MCP Server 名称列表 |
| `domainContext.workflow` | string | 否 | 引用的 Workflow 名称 |
| `domainContext.plugins` | string[] | 否 | 引用的 Plugin 名称列表 |
| `parameters` | Record<string, ParamDef> | 否 | 模板参数——创建 Instance 时传入 |
| `overrides` | Record<string, OverrideDef> | 否 | 预设覆盖方案 |
| `schedule` | ScheduleConfig \| null | 否 | 调度配置（雇员型 Agent） |

### 7.4 继承机制

```json
{
  "name": "strict-code-review-agent",
  "extends": "code-review-agent",
  "domainContext": {
    "skills": ["...inherit", "security-audit"]
  },
  "backend": {
    "config": {
      "model": "claude-opus-4-20250514"
    }
  }
}
```

- `extends` 指向父模板名称
- 子模板的字段做**深度合并**覆盖父模板
- 数组字段使用 `"...inherit"` 占位符表示「保留父模板内容并追加」
- 不含 `"...inherit"` 的数组字段直接替换

### 7.5 overrides/strict.json 示例

Override 文件是 manifest.json 的局部覆盖补丁：

```json
{
  "domainContext": {
    "skills": ["...inherit", "security-audit", "performance-check"]
  },
  "backend": {
    "config": {
      "model": "claude-opus-4-20250514"
    }
  }
}
```

### 7.6 CLI 操作

```bash
actant template list
actant template show code-review-agent
actant template show code-review-agent --override strict
actant template validate code-review-agent     # 校验所有组件引用是否存在
actant template create my-template             # 交互式创建骨架
actant template dry-run code-review-agent --param project=Actant  # 预览渲染结果

# 使用模板创建 Agent Instance
actant agent create reviewer --template code-review-agent --param project=Actant
actant agent create reviewer --template code-review-agent --override strict
```

---

## 8. 未来类型

以下类型遵循同样的目录模式设计，在需要时实现：

### Knowledge — 知识库

```
configs/knowledge/project-conventions/
├── manifest.json          # 元数据 + 分块策略
├── documents/             # 源文档
│   ├── coding-standards.md
│   ├── api-design.md
│   └── architecture.md
└── index.json             # 预构建的检索索引
```

适用于大量参考文档场景，Agent 按需检索而非全量加载。

### Evaluator — 评估器

```
configs/evaluators/code-quality-rubric/
├── manifest.json          # 元数据 + 评分维度
├── rubric.json            # 评分标准定义
├── test-cases/            # 标准测试用例
│   ├── pass-example.json
│   └── fail-example.json
└── scripts/
    └── score.sh           # 自动评分脚本
```

用于评估 Agent 的输出质量。

### Guardrail — 安全规则

```
configs/guardrails/sensitive-data-protection/
├── manifest.json          # 元数据 + 触发条件
├── rules.json             # 规则定义
├── patterns/              # 检测模式
│   └── pii-patterns.json
└── scripts/
    └── scan.sh            # 扫描脚本
```

定义 Agent 的行为边界和安全约束。

---

## 9. 加载机制

### 9.1 组件发现算法

```
scanDirectory(configsDir/skills/)
  for each entry in directory:
    if entry is directory AND contains manifest.json:
      → 加载为目录模式组件
    else if entry is .json file AND not starts with "_":
      → 加载为简单模式组件
    else if entry is directory AND starts with "@":
      → 递归扫描（Source 命名空间）
    else:
      → 跳过
```

### 9.2 BaseComponentManager 扩展

```typescript
async loadFromDirectory(dirPath: string): Promise<number> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    // @source/ 命名空间 → 递归
    if (entry.isDirectory() && entry.name.startsWith('@')) {
      count += await this.loadFromDirectory(join(dirPath, entry.name));
      continue;
    }

    // 目录模式 → 检测 manifest.json
    if (entry.isDirectory()) {
      const manifestPath = join(dirPath, entry.name, 'manifest.json');
      if (await exists(manifestPath)) {
        const component = await this.loadDirectoryComponent(dirPath, entry.name);
        this.register(component);
        count++;
      }
      continue;
    }

    // 简单模式 → 单文件 .json
    if (entry.isFile() && extname(entry.name) === '.json' && !entry.name.startsWith('_')) {
      const component = await this.loadJsonComponent(join(dirPath, entry.name));
      this.register(component);
      count++;
    }
  }
  return count;
}
```

### 9.3 内容文件解析

目录模式下，manifest.json 中的 `content` 字段指向外部文件。加载器读取该文件并注入到组件对象中：

```typescript
async loadDirectoryComponent(baseDir: string, dirName: string): Promise<T> {
  const componentDir = join(baseDir, dirName);
  const manifestRaw = await readFile(join(componentDir, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  // 如果 content 是文件路径，读取文件内容
  if (manifest.content && !manifest.content.includes('\n')) {
    const contentPath = join(componentDir, manifest.content);
    manifest.content = await readFile(contentPath, 'utf-8');
  }

  // 记录组件目录路径，供后续解析 files 引用
  manifest._componentDir = componentDir;

  return this.validate(manifest, componentDir);
}
```

---

## 10. 命名空间与 Source 集成

### 10.1 `@<source>/` 命名空间

```
configs/skills/
├── code-review/               # 本地组件
├── typescript-expert.json     # 本地简单组件
├── @actant-hub/               # 来自 source "actant-hub"
│   ├── python-expert/
│   │   ├── manifest.json
│   │   └── content.md
│   └── security-audit.json
└── @my-team/                  # 来自 source "my-team"
    └── internal-standards/
        ├── manifest.json
        └── content.md
```

### 10.2 全限定名（FQN）

| 引用方式 | 含义 |
|----------|------|
| `"code-review"` | 本地组件，优先查找 |
| `"@actant-hub/python-expert"` | 明确指定 Source 命名空间 |
| `"@my-team/internal-standards"` | 明确指定另一个 Source |

### 10.3 解析优先级

1. 精确匹配本地：`configs/skills/code-review/` 或 `configs/skills/code-review.json`
2. 若无本地匹配，搜索 `@*/code-review`
3. 若多个 Source 都有同名组件 → 报错，要求使用 FQN

### 10.4 Source Sync 行为

```
actant source sync actant-hub
  → 拉取 source 内容到缓存
  → 对每个组件：
     → 检查 configs/<type>/@actant-hub/<name>/ 是否已存在
     → 若不存在 → 创建，设置 origin.type = "source"
     → 若存在且 origin.modified = false → 覆盖更新，刷新 syncHash/syncedAt
     → 若存在且 origin.modified = true → 提示冲突，用户选择
```

---

## 附录：类型速查表

| 类型 | 入口文件 | 核心子文件 | 关键特性 |
|------|----------|-----------|---------|
| **Skill** | manifest.json | content.md, scripts/, templates/, examples/, references/ | 调用控制, 工具白名单, 依赖链, fork 执行 |
| **Prompt** | manifest.json | content.md, variants/, partials/ | 变量插值, 类型化变量, 多语言变体, 组合引用 |
| **Workflow** | manifest.json | overview.md, phases/, checklists/, templates/, hooks/ | 有序阶段, 质量门, 生命周期钩子, 产出物模板 |
| **MCP** | manifest.json | README.md, profiles/, scripts/ | 多环境, 健康检查, 工具权限, 连接管理 |
| **Plugin** | manifest.json | README.md, config-schema.json, scripts/ | 配置 schema, 兼容性, 生命周期脚本, 依赖 |
| **Template** | manifest.json | README.md, overrides/, initializer/, examples/ | 继承/组合, 参数化, 覆盖方案, 预览/dry-run |
