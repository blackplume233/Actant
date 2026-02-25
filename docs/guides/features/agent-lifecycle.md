# 功能：Agent 生命周期管理

> Actant 对 Agent 实例的完整生命周期进行管理——从创建、启动、运行、停止到销毁，类似 Docker 对容器的管控。

---

## 这个功能做什么

Agent 生命周期管理是 Actant 的核心运行时能力。每个 Agent 实例都拥有独立的工作区目录、元数据文件和进程状态，由 Daemon 统一管控。

**一句话总结**：像管理 Docker 容器一样管理 AI Agent 的创建、运行和销毁。

---

## 状态机

Agent 实例遵循以下状态转换：

```
         create              start              stop
(none) ─────────► created ─────────► running ─────────► stopped
                     │                  │                   │
                     │                  │   error           │
                     │                  └──────► error      │
                     │                  │                   │
                     │              crash (acp-service)     │
                     │                  └── restart ──┘     │
                     │                                      │
                     └──────────── destroy ◄────────────────┘
```

可用状态值：`created` → `starting` → `running` → `stopping` → `stopped` → `error` → `crashed`

---

## 启动模式

不同的启动模式决定 Agent 进程由谁管理、何时退出：

| 模式 | 进程管理方 | 退出行为 | 典型场景 |
|------|-----------|---------|---------|
| `direct` | Daemon | 标记 stopped | 直接打开 IDE（如 Cursor 窗口） |
| `acp-background` | Daemon + ACP | 标记 stopped | 第三方 Client 通过 ACP 管理 |
| `acp-service` | Daemon + ACP | 崩溃后自动重启（指数退避） | 持久化雇员 Agent |
| `one-shot` | Daemon | 完成后自动停止/销毁 | 一次性任务 |

---

## 使用场景

### 场景 1：基本的创建-使用-销毁流程

最常见的使用模式，创建一个临时 Agent 执行任务后销毁。

```bash
# 创建
actant agent create my-reviewer -t code-review-agent

# 查看状态（此时为 created）
actant agent status my-reviewer

# 发送任务
actant agent run my-reviewer --prompt "审查 src/index.ts 的错误处理"

# 或进入交互式对话
actant agent chat my-reviewer

# 使用完毕后停止并销毁
actant agent stop my-reviewer
actant agent destroy my-reviewer --force
```

### 场景 2：在已有项目目录中创建 Agent

将 Agent 指向一个已存在的项目目录，让它在该项目上下文中工作。

```bash
# 在指定外部工作区创建 Agent
actant agent create project-helper -t code-review-agent --workspace /path/to/my-project

# Agent 会在 /path/to/my-project 中工作，能看到项目文件
actant agent run project-helper --prompt "分析这个项目的架构"
```

### 场景 3：采纳已有的 Actant 工作目录

如果一个目录中已经存在 `.actant.json` 文件（比如手动配置的或从其他机器拷贝的），可以直接采纳。

```bash
actant agent adopt /path/to/existing-workspace --rename my-adopted-agent
actant agent list  # 应该能看到 my-adopted-agent
```

### 场景 4：长驻服务型 Agent

创建一个 7x24 运行的 Agent，崩溃后自动重启。

```bash
actant agent create pr-bot -t daily-pr-reviewer --launch-mode acp-service
actant agent start pr-bot
# Agent 持续运行，崩溃后自动重启
# 查看状态
actant agent status pr-bot
```

### 场景 5：管理多个 Agent 实例

```bash
# 查看所有活跃实例
actant agent list

# 批量查看状态（JSON 格式便于脚本解析）
actant agent list -f json
```

---

## 操作方式

### 创建

```bash
actant agent create <name> -t <template>                  # 基本创建
actant agent create <name> -t <template> --workspace /p    # 指定外部工作区
actant agent create <name> -t <template> --launch-mode acp-service  # 指定启动模式
actant agent create <name> -t <template> --overwrite       # 覆盖已有同名实例
actant agent create <name> -t <template> --append          # 追加到已有工作区
```

### 控制

```bash
actant agent start <name>           # 启动 Agent
actant agent stop <name>            # 停止 Agent
actant agent destroy <name>         # 销毁 Agent（需确认）
actant agent destroy <name> --force # 强制销毁（跳过确认）
```

### 查询

```bash
actant agent status <name>          # 查看实例状态
actant agent list                   # 列出所有实例
actant agent logs <name>            # 查看进程日志
```

### 交互

```bash
actant agent run <name> --prompt "..."              # 执行单次任务
actant agent run <name> --prompt "..." --timeout 60000  # 带超时
actant agent chat <name>                             # 交互式对话
actant agent prompt <name> --prompt "..."            # 发送提示词
actant agent dispatch <name> --prompt "..."          # 调度异步任务
actant agent tasks <name>                            # 查看任务队列
```

### 高级操作

```bash
actant agent adopt <path>           # 采纳已有工作目录
actant agent adopt <path> --rename <name>  # 采纳并重命名
actant agent resolve <name>         # 解决不一致状态
actant agent attach <name>          # 附着到外部进程
actant agent detach <name>          # 解除附着
```

---

## 工作区结构

每个 Agent 实例在创建时会生成一个独立的工作区目录：

```
<workspace>/
├── .actant.json          # 实例元数据（名称、模板、状态、创建时间等）
├── .cursor/              # Cursor 后端配置（如使用 Cursor）
│   └── rules/            # Cursor Rules 文件
├── AGENTS.md             # Claude Code 后端配置（如使用 Claude Code）
├── skills/               # 物化后的技能文件
├── prompts/              # 物化后的提示词文件
└── ...                   # 初始化步骤创建的其他内容
```

---

## 验证示例

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 创建 Agent
actant agent create lifecycle-test -t code-review-agent
# 预期: Agent created: lifecycle-test

# 3. 检查状态
actant agent status lifecycle-test
# 预期: status = "created"

# 4. 列出所有实例
actant agent list
# 预期: 列表中包含 lifecycle-test

# 5. 执行一个任务
actant agent run lifecycle-test --prompt "说 hello"
# 预期: 返回 Agent 的回复

# 6. 停止
actant agent stop lifecycle-test
# 预期: status = "stopped"

# 7. 尝试对已停止的 Agent 执行任务
actant agent run lifecycle-test --prompt "hello"
# 预期: 报错提示 Agent 未运行

# 8. 销毁
actant agent destroy lifecycle-test --force
# 预期: Agent destroyed

# 9. 确认已销毁
actant agent list
# 预期: lifecycle-test 不在列表中

# 10. 清理
actant daemon stop
```

---

## 实例注册表

Actant 使用 InstanceRegistry 集中管理所有 Agent 实例的元数据。注册表维护在 `~/.actant/instances/` 目录下，提供以下能力：

- **注册/注销**：创建或销毁时自动维护
- **采纳（adopt）**：将已有的 `.actant.json` 工作区纳入管理
- **状态协调（reconcile）**：发现并修复孤立实例（如进程崩溃但元数据残留）
- **resolve**：检查实例状态一致性

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [Agent 模板系统](agent-template.md) | 实例从模板创建 |
| [ACP 连接与代理](acp-proxy.md) | 不同启动模式对应不同的连接方式 |
| [雇员调度器](employee-scheduler.md) | acp-service 模式下的自动任务调度 |
| [CLI 交互模式](cli-interaction.md) | 命令行操作的完整参考 |
