---
generated: true
---

<!-- GENERATED -->

# Agent 生命周期

> 像管理容器一样管理 Agent——创建、启动、运行、停止、销毁。

## 状态流转

```
(none) ──create──▶ created ──start──▶ running ──stop──▶ stopped ──destroy──▶ (none)
                                         │
                                     error/crash ──(acp-service 自动重启)
```

## 四种启动模式

| 模式 | 进程管理 | 退出行为 | 场景 |
|------|---------|---------|------|
| `direct` | Daemon | 标记停止 | 打开 IDE 窗口 |
| `acp-background` | Daemon + ACP | 标记停止 | 第三方 ACP 客户端 |
| `acp-service` | Daemon + ACP | 崩溃自动重启 | 7×24 雇员 Agent |
| `one-shot` | Daemon | 完成后销毁 | 一次性任务 |

## 典型场景

**临时使用** — 创建 → 执行任务 → 销毁。

```bash
actant agent create tmp -t code-review-agent
actant agent run tmp --prompt "审查 src/"
actant agent destroy tmp --force
```

**指向已有项目** — 让 Agent 在你的项目目录工作。

```bash
actant agent create helper -t code-review-agent --workspace /path/to/project
```

**长驻服务** — 崩溃自动重启。

```bash
actant agent create bot -t pr-reviewer --launch-mode acp-service
actant agent start bot
```

## 常用命令

```bash
actant agent create <name> -t <template>    # 创建
actant agent start / stop / destroy <name>  # 控制
actant agent status <name>                  # 查看状态
actant agent list                           # 列出全部
actant agent run <name> --prompt "..."      # 执行任务
actant agent chat <name>                    # 交互对话
actant agent adopt <path>                   # 采纳已有工作区
```
