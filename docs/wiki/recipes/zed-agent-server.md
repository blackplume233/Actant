# Zed AgentServer 接入

通过 ACP 协议将 Actant 管理的 Agent 作为 Zed 编辑器的外部 Agent 使用。

## 原理

Zed 原生支持 [Agent Client Protocol (ACP)](https://agentclientprotocol.com/)，可以通过 `settings.json` 中的 `agent_servers` 配置连接任意外部 Agent。Actant 的 `proxy` 命令通过 stdio 暴露标准 ACP 接口，正好对接 Zed 的 Custom Agent 机制。

```
Zed (ACP Client) ──stdio──▶ actant proxy ──▶ Agent Instance
```

## 配置步骤

### 1. 准备 Agent 实例

```bash
# 确保 Daemon 运行
actant daemon start

# 创建 Agent（如果不存在）
actant agent create my-coder -t code-review-agent
```

### 2. 配置 Zed settings.json

在 Zed 中打开 `settings.json`（Command Palette → `zed: open settings`），添加 `agent_servers` 配置：

```json
{
  "agent_servers": {
    "Actant": {
      "type": "custom",
      "command": "actant",
      "args": ["proxy", "my-coder"],
      "env": {}
    }
  }
}
```

如果需要 Session Lease 模式（支持断线恢复）：

```json
{
  "agent_servers": {
    "Actant (Lease)": {
      "type": "custom",
      "command": "actant",
      "args": ["proxy", "my-coder", "--lease"],
      "env": {}
    }
  }
}
```

### 3. 在 Zed 中使用

1. 打开 Agent Panel：`Cmd+?`（macOS）或 `Ctrl+?`（Windows/Linux）
2. 点击右上角 `+` 按钮，创建新 thread
3. 选择 **Actant** 作为 Agent
4. 开始对话，Agent 在 Actant Daemon 管理的 workspace 中工作

## 多 Agent 配置

可以注册多个不同职责的 Agent：

```json
{
  "agent_servers": {
    "Actant Code Review": {
      "type": "custom",
      "command": "actant",
      "args": ["proxy", "reviewer"],
      "env": {}
    },
    "Actant Game Dev": {
      "type": "custom",
      "command": "actant",
      "args": ["proxy", "game-assistant"],
      "env": {}
    }
  }
}
```

在 Agent Panel 的 `+` 菜单中，每个 Agent 会作为独立选项出现。

## 方式对比

| 方式 | Zed 配置 | 特点 |
|------|---------|------|
| `proxy`（Direct Bridge） | `["proxy", "name"]` | 默认模式，每次连接创建 session |
| `proxy --lease`（Session Lease） | `["proxy", "name", "--lease"]` | 支持断线恢复，零冷启动 |
| `agent open` | 不适用 | 前台 TUI 模式，不走 Zed 集成 |

::: tip
`agent open` 会直接在终端启动后端的原生 TUI（如 Claude Code 界面），适合独立调试，不用于 Zed 集成。Zed 集成请使用 `proxy` 模式。
:::

## `agent open`：前台 TUI 模式

如果不需要通过 Zed 集成，只想快速在终端打开 Agent 的原生界面：

```bash
# 前台打开（会启动后端的原生 TUI，如 Claude Code）
actant agent open my-coder

# 自动创建 + 打开（Instance 不存在时从模板创建）
actant agent open my-coder -t code-review-agent
```

- 执行后自动向 Daemon 注册进程（`agent.attach`），退出时自动注销
- 使用 `--no-attach` 可跳过 Daemon 注册，纯前台运行
- 使用 `--auto-install` 可在后端 CLI 缺失时自动安装

## 调试

在 Zed 中可以通过 Command Palette 执行 `dev: open acp logs` 查看 ACP 通信日志，排查连接问题。

## 常见问题

### Zed 找不到 actant 命令

确保 `actant` 在系统 PATH 中。可以在 Zed 配置中使用完整路径：

```json
{
  "agent_servers": {
    "Actant": {
      "type": "custom",
      "command": "/usr/local/bin/actant",
      "args": ["proxy", "my-coder"],
      "env": {}
    }
  }
}
```

### Agent 还不存在

Direct Bridge 模式的 `proxy` 支持 `-t` 参数自动创建实例：

```json
{
  "agent_servers": {
    "Actant": {
      "type": "custom",
      "command": "actant",
      "args": ["proxy", "my-coder", "-t", "code-review-agent"],
      "env": {}
    }
  }
}
```

或手动预先创建：

```bash
actant agent create my-coder -t code-review-agent
```

注意 `--lease` 模式要求 Agent 已经在运行（`actant agent start <name>`），不支持自动创建。

### Daemon 未启动

确保 Actant Daemon 正在运行：

```bash
actant daemon start
```
