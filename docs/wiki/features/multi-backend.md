---
generated: true
---

<!-- GENERATED -->

# 多后端支持

> 一套 Agent 配置，多种引擎可选。

后端是 Agent 的"引擎"。Actant 将后端与领域配置解耦，切换引擎不需要改 Skills 或 Prompts。

## 支持的后端

| 后端 | 进程形式 | 场景 |
|------|---------|------|
| `claude-code` | CLI 进程 | 自动化、CI |
| `cursor` | IDE 窗口 | 交互式开发 |
| `cursor-agent` | 后台进程 | Cursor 无头模式 |
| `pi` | 进程内 | 低延迟本地推理 |
| `custom` | 自定义 | 对接私有实现 |

## 配置方式

在模板的 `backend` 字段指定：

```json
{ "backend": { "type": "claude-code", "config": { "model": "claude-sonnet-4-20250514" } } }
```

## 物化差异

同一个 Skill 在不同后端被写入不同位置，对用户透明：

| 组件 | Claude Code | Cursor |
|------|------------|--------|
| Skills | `AGENTS.md` | `.cursor/rules/*.mdc` |
| MCP | `~/.claude.json` | `.cursor/mcp.json` |
