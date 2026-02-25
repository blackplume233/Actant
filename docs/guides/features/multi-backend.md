# 功能：多后端支持

> Actant 支持多种 Agent 后端——Claude Code、Cursor、Cursor Agent、Pi、Custom——同一个模板可以切换后端而不改变领域配置。

---

## 这个功能做什么

Agent 后端是 Agent 的"引擎"——决定它如何理解和执行指令。Actant 将后端与领域配置解耦，同一套 Skills + Prompts + MCP 组合可以运行在不同的后端上，适配团队中使用不同开发工具的成员。

**一句话总结**：一套 Agent 配置，多种后端引擎可选。

---

## 支持的后端

| 后端类型 | 说明 | 进程形式 | 适用场景 |
|---------|------|---------|---------|
| `claude-code` | Claude Code CLI | 命令行进程 | 命令行自动化、CI 集成 |
| `cursor` | Cursor IDE | IDE 窗口 | 交互式开发 |
| `cursor-agent` | Cursor Agent 模式 | 后台进程 | Cursor 无头模式 |
| `pi` | Pi 轻量 Agent | 进程内 | 低延迟、本地推理 |
| `custom` | 自定义后端 | 用户定义 | 对接私有 Agent 实现 |

---

## 使用场景

### 场景 1：相同配置，不同后端

同一套代码审查配置分别用于 Claude Code 和 Cursor：

```json
{
  "name": "reviewer-claude",
  "backend": { "type": "claude-code" },
  "domainContext": { "skills": ["code-review"], "prompts": ["system-reviewer"] }
}
```

```json
{
  "name": "reviewer-cursor",
  "backend": { "type": "cursor" },
  "domainContext": { "skills": ["code-review"], "prompts": ["system-reviewer"] }
}
```

### 场景 2：CI/CD 中使用 Claude Code 后端

```bash
# CI 脚本中
actant agent create ci-agent -t code-review-agent
actant agent run ci-agent --prompt "审查本次 PR 的代码变更"
actant agent destroy ci-agent --force
```

### 场景 3：使用 Cursor 后端进行交互式开发

```bash
# 创建 Cursor 后端的 Agent，打开 IDE 窗口
actant agent create dev-helper -t cursor-dev-agent
actant agent start dev-helper
# Cursor 窗口自动打开，工作区指向 Agent workspace
```

---

## 后端配置

在模板中通过 `backend` 字段指定：

```json
{
  "backend": {
    "type": "claude-code",
    "config": {
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

### Claude Code 配置

```json
{
  "backend": {
    "type": "claude-code",
    "config": {
      "model": "claude-sonnet-4-20250514"
    }
  },
  "provider": {
    "type": "anthropic",
    "config": { "apiKeyEnv": "ANTHROPIC_API_KEY" }
  }
}
```

### Cursor 配置

```json
{
  "backend": {
    "type": "cursor",
    "config": {}
  }
}
```

### Custom 配置

```json
{
  "backend": {
    "type": "custom",
    "config": {
      "command": "/path/to/my-agent",
      "args": ["--mode", "interactive"]
    }
  }
}
```

---

## 后端物化差异

不同后端会将领域组件物化到不同的文件位置：

| 组件 | Claude Code | Cursor |
|------|------------|--------|
| Skills | `AGENTS.md` 中的规则块 | `.cursor/rules/*.mdc` |
| Prompts | `AGENTS.md` | `.cursor/rules/` |
| MCP Servers | `~/.claude.json` | `.cursor/mcp.json` |
| Workflow | 工作区根目录 | 工作区根目录 |

这种差异对用户透明——用户只需在模板中指定 `backend.type`，物化过程由对应的 `BackendBuilder` 自动处理。

---

## 验证示例

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 查看当前可用的模板及其后端类型
actant template list
# 预期: 显示每个模板的后端类型

# 3. 查看模板详情，确认后端配置
actant template show code-review-agent
# 预期: backend.type = "claude-code"

# 4. 创建 Agent（使用 claude-code 后端）
actant agent create backend-test -t code-review-agent

# 5. 确认 Agent 状态中的后端信息
actant agent status backend-test -f json
# 预期: JSON 中包含 backend 信息

# 6. 清理
actant agent destroy backend-test --force
actant daemon stop
```

---

## 后端版本管理

从 v0.2.2 开始，后端描述符也被纳入 `VersionedComponent` 体系，支持：

- 通过 `BackendManager` 统一管理
- 从组件源（Hub）分发后端描述符
- 包含版本号和来源追踪
- 启动时自动检测后端可用性（如检查 `claude` 命令是否存在）

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [Agent 模板系统](agent-template.md) | 后端在模板的 `backend` 字段中配置 |
| [领域上下文拼装](domain-context.md) | 同一领域配置可运行在不同后端上 |
| [可扩展架构](extensible-architecture.md) | 每种后端对应不同的 BackendBuilder 实现 |
