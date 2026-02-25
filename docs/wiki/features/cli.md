---
generated: true
---

<!-- GENERATED -->

# CLI 命令

> 一个 `actant` 命令控制一切。

`actant` CLI 提供 15 个命令组、68 个子命令，覆盖平台全部功能。所有命令支持 `-f json` 输出。

## 命令总表

| 组 | 常用命令 | 说明 |
|----|---------|------|
| **daemon** | `start` `stop` `status` | 守护进程 |
| **template** | `list` `show` `load` `validate` | 模板管理 |
| **agent** | `create` `start` `stop` `destroy` `run` `chat` `list` `status` | Agent 生命周期 + 交互 |
| **skill** | `list` `add` `remove` `show` `export` | 技能组件 |
| **prompt** | （同 skill） | 提示词组件 |
| **mcp** | （同 skill） | MCP 组件 |
| **workflow** | （同 skill） | 工作流组件 |
| **plugin** | （同 skill） | 插件组件 |
| **source** | `list` `add` `remove` `sync` `validate` | 组件源 |
| **preset** | `list` `show` `apply` | 预设 |
| **schedule** | `list` | 调度查看 |
| **proxy** | `<name>` `--lease` | ACP 代理 |
| **session** | `list` `create` `prompt` `cancel` `close` | Session 管理 |
| **self-update** | `--check` `--dry-run` | 自更新 |

## 输出格式

```bash
actant agent list              # 表格（默认，人类友好）
actant agent list -f json      # JSON（脚本解析）
actant agent list -f quiet     # 最小输出（管道）
```

## REPL 模式

不带子命令直接运行 `actant` 进入交互模式：

```
$ actant
actant> template list
actant> agent create test -t code-review-agent
actant> exit
```

## CI 集成

```bash
actant daemon start
RESULT=$(actant agent run ci-bot --prompt "审查代码" -f json)
echo $RESULT | jq '.result'
actant agent destroy ci-bot --force
actant daemon stop
```

退出码：`0` = 成功，非 `0` = 失败。
