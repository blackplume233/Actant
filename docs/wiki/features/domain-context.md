---
generated: true
---

<!-- GENERATED -->

# 领域上下文

> 把技能、提示词、工具、工作流、插件像乐高一样拼装，造出定制化 Agent。

Domain Context 是 Agent 能力的组合容器。同一个后端引擎，搭配不同的组件组合，就变成不同专业的 Agent。

## 五类组件

| 组件 | 做什么 | 例子 |
|------|-------|------|
| **Skill** | 规则和知识 | 代码审查检查清单 |
| **Prompt** | 系统提示词 | "你是一位安全专家…" |
| **MCP Server** | 外部工具 | 文件系统、GitHub API |
| **Workflow** | 工作流程 | TDD 流程、审查流程 |
| **Plugin** | 扩展能力 | 记忆系统、搜索 |

## 在模板中使用

```json
{
  "domainContext": {
    "skills": ["code-review", "typescript-expert"],
    "prompts": ["system-reviewer"],
    "mcpServers": [{ "name": "filesystem", "command": "npx", "args": ["-y", "@anthropic/mcp-filesystem"] }],
    "workflow": "trellis-standard",
    "plugins": ["memory"]
  }
}
```

模板中只写组件名称，具体内容由各管理器解析。创建 Agent 时组件被"物化"到工作区文件中。

## 动态增删

运行中的 Agent 也可以添加或移除组件：

```bash
actant skill add my-agent ./new-skill.json
actant prompt remove my-agent old-prompt
actant mcp add my-agent ./my-mcp.json
```

五类组件共用同一套子命令：`list` / `show` / `add` / `remove` / `export` / `import` / `update`。

## 组件格式示例

::: details Skill
```json
{ "name": "code-review", "content": "## 审查清单\n\n- 错误处理\n- 类型安全\n- 命名规范" }
```
:::

::: details Prompt
```json
{ "name": "system-reviewer", "content": "你是一位代码审查专家。请审查 {{language}} 项目。", "variables": ["language"] }
```
:::

::: details MCP Server
```json
{ "name": "filesystem", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] }
```
:::
