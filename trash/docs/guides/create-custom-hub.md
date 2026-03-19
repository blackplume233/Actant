# 从零创建自定义 ActantHub

本指南带你从 `git init` 开始，创建一个可被任意 Actant 实例使用的自定义组件仓库（Hub）。

## 前置条件

- Node.js >= 18
- Git
- Actant CLI 已安装（`npm install -g @actant/cli`）

## 快速开始

### 1. 初始化仓库

```bash
mkdir my-hub && cd my-hub
git init
```

### 2. 创建目录结构

```bash
mkdir -p skills prompts mcp workflows templates presets
```

标准目录结构：

```
my-hub/
├── actant.json              # 必需：包清单（Source 系统入口）
├── README.md
├── skills/                  # Skill 组件
│   ├── my-skill.json
│   └── my-skill/
│       └── SKILL.md         # Agent Skills 兼容格式（可选）
├── prompts/                 # Prompt 组件
│   └── my-prompt.json
├── mcp/                     # MCP Server 配置
│   └── my-mcp.json
├── workflows/               # Workflow 组件
│   └── my-workflow.json
├── templates/               # Agent Template
│   └── my-template.json
└── presets/                 # 组合包
    └── my-preset.json
```

### 3. 编写 actant.json

`actant.json` 是 Source 系统的入口文件，**必须**放在仓库根目录。

**最小示例**：

```json
{
  "name": "my-hub"
}
```

Source 系统会自动扫描标准目录。如果需要显式声明组件（推荐），使用完整格式：

```json
{
  "name": "my-hub",
  "version": "0.1.0",
  "description": "My custom component hub",
  "components": {
    "skills": ["skills/code-review.json", "skills/test-writer.json"],
    "prompts": ["prompts/system-prompt.json"],
    "mcp": ["mcp/filesystem.json"],
    "workflows": ["workflows/tdd-workflow.json"],
    "templates": ["templates/code-reviewer.json"]
  },
  "presets": ["presets/dev-suite.json"]
}
```

**PackageManifest 字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 包名称（用于 `package@component` 命名空间） |
| `version` | string | 否 | 包版本号（semver） |
| `description` | string | 否 | 包描述 |
| `components` | object | 否 | 显式组件文件路径列表 |
| `components.skills` | string[] | 否 | Skill 文件相对路径 |
| `components.prompts` | string[] | 否 | Prompt 文件相对路径 |
| `components.mcp` | string[] | 否 | MCP 配置文件相对路径 |
| `components.workflows` | string[] | 否 | Workflow 文件相对路径 |
| `components.templates` | string[] | 否 | Template 文件相对路径 |
| `presets` | string[] | 否 | Preset 文件相对路径 |

> 如果省略 `components`，Source 系统会自动扫描 `skills/`、`prompts/`、`mcp/`、`workflows/`、`templates/` 和 `presets/` 目录中的 `.json` 文件。

## 组件 JSON Schema 详解

### SkillDefinition

Skill 定义 Agent 应遵循的规则和知识。

