---
generated: true
---

<!-- GENERATED -->

# Agent 模板

> 写一个 JSON 文件，就能定义一个可重复创建的 Agent 类型。

Agent Template 类似 Dockerfile——声明式地描述 Agent 的后端、能力、权限和调度。团队可以共享模板，确保所有人使用相同标准的 Agent。

## 模板长什么样

```json
{
  "name": "code-review-agent",
  "version": "1.0.0",
  "backend": { "type": "claude-code" },
  "domainContext": {
    "skills": ["code-review", "typescript-expert"],
    "prompts": ["system-code-reviewer"],
    "mcpServers": [{ "name": "filesystem", "command": "npx", "args": ["-y", "@anthropic/mcp-filesystem"] }],
    "workflow": "trellis-standard"
  },
  "permissions": { "preset": "standard" }
}
```

主要字段：**backend**（后端引擎）、**domainContext**（能力组合）、**permissions**（安全边界）、**schedule**（定时任务）。

## 典型场景

**统一团队审查标准** — 将代码审查的 Skills、Prompts 打包为模板，所有人 `agent create -t team-reviewer` 即可使用。

**定时 PR 巡检** — 在模板中加 `schedule.cron`，Agent 每天 9 点自动检查新 PR。

**最小 Agent** — 只写 `{ "name": "x", "version": "1.0.0", "backend": { "type": "claude-code" } }` 就够了。

## 常用命令

```bash
actant template list                    # 查看可用模板
actant template show <name>             # 查看详情
actant template load ./my-template.json # 加载模板
actant template validate ./t.json       # 校验（不加载）
actant agent create my-agent -t <name>  # 从模板创建
```
