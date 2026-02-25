# 功能：领域上下文拼装（Domain Context）

> Domain Context 是 Agent 能力的组合容器——通过 Skills、Prompts、MCP Server、Workflow、Plugin 五类组件的自由拼装，赋予 Agent 不同的专业能力。

---

## 这个功能做什么

Domain Context 解决的核心问题是：**如何让同一个 Agent 后端在不同的业务场景下表现出不同的专业能力**。

通过将 Agent 的能力拆解为标准化的组件，用户可以像搭积木一样组合出满足特定需求的 Agent。每类组件负责一个维度的能力定义，所有组件在 Agent 创建时被"物化"到工作区中，成为 Agent 的运行时上下文。

**一句话总结**：把技能、提示词、工具、工作流、插件像乐高一样拼装，造出定制化的 Agent。

---

## 五类组件

| 组件类型 | 定义 | 存放位置 | 物化形式 |
|---------|------|---------|---------|
| **Skill** | Agent 应遵循的规则和知识 | `configs/skills/` | Cursor Rules / AGENTS.md 中的规则块 |
| **Prompt** | 系统提示词或指令集 | `configs/prompts/` | 提示词文件 |
| **MCP Server** | 外部工具服务器集成 | `configs/mcp/` | MCP 配置（如 `.cursor/mcp.json`） |
| **Workflow** | 开发流程和工作规范 | `configs/workflows/` | 工作流文档 |
| **Plugin** | 能力扩展（npm 包或本地文件） | `configs/plugins/` | 插件配置 |

所有组件基于 `VersionedComponent` 信封格式，支持：
- 语义化版本号（semver）
- 来源追踪（origin）
- 分类标签（tags）

---

## 使用场景

### 场景 1：组合一个全栈开发 Agent

```json
{
  "domainContext": {
    "skills": ["typescript-expert", "code-review", "react-best-practices"],
    "prompts": ["system-fullstack-dev"],
    "mcpServers": [
      { "name": "filesystem", "command": "npx", "args": ["-y", "@anthropic/mcp-filesystem"] },
      { "name": "github", "command": "npx", "args": ["-y", "@anthropic/mcp-github"] }
    ],
    "workflow": "trellis-standard",
    "plugins": ["memory"]
  }
}
```

### 场景 2：创建一个只读安全审计 Agent

```json
{
  "domainContext": {
    "skills": ["security-review", "owasp-top10"],
    "prompts": ["system-security-auditor"]
  },
  "permissions": { "preset": "readonly" }
}
```

### 场景 3：动态向运行中的 Agent 添加/移除组件

```bash
# 给 Agent 添加一个新技能
actant skill add my-agent ./new-skill.json

# 移除不需要的提示词
actant prompt remove my-agent old-prompt

# 添加 MCP 服务器
actant mcp add my-agent ./my-mcp.json
```

---

## 各组件详解

### Skill（技能）

Skill 定义 Agent 应遵循的规则和专业知识，以 Markdown 格式编写。

**JSON 格式**：

```json
{
  "name": "code-review",
  "version": "1.0.0",
  "description": "代码审查规则和检查清单",
  "content": "## 代码审查检查清单\n\n- 检查错误处理\n- 验证类型安全\n- 审查命名规范\n- 评估性能影响",
  "tags": ["review", "quality"]
}
```

