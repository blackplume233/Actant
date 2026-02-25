# 功能：CLI 交互模式

> Actant CLI 是用户与平台交互的主要入口——68 个子命令覆盖模板、Agent、组件、源、调度、代理等全部操作，支持表格、JSON、安静三种输出格式。

---

## 这个功能做什么

`actant` CLI 提供完整的命令行界面，让用户和自动化脚本都能控制 Actant 平台的所有功能。无子命令时进入 REPL 交互模式。

**一句话总结**：一个 `actant` 命令控制一切，人机皆可用。

---

## 命令架构

CLI 共 15 个命令组，68 个子命令：

| 命令组 | 子命令数 | 职责 |
|--------|---------|------|
| `daemon` | 3 | Daemon 守护进程管理 |
| `template` | 5 | 模板管理 |
| `agent` | 15+ | Agent 生命周期 + 交互 |
| `skill` | 7 | Skill 组件管理 |
| `prompt` | 7 | Prompt 组件管理 |
| `mcp` | 7 | MCP Server 组件管理 |
| `workflow` | 7 | Workflow 组件管理 |
| `plugin` | 7 | Plugin 组件管理 |
| `source` | 5 | 组件源管理 |
| `preset` | 3 | 预设管理 |
| `schedule` | 1 | 调度查看 |
| `proxy` | 1 | ACP 代理 |
| `session` | 5 | Session 管理 |
| `self-update` | 1 | 自更新 |
| `help` | 1 | 帮助信息 |

---

## 输出格式

所有命令支持 `-f, --format` 选项：

| 格式 | 说明 | 适用场景 |
|------|------|---------|
| `table` | 人类友好的表格（默认） | 终端交互 |
| `json` | 机器可读的 JSON | 脚本解析、CI/CD |
| `quiet` | 最小输出 | 管道操作 |

```bash
# 表格格式（默认）
actant agent list

# JSON 格式（便于脚本解析）
actant agent list -f json

# 安静模式
actant agent list -f quiet
```

---

## 命令速查

### Daemon 管理

```bash
actant daemon start              # 启动守护进程（必须先启动）
actant daemon start --foreground # 前台模式启动（调试用）
actant daemon stop               # 关闭守护进程
actant daemon status             # 查看 Daemon 状态
```

### 模板管理

```bash
actant template list             # 列出所有已注册模板
actant template show <name>      # 查看模板详情
actant template validate <file>  # 校验模板文件
actant template load <file>      # 加载模板到注册表
actant template install <path>   # 安装模板到 configs 目录
```

### Agent 生命周期

```bash
# 创建
actant agent create <name> -t <template>
actant agent create <name> -t <tpl> --workspace /path
actant agent create <name> -t <tpl> --launch-mode acp-service
actant agent create <name> -t <tpl> --overwrite
actant agent create <name> -t <tpl> --append

# 控制
actant agent start <name>
actant agent stop <name>
actant agent destroy <name> [--force]

# 查询
actant agent status <name>
actant agent list
actant agent logs <name>

# 高级
actant agent adopt <path> [--rename <name>]
actant agent resolve <name>
actant agent attach <name>
actant agent detach <name>
actant agent open <name>
```

### Agent 交互

```bash
actant agent run <name> --prompt "..."           # 执行单次任务
actant agent run <name> --prompt "..." --timeout 60000
actant agent chat <name>                          # 交互式对话
actant agent prompt <name> --prompt "..."         # 发送提示词
actant agent dispatch <name> --prompt "..."       # 调度异步任务
actant agent tasks <name>                         # 查看任务队列
```

### 组件管理（skill/prompt/mcp/workflow/plugin）

```bash
actant <type> list [agent]        # 列出组件
actant <type> show <agent> <name> # 查看详情
actant <type> add <agent> <file>  # 添加组件
actant <type> remove <agent> <name> # 移除组件
actant <type> update <agent> <file> # 更新组件
actant <type> import <file>       # 导入到全局
actant <type> export <agent> <name> # 导出为文件
```

### 组件源

```bash
actant source list                # 列出已注册源
actant source add <name> --github <url>  # 注册 GitHub 源
actant source add <name> --local <path>  # 注册本地源
actant source remove <name>       # 删除源
actant source sync [name]         # 同步源
actant source validate <name>     # 验证源
```

### 预设

```bash
actant preset list [source]       # 列出预设
actant preset show <src>@<name>   # 查看预设
actant preset apply <src>@<name> <template>  # 应用预设
```

### Session 管理

```bash
actant session list [agent]       # 列出 Session
actant session create <agent>     # 创建 Session
actant session prompt <session> "..." # 向 Session 发送消息
actant session cancel <session>   # 取消正在执行的任务
actant session close <session>    # 关闭 Session
```

### 调度与代理

```bash
actant schedule list <agent>      # 查看调度配置
actant proxy <name>               # 启动 ACP 代理（Direct Bridge）
actant proxy <name> --lease       # Session Lease 模式
```

### 其他

```bash
actant help                       # 总帮助
actant help <command>             # 某命令的帮助
actant self-update                # 自更新
actant self-update --check        # 仅检查版本
```

---

## REPL 交互模式

直接运行 `actant`（不带子命令）进入 REPL 交互模式，可以连续执行命令：

```
$ actant
actant> daemon start
Daemon started.
actant> template list
...
actant> agent create test -t code-review-agent
Agent created: test
actant> exit
```

---

## CI/CD 集成

CLI 的 JSON 输出格式和退出码设计适合脚本自动化：

```bash
# 在 CI 脚本中创建 Agent 并运行任务
actant daemon start
actant agent create ci-reviewer -t code-review-agent
RESULT=$(actant agent run ci-reviewer --prompt "审查最近的提交" -f json)
echo $RESULT | jq '.result'
actant agent destroy ci-reviewer --force
actant daemon stop
```

**退出码**：
- `0`：成功
- `非0`：失败（错误信息输出到 stderr）

---

## 验证示例

```bash
# 1. 查看帮助
actant help
# 预期: 显示所有命令组

# 2. 查看子命令帮助
actant help agent
# 预期: 显示 agent 下所有子命令

# 3. 启动 Daemon
actant daemon start
actant daemon status -f json
# 预期: JSON 格式的状态信息

# 4. 列出模板（表格 vs JSON）
actant template list
actant template list -f json
# 预期: 两种格式展示相同内容

# 5. 创建并查询 Agent
actant agent create cli-test -t code-review-agent
actant agent status cli-test -f json
# 预期: JSON 中包含 name, status, template 等字段

# 6. 清理
actant agent destroy cli-test --force
actant daemon stop
```

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [安装与自更新](installation-update.md) | CLI 的安装和升级 |
| [Agent 生命周期管理](agent-lifecycle.md) | `agent` 命令组的完整说明 |
| [ACP 连接与代理](acp-proxy.md) | `proxy` 和 `session` 命令的使用场景 |
