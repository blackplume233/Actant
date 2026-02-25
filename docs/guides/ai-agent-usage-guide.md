# Actant 使用手册 — AI Agent 版

> 本文档面向需要**使用** Actant 平台（创建、管理、编排 Agent）的 AI Agent。
> 如果你需要**修改 Actant 源码**，请阅读 [开发手册](ai-agent-dev-guide.md)。

---

## 1. 项目概述

**Actant** 是一个用于构建、管理和编排 AI Agent 的平台。面向游戏开发等复杂业务场景，让用户能够快速拼装、复用合适的 Agent，零成本地将 AI 嵌入工作流。

核心理念借鉴 Docker：

| Docker 概念 | Actant 对应 | 说明 |
|-------------|-------------|------|
| Dockerfile | AgentTemplate | JSON 配置文件定义 Agent 蓝图 |
| Image | 解析后的模板 + 领域组件 | 不可变快照 |
| Container | Agent Instance | 拥有进程和工作区的运行态实例 |
| Docker Daemon | Actant Daemon | 后台守护进程，管理所有实例 |
| docker CLI | `actant` CLI | 用户交互入口 |
| Registry | Component Source | 远程/本地组件仓库 |

**当前版本**: v0.1.2

---

## 2. 安装与环境

### 环境要求

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Agent Backend: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 或 [Cursor](https://cursor.com/)

### 安装

```bash
# Linux / macOS
git clone https://github.com/blackplume233/Actant.git && cd Actant
bash scripts/install.sh

# Windows (PowerShell)
git clone https://github.com/blackplume233/Actant.git; cd Actant
powershell -ExecutionPolicy Bypass -File scripts/install.ps1

# 手动安装
pnpm install && pnpm build && pnpm link --global
```

### 运行时目录

安装后 Actant 在 `~/.actant/` 下维护运行时数据：

```
~/.actant/
├── config.json         # 全局配置
├── configs/            # 领域组件（skills, prompts, templates, ...）
├── instances/          # Agent 实例工作区 + 注册表
├── sources/            # 组件源管理
├── logs/               # Daemon 和更新日志
└── backups/            # 自更新备份
```

### 全局配置

`~/.actant/config.json`：

```json
{
  "devSourcePath": "",
  "update": {
    "maxBackups": 3,
    "preUpdateTestCommand": "pnpm test:changed",
    "autoRestartAgents": true
  }
}
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|-------|------|
| `ACTANT_HOME` | `~/.actant` | Actant 主目录 |
| `ACTANT_SOCKET` | 自动检测 | IPC 路径 |
| `ANTHROPIC_API_KEY` | — | Anthropic API Key |
| `LOG_LEVEL` | `info` | 日志级别 |

---

## 3. 核心概念

### 3.1 AgentTemplate（模板）

Agent 的蓝图文件（JSON），定义一个 Agent 的全部组成：

| 组成部分 | 说明 |
|---------|------|
| `backend` | Agent 后端类型：`cursor` / `claude-code` / `custom` |
| `provider` | 模型提供商：`anthropic` / `openai` / `custom` |
| `domainContext` | 领域上下文 — 引用 Skills、Prompts、MCP Servers、Workflow、Plugins |
| `permissions` | 权限预设（permissive / standard / restricted / readonly）或自定义 |
| `initializer` | 初始化步骤（mkdir, exec, file-copy, git-clone, npm-install） |
| `schedule` | 调度配置（heartbeat / cron / hook） |

模板文件存放在 `configs/templates/` 或由用户自行编写后通过 CLI 加载。

### 3.2 Domain Context（领域上下文）

Agent 的能力由 5 类组件组合而成：

| 组件类型 | 说明 | 存放位置 |
|---------|------|---------|
| **Skill** | 能力描述文件 | `configs/skills/` |
| **Prompt** | 提示词模板 | `configs/prompts/` |
| **MCP Server** | MCP 工具服务器引用 | `configs/mcp/` |
| **Workflow** | 工作流程描述 | `configs/workflows/` |
| **Plugin** | 插件扩展 | `configs/plugins/` |

所有组件都基于 `VersionedComponent` 信封格式，支持版本号、来源追踪、标签。

### 3.3 Agent Instance（实例）

从模板创建的运行态实体：
- 拥有独立的工作区目录
- 通过 `.actant.json` 文件持久化元数据（`AgentInstanceMeta`）
- 生命周期状态见下节

### 3.4 Agent 生命周期

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

可用状态值：`created`, `starting`, `running`, `stopping`, `stopped`, `error`, `crashed`

### 3.5 启动模式

| 模式 | 进程管理方 | 退出行为 | 典型场景 |
|------|-----------|---------|---------|
| `direct` | Daemon | 标记 stopped | 直接打开 IDE/TUI |
| `acp-background` | Daemon + ACP | 标记 stopped | 第三方 Client 通过 ACP 管理 |
| `acp-service` | Daemon + ACP | 自动重启（指数退避） | 持久化雇员 Agent |
| `one-shot` | Daemon | 标记 stopped 或自动销毁 | 执行任务后终止 |

### 3.6 通信架构

```
┌─────────┐  JSON-RPC/IPC  ┌─────────────┐  ACP  ┌───────────────┐
│   CLI   │ ◄────────────► │   Daemon    │ ◄───► │ Agent Process │
└─────────┘                └─────────────┘       └───────────────┘
                                 │
                           管理通道 (RPC)        交互通道 (ACP)
```

- **管理通道**: JSON-RPC 2.0 over IPC（Unix socket / Windows named pipe）
- **交互通道**: ACP (Agent Client Protocol) — Direct Bridge 或 Session Lease
- **IPC 路径**: `~/.actant/actant.sock`（Unix）或 `\\.\pipe\actant-{name}`（Windows）

### 3.7 Employee Scheduler（雇员调度器）

让 Agent 按计划自动执行任务：

| 输入源 | 触发方式 | 配置字段 |
|-------|---------|---------|
| **Heartbeat** | 固定间隔（ms） | `schedule.heartbeat` |
| **Cron** | Cron 表达式 | `schedule.cron[]` |
| **Hook** | 事件名 | `schedule.hooks[]` |

每个输入产生一个带优先级的任务，进入 `TaskQueue`，由 `TaskDispatcher` 按序执行。

### 3.8 Component Source（组件源）

从远程（GitHub）或本地路径同步 Templates、Skills、Prompts 等组件：

- 支持 `PackageManifest` 清单格式
- 同步时生成 `SyncReport`（新增/更新/删除/Breaking Change）
- 支持 `Preset` 预设，可批量应用组件组合到模板

---

## 4. CLI 命令全览

`actant` CLI 共 14 个命令组，61 个子命令。所有命令支持 `-f, --format` 选项（`table` / `json` / `quiet`）。

### 4.1 Daemon 管理

```bash
actant daemon start              # 启动守护进程（必须先启动）
actant daemon start --foreground # 前台模式启动
actant daemon stop               # 关闭守护进程
actant daemon status             # 查看 Daemon 状态
```

### 4.2 模板管理

```bash
actant template list                    # 列出所有已注册模板
actant template show <name>             # 查看模板详情
actant template validate <file>         # 校验模板文件（不加载）
actant template load <file>             # 加载模板到注册表
actant template install <path>          # 安装模板到 configs 目录
```

### 4.3 Agent 生命周期

```bash
# 创建
actant agent create <name> -t <template>           # 基本创建
actant agent create <name> -t <tpl> --work-dir /p  # 指定工作目录
actant agent create <name> -t <tpl> --workspace /p # 指定外部工作区
actant agent create <name> -t <tpl> --launch-mode acp-service  # 指定启动模式
actant agent create <name> -t <tpl> --overwrite    # 覆盖已有实例
actant agent create <name> -t <tpl> --append       # 追加到已有工作区

# 控制
actant agent start <name>              # 启动 Agent
actant agent stop <name>               # 停止 Agent
actant agent destroy <name>            # 销毁 Agent
actant agent destroy <name> --force    # 强制销毁（跳过确认）

# 查询
actant agent status <name>             # 查看实例状态
actant agent list                      # 列出所有实例

# 高级操作
actant agent adopt <path>              # 采纳已有 Actant 工作目录
actant agent resolve <name>            # 解决不一致状态
actant agent attach <name>             # 附着到外部进程
actant agent detach <name>             # 解除附着
```

### 4.4 Agent 交互

```bash
actant agent run <name> --prompt "..."             # 执行单次任务
actant agent run <name> --prompt "..." --model gpt-4 --max-turns 5 --timeout 60000
actant agent prompt <name> --prompt "..."          # 发送提示词
actant agent chat <name>                           # 交互式对话
actant agent dispatch <name> --prompt "..."        # 调度异步任务
actant agent tasks <name>                          # 查看任务队列
actant agent logs <name>                           # 查看进程日志
```

### 4.5 组件管理

五类组件（`skill` / `prompt` / `mcp` / `workflow` / `plugin`）共用相同子命令：

```bash
actant <type> list [agent]                 # 列出组件（全局或某实例）
actant <type> show <agent> <name>          # 查看组件详情
actant <type> add <agent> <file>           # 添加组件到实例
actant <type> remove <agent> <name>        # 从实例移除组件
actant <type> export <agent> <name>        # 导出组件为文件
```

示例：

```bash
actant skill list                          # 列出全局技能
actant skill list my-agent                 # 列出 my-agent 的技能
actant skill add my-agent ./code-review.json
actant prompt show my-agent system-prompt
```

### 4.6 组件源

```bash
actant source list                         # 列出已注册组件源
actant source add <url> --name <name>      # 注册远程源（GitHub/本地）
actant source add <url> --name <n> --type github --branch main
actant source remove <name>                # 删除组件源
actant source sync <name>                  # 同步远程组件（显示 SyncReport）
```

### 4.7 预设

```bash
actant preset list [source]                # 列出可用预设
actant preset show <source>@<preset>       # 查看预设详情
actant preset apply <source>@<preset> <template>  # 应用预设到模板
```

### 4.8 调度

```bash
actant schedule list <agent>               # 查看 Agent 的调度配置
```

### 4.9 ACP 代理

```bash
actant proxy <name>                        # Direct Bridge 模式（默认）
actant proxy <name> --lease                # Session Lease 模式
actant proxy <name> -t <template>          # 指定模板
```

### 4.10 其他

```bash
actant help                                # 总帮助
actant help <command>                      # 某命令的帮助
actant self-update                         # 从源码自更新
actant self-update --check                 # 仅检查版本
actant self-update --dry-run               # 模拟执行
```

无子命令时进入 REPL 交互模式。

---

## 5. 典型使用流程

### 5.1 基本流程：创建并运行 Agent

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 查看可用模板和组件
actant template list
actant skill list

# 3. 从模板创建 Agent
actant agent create my-agent -t code-review-agent

# 4. 向 Agent 发送任务
actant agent run my-agent --prompt "Review the error handling in src/index.ts"

# 5. 或进入交互式对话
actant agent chat my-agent

# 6. 完成后停止并销毁
actant agent stop my-agent
actant agent destroy my-agent --force

# 7. 关闭 Daemon
actant daemon stop
```

### 5.2 组件源管理

```bash
# 注册远程组件源
actant source add https://github.com/user/my-hub --name my-hub

# 同步组件（显示新增/更新/删除/Breaking Change）
actant source sync my-hub

# 查看和应用预设
actant preset list my-hub
actant preset apply my-hub@dev-suite my-template
```

### 5.3 外部工作区管理

```bash
# 在指定外部目录创建 Agent
actant agent create my-agent -t code-review-agent --workspace /path/to/project

# 采纳已有的 Actant 工作目录
actant agent adopt /path/to/existing-workspace

# 查看所有实例
actant agent list
```

### 5.4 雇员模式（自动调度）

创建带调度配置的模板，Agent 将自动按计划执行任务：

```json
{
  "name": "daily-reviewer",
  "version": "1.0.0",
  "backend": { "type": "claude-code" },
  "provider": { "type": "anthropic" },
  "domainContext": { "skills": ["code-review"] },
  "schedule": {
    "heartbeat": { "intervalMs": 3600000, "prompt": "Check for new PRs" },
    "cron": [
      { "pattern": "0 9 * * 1-5", "prompt": "Generate weekly report", "timezone": "Asia/Shanghai" }
    ]
  }
}
```

```bash
actant template load ./daily-reviewer.json
actant agent create reviewer -t daily-reviewer --launch-mode acp-service
actant agent start reviewer
actant schedule list reviewer    # 查看调度状态
```

---

## 6. 配置体系

### 6.1 模板结构（AgentTemplate）

```
AgentTemplate
├── name: string              (必填) 模板名称
├── version: string           (必填) 语义化版本号
├── description: string       模板描述
├── backend                   (必填)
│   ├── type: "cursor" | "claude-code" | "custom"
│   └── config: { ... }      后端特定配置
├── provider                  (必填)
│   ├── type: "anthropic" | "openai" | "custom"
│   └── config: { model?, apiKeyEnv?, ... }
├── domainContext             (必填)
│   ├── skills: string[]      技能名称列表
│   ├── prompts: string[]     提示词名称列表
│   ├── mcpServers: [{ name, command, args?, env? }]
│   ├── workflow: string      工作流名称
│   ├── plugins: string[]     插件名称列表
│   └── subAgents: string[]   子 Agent 名称列表
├── permissions               权限配置
│   ├── preset: "permissive" | "standard" | "restricted" | "readonly"
│   └── (或自定义 tools/fileAccess/networkAccess/sandbox)
├── initializer               初始化流程
│   ├── timeout: number       超时(ms)
│   └── steps: [{ type, ... }]   步骤列表
├── schedule                  调度配置
│   ├── heartbeat: { intervalMs, prompt, priority? }
│   ├── cron: [{ pattern, prompt, timezone?, priority? }]
│   └── hooks: [{ eventName, prompt, priority? }]
├── metadata: { ... }        任意键值元数据
├── tags: string[]            分类标签
└── origin: { source, syncedAt, originalVersion }  来源追踪
```

### 6.2 权限预设

| 预设 | 工具 | 文件访问 | 网络 | 沙箱 |
|------|------|---------|------|------|
| `permissive` | 全部允许 | 全部允许 | 全部允许 | 关闭 |
| `standard` | 白名单 | 工作区内 | 白名单域名 | 关闭 |
| `restricted` | 最小集 | 只读 | 禁止 | 开启 |
| `readonly` | 只读工具 | 只读 | 禁止 | 开启 |

### 6.3 初始化步骤类型

| 类型 | 说明 | 关键参数 |
|------|------|---------|
| `mkdir` | 创建目录 | `path` |
| `exec` | 执行命令 | `command`, `args`, `cwd` |
| `file-copy` | 复制文件 | `src`, `dest` |
| `git-clone` | 克隆仓库 | `url`, `dest`, `branch` |
| `npm-install` | 安装依赖 | `cwd`, `packageManager` |

---

## 7. 数据流图解

### Agent 创建流程

```
actant agent create my-agent -t my-template
  │
  ▼
CLI (RpcClient) ──JSON-RPC──► Daemon (SocketServer)
                                │
                                ▼
                          agent.create handler
                                │
                                ▼
                          AgentManager.create()
                                │
                   ┌────────────┤
                   ▼            ▼
           TemplateRegistry   AgentInitializer
           (解析模板)          │
                              ▼
                        InitializationPipeline
                        (mkdir → file-copy → exec → ...)
                              │
                              ▼
                        WorkspaceBuilder
                        (resolve → validate → scaffold → materialize → inject → verify)
                              │
                              ▼
                        BackendBuilder (Cursor/ClaudeCode/Custom)
                        (生成 .cursor/rules, AGENTS.md, prompts 等)
                              │
                              ▼
                        写入 .actant.json → InstanceRegistry.register()
                              │
                              ▼
                        返回创建结果 → CLI 输出
```

### Agent 运行流程

```
actant agent run my-agent --prompt "..."
  │
  ▼
CLI ──JSON-RPC──► Daemon
                    │
                    ▼
              AgentManager.runPrompt()
                    │
                    ▼
              AgentCommunicator (Cursor/ClaudeCode/ACP)
                    │
                    ▼
              Agent 进程执行 prompt
                    │
                    ▼
              PromptResult → CLI 流式输出
```

---

## 8. 内置配置资源

仓库自带的配置资源位于 `configs/` 目录：

| 目录 | 说明 |
|------|------|
| `configs/templates/` | 预定义 Agent 模板 |
| `configs/skills/` | 内置技能定义 |
| `configs/prompts/` | 内置提示词 |
| `configs/workflows/` | 内置工作流 |
| `configs/plugins/` | 内置插件 |
| `configs/mcp/` | 内置 MCP 服务器配置 |

使用 `actant template list`、`actant skill list` 等命令查看可用资源。

---

## 9. 自更新

```bash
actant self-update              # 从源码拉取更新并重新构建
actant self-update --check      # 仅检查是否有新版本
actant self-update --dry-run    # 模拟执行（不实际更新）
actant self-update --force      # 强制更新（忽略版本检查）
```

---

## 10. 快速参考卡片

```
┌──────────────────── Actant 使用速查 ────────────────────┐
│                                                          │
│  启动: actant daemon start                               │
│  建模: configs/templates/*.json → actant template load   │
│  创建: actant agent create <name> -t <template>          │
│  运行: actant agent run <name> --prompt "..."            │
│  对话: actant agent chat <name>                          │
│  状态: actant agent status <name>                        │
│  停止: actant agent stop <name>                          │
│  销毁: actant agent destroy <name> --force               │
│                                                          │
│  组件: actant skill/prompt/mcp/workflow/plugin list      │
│  源:   actant source add <url> --name <n>                │
│  同步: actant source sync <name>                         │
│  预设: actant preset apply <src>@<preset> <tpl>          │
│  帮助: actant help <command>                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 延伸阅读

| 文档 | 说明 |
|------|------|
| [开发手册](ai-agent-dev-guide.md) | 修改 Actant 源码的完整指南 |
| [入门指南](getting-started.md) | 面向人类的快速入门 |
| [API 接口](../stage/v0.1.2/api-surface.md) | 74 个 RPC 方法 + 全部 CLI 命令 |
| [配置 Schema](../stage/v0.1.2/config-schemas.md) | Zod Schema + TypeScript 接口详情 |
| [架构文档](../stage/v0.1.2/architecture.md) | 完整系统架构 |