**SKILL.md 格式**（兼容 [Agent Skills](https://skills.sh) 生态）：

```markdown
---
name: code-review
description: Expert code review skill
metadata:
  version: "1.0.0"
  actant-tags: "review,quality"
---

# Code Review

You are an expert code reviewer...
```

### Prompt（提示词）

系统级提示词模板，支持 `{{variable}}` 占位符。

```json
{
  "name": "system-code-reviewer",
  "version": "1.0.0",
  "content": "你是一位专业的代码审查工程师。请仔细审查 {{language}} 项目中的代码变更。",
  "variables": ["language"]
}
```

### MCP Server（工具服务器）

通过 Model Context Protocol 接入外部工具能力。

```json
{
  "name": "filesystem",
  "version": "1.0.0",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
  "env": {}
}
```

### Workflow（工作流）

定义 Agent 的工作流程和标准操作步骤。

```json
{
  "name": "trellis-standard",
  "version": "1.0.0",
  "content": "# 开发工作流\n\n1. 阅读上下文\n2. 规划任务\n3. 编写代码\n4. 运行测试\n5. 记录变更"
}
```

### Plugin（插件）

扩展 Agent 的底层能力（记忆、搜索等）。

```json
{
  "name": "memory",
  "description": "持久化记忆插件，支持跨会话的长期上下文保留",
  "type": "npm",
  "source": "@anthropic/memory",
  "config": { "storage": "local", "maxEntries": 1000 },
  "enabled": true
}
```

---

## 操作方式

五类组件共用相同的 CLI 子命令模式：

```bash
actant <type> list [agent]                 # 列出组件（全局或某实例）
actant <type> show <agent> <name>          # 查看组件详情
actant <type> add <agent> <file>           # 添加组件到实例
actant <type> remove <agent> <name>        # 从实例移除组件
actant <type> export <agent> <name>        # 导出组件为文件
actant <type> import <file>                # 导入组件到全局
actant <type> update <agent> <file>        # 更新实例中的组件
```

其中 `<type>` 为 `skill` / `prompt` / `mcp` / `workflow` / `plugin`。

**示例**：

```bash
# 查看全局所有技能
actant skill list

# 查看某个 Agent 的技能
actant skill list my-agent

# 添加技能到 Agent
actant skill add my-agent ./security-review.json

# 导出某个 Agent 的技能
actant skill export my-agent code-review

# 更新组件
actant prompt update my-agent ./updated-prompt.json
```

---

## 物化过程

当从模板创建 Agent 时，Domain Context 中引用的组件会经历四个阶段：

```
Define（定义）→ Register（注册）→ Resolve（解析）→ Materialize（物化）
```

1. **Define**：JSON 文件定义组件内容
2. **Register**：加载到对应的 Manager（SkillManager、PromptManager 等）
3. **Resolve**：模板中的名称引用被解析为完整的组件定义
4. **Materialize**：BackendBuilder 将组件写入 Agent 工作区的对应文件中

不同后端的物化方式不同：

| 后端 | Skills 物化位置 | Prompts 物化位置 | MCP 物化位置 |
|------|----------------|-----------------|-------------|
| Cursor | `.cursor/rules/*.mdc` | `.cursor/rules/` | `.cursor/mcp.json` |
| Claude Code | `AGENTS.md` | `AGENTS.md` | `~/.claude.json` |
| Custom | 由用户自定义 | 由用户自定义 | 由用户自定义 |

---

## 验证示例

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 查看全局可用的技能
actant skill list
# 预期: 显示 code-review、typescript-expert 等

# 3. 查看技能详情
actant skill show code-review
# 预期: 显示完整的技能内容（content 字段）

# 4. 创建一个 Agent
actant agent create ctx-test -t code-review-agent

# 5. 查看该 Agent 的技能
actant skill list ctx-test
# 预期: 显示 code-review、typescript-expert（从模板继承）

# 6. 编写一个新技能文件 test-skill.json:
# { "name": "my-test-skill", "content": "This is a test skill" }

# 7. 添加技能到 Agent
actant skill add ctx-test ./test-skill.json
# 预期: Skill added

# 8. 确认添加成功
actant skill list ctx-test
# 预期: 列表中多了 my-test-skill

# 9. 移除技能
actant skill remove ctx-test my-test-skill
# 预期: Skill removed

# 10. 清理
actant agent destroy ctx-test --force
actant daemon stop
```

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [Agent 模板系统](agent-template.md) | 模板中通过 `domainContext` 字段引用组件 |
| [组件源与同步](component-source.md) | 从远程仓库获取组件 |
| [可扩展架构](extensible-architecture.md) | 如何添加自定义组件类型 |