```json
{
  "name": "code-review",
  "version": "1.0.0",
  "description": "Expert code review skill",
  "content": "# Code Review\n\nYou are an expert code reviewer...",
  "tags": ["code-quality", "review"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 唯一标识 |
| `version` | string | 否 | semver 版本 |
| `description` | string | 否（推荐） | 描述 |
| `content` | string | 是 | Skill 内容（Markdown） |
| `tags` | string[] | 否 | 分类标签 |

### PromptDefinition

Prompt 是系统提示词或指令集。

```json
{
  "name": "code-assistant",
  "version": "1.0.0",
  "description": "System prompt for code assistance",
  "content": "You are an expert software engineer. Help the user with {{task}}.",
  "variables": ["task"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 唯一标识 |
| `content` | string | 是 | 提示词内容，支持 `{{variable}}` 占位符 |
| `variables` | string[] | 否 | content 中使用的变量名列表 |

### McpServerDefinition

MCP 服务器配置。

```json
{
  "name": "filesystem",
  "version": "1.0.0",
  "description": "Filesystem MCP server",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
  "env": {}
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 唯一标识 |
| `command` | string | 是 | 启动命令 |
| `args` | string[] | 否 | 命令参数 |
| `env` | object | 否 | 环境变量 |

### WorkflowDefinition

工作流模板。

```json
{
  "name": "tdd-workflow",
  "version": "1.0.0",
  "description": "Test-driven development workflow",
  "content": "# TDD Workflow\n\n1. Write a failing test\n2. Write minimal code to pass\n3. Refactor"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 唯一标识 |
| `content` | string | 是 | 工作流内容 |

### AgentTemplate

完整的 Agent 配置模板。

```json
{
  "name": "code-reviewer",
  "version": "1.0.0",
  "description": "A code review agent",
  "backend": { "type": "claude-code" },
  "provider": { "type": "anthropic" },
  "domainContext": {
    "skills": ["code-review"],
    "prompts": ["system-prompt"],
    "mcpServers": []
  }
}
```

Template 使用 Zod schema 进行严格校验。`backend` 字段是必需的。`domainContext` 中的引用使用组件的 `name`（非完整路径）。

### PresetDefinition

Preset 将多个组件打包为按场景/领域的组合。

```json
{
  "name": "dev-suite",
  "version": "1.0.0",
  "description": "Full development suite",
  "skills": ["code-review", "test-writer"],
  "prompts": ["system-prompt"],
  "mcpServers": ["filesystem"],
  "templates": ["code-reviewer"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 唯一标识 |
| `skills` | string[] | 否 | 引用的 Skill 名称 |
| `prompts` | string[] | 否 | 引用的 Prompt 名称 |
| `mcpServers` | string[] | 否 | 引用的 MCP 名称 |
| `workflows` | string[] | 否 | 引用的 Workflow 名称 |
| `templates` | string[] | 否 | 引用的 Template 名称 |

## SKILL.md 格式

除了 JSON 格式，Skills 还支持 `SKILL.md` 格式（兼容 [Agent Skills / skill.sh](https://skills.sh) 生态）。

文件位置：`skills/<skill-name>/SKILL.md`

```markdown
---
name: code-review
description: Expert code review skill for systematic code analysis
license: MIT
metadata:
  author: your-name
  version: "1.0.0"
  actant-tags: "code-quality,review,analysis"
---

# Code Review

You are an expert code reviewer. Perform systematic reviews covering:

1. **Correctness** — Logic errors, edge cases
2. **Style** — Naming, formatting, consistency
3. **Performance** — Algorithmic complexity
4. **Security** — Input validation, injection risks
5. **Maintainability** — Readability, documentation
```

**Frontmatter 字段**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | Skill 名称（应与目录名一致） |
| `description` | 推荐 | Skill 描述 |
| `license` | 否 | 许可协议 |
| `metadata.version` | 否 | 版本号 |
| `metadata.author` | 否 | 作者 |
| `metadata.actant-tags` | 否 | 逗号分隔的标签 |

## 本地调试

### 注册为本地 Source

```bash
actant source add my-hub --local /path/to/my-hub
```

### 验证数据完整性

```bash
actant source validate --path /path/to/my-hub
```

验证器会递归检查：
- `actant.json` 结构完整性和文件引用存在性
- 每个组件 JSON 是否符合对应的 schema
- SKILL.md 是否包含必需的 frontmatter 字段
- Template 的语义校验（权限冲突、provider 配置等）
- Preset 引用的组件是否在该 Source 中存在

输出示例：

```
Validating source: my-hub (/path/to/my-hub)

  [PASS]  actant.json manifest
  [PASS]  skills/code-review.json (SkillDefinition)
  [WARN]  skills/test-writer.json — Missing "description" field
  [PASS]  templates/code-reviewer.json (AgentTemplate)

Summary: 3 component(s) passed, 1 warning(s)

Validation passed.
```

严格模式下，warnings 也会导致校验失败：

```bash
actant source validate --path /path/to/my-hub --strict
```

### 测试组件加载

注册本地 Source 后，检查组件是否正确加载：

```bash
actant skill list          # 应该看到 my-hub@code-review 等
actant template list       # 应该看到 my-hub@code-reviewer 等
actant preset list         # 应该看到 my-hub@dev-suite 等
```

## 发布到 GitHub

### 推送仓库

```bash
cd my-hub
git add .
git commit -m "feat: initial hub with skills, prompts, and templates"
git remote add origin https://github.com/your-user/my-hub.git
git push -u origin main
```

### 远程注册

在任何 Actant 实例上注册你的 Hub：

```bash
actant source add my-hub --github https://github.com/your-user/my-hub.git
```

### 持续同步

当 Hub 仓库有更新时：

```bash
actant source sync my-hub
```

## 端到端示例

完整流程演示：

```bash
# 1. 创建仓库
mkdir awesome-hub && cd awesome-hub
git init

# 2. 创建目录结构
mkdir -p skills prompts templates presets

# 3. 创建 manifest
cat > actant.json << 'EOF'
{
  "name": "awesome-hub",
  "version": "0.1.0",
  "description": "My awesome component hub",
  "components": {
    "skills": ["skills/security-review.json"],
    "prompts": ["prompts/security-prompt.json"],
    "templates": ["templates/security-agent.json"]
  },
  "presets": ["presets/security-suite.json"]
}
EOF

# 4. 创建 Skill
cat > skills/security-review.json << 'EOF'
{
  "name": "security-review",
  "version": "1.0.0",
  "description": "Security-focused code review skill",
  "content": "# Security Review\n\nYou specialize in security audits..."
}
EOF

# 5. 创建 Prompt
cat > prompts/security-prompt.json << 'EOF'
{
  "name": "security-prompt",
  "version": "1.0.0",
  "description": "System prompt for security analysis",
  "content": "You are a security expert. Analyze code for vulnerabilities."
}
EOF

# 6. 创建 Template
cat > templates/security-agent.json << 'EOF'
{
  "name": "security-agent",
  "version": "1.0.0",
  "description": "A security audit agent",
  "backend": { "type": "claude-code" },
  "domainContext": {
    "skills": ["security-review"],
    "prompts": ["security-prompt"]
  }
}
EOF

# 7. 创建 Preset
cat > presets/security-suite.json << 'EOF'
{
  "name": "security-suite",
  "version": "1.0.0",
  "description": "Security review suite",
  "skills": ["security-review"],
  "prompts": ["security-prompt"],
  "templates": ["security-agent"]
}
EOF

# 8. 验证
actant source validate --path .

# 9. 本地测试
actant source add awesome-hub --local .
actant skill list
actant template list

# 10. 发布
git add .
git commit -m "feat: initial security hub"
git remote add origin https://github.com/your-user/awesome-hub.git
git push -u origin main

# 11. 远程注册（其他机器上）
actant source add awesome-hub --github https://github.com/your-user/awesome-hub.git
```

## CI 集成

在 Hub 仓库中添加 GitHub Action，在每次 push/PR 时自动校验：

```yaml
# .github/workflows/validate-hub.yml
name: Validate Hub
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g @actant/cli
      - run: actant source validate --path . --strict
```
