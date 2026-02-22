# AgentCraft v0.1.0 架构文档

> **版本**: 0.1.0 &nbsp;|&nbsp; **日期**: 2026-02-22 &nbsp;|&nbsp; **阶段**: Phase 3 收尾  
> 本文档是当前版本的架构总结，涵盖模块划分、核心设计、依赖关系与全部 CLI 命令。

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [Monorepo 结构](#3-monorepo-结构)
4. [包依赖关系](#4-包依赖关系)
5. [模块架构详解](#5-模块架构详解)
   - 5.1 [@agentcraft/shared](#51-agentcraftshared--共享层)
   - 5.2 [@agentcraft/core](#52-agentcraftcore--核心层)
   - 5.3 [@agentcraft/api](#53-agentcraftapi--服务层)
   - 5.4 [@agentcraft/acp](#54-agentcraftacp--协议层)
   - 5.5 [@agentcraft/cli](#55-agentcraftcli--交互层)
   - 5.6 [@agentcraft/mcp-server](#56-agentcraftmcp-server--mcp-服务)
6. [核心数据流](#6-核心数据流)
7. [Agent 生命周期](#7-agent-生命周期)
8. [CLI 命令全览](#8-cli-命令全览)
9. [配置体系](#9-配置体系)
10. [内置配置资源](#10-内置配置资源)
11. [当前版本状态总结](#11-当前版本状态总结)

---

## 1. 项目概览

AgentCraft 是一个用于 **构建、管理和编排 AI Agent** 的平台。它借鉴了 Docker 的核心理念：

| Docker 概念 | AgentCraft 对应 |
|-------------|----------------|
| Dockerfile | AgentTemplate（模板） |
| Image | 解析后的模板 + 领域组件 |
| Container | Agent 实例（有进程、有工作区） |
| Docker Daemon | AgentCraft Daemon（后台守护进程） |
| docker CLI | `agentcraft` CLI |
| Registry | Component Source（组件源） |

**核心流程**：`Template → Create（组装工作区）→ Start（启动进程）→ Chat/Run（交互）→ Stop → Destroy`

---

## 2. 技术栈

| 类别 | 选型 |
|------|------|
| 语言 | TypeScript 5.9+, ES2022 target |
| 运行时 | Node.js ≥ 22.0.0 |
| 包管理 | pnpm 9+ (Monorepo) |
| 构建 | tsup |
| 测试 | Vitest 4 |
| Schema 校验 | Zod |
| 日志 | pino |
| CLI 框架 | Commander.js v14 |
| 定时任务 | croner |
| ACP 协议 | @agentclientprotocol/sdk |
| 代码规范 | ESLint + TypeScript-ESLint |

---

## 3. Monorepo 结构

```
AgentCraft/
├── packages/                   # 源码（pnpm workspace）
│   ├── shared/                 # @agentcraft/shared — 类型、错误、日志、平台
│   ├── core/                   # @agentcraft/core — 核心业务逻辑
│   ├── api/                    # @agentcraft/api — Daemon 与 RPC 处理器
│   ├── acp/                    # @agentcraft/acp — ACP 协议集成
│   ├── cli/                    # @agentcraft/cli — CLI 与 REPL
│   └── mcp-server/             # @agentcraft/mcp-server — MCP 服务器
├── configs/                    # 内置配置（技能、提示词、MCP、模板、工作流、插件）
├── docs/                       # 项目文档
│   ├── decisions/              # ADR（架构决策记录）
│   └── design/                 # 设计文档
├── .trellis/                   # Trellis AI 开发框架
│   ├── spec/                   # 规格文档
│   ├── issues/                 # 问题追踪（JSON）
│   └── roadmap.md              # 产品路线图
├── tsconfig.base.json          # 共享 TS 配置
├── vitest.config.ts            # 测试配置
└── pnpm-workspace.yaml         # Workspace 声明
```

---

## 4. 包依赖关系

```
                    ┌──────────────────────────┐
                    │    @agentcraft/shared     │
                    │  类型 · 错误 · 日志 · 平台  │
                    └─────────┬────────────────┘
                              │
                    ┌─────────▼────────────────┐
                    │     @agentcraft/core      │
                    │ 模板 · 构建器 · 调度器 · 管理器 │
                    └──┬──────┬──────┬──────┬──┘
                       │      │      │      │
            ┌──────────▼┐  ┌──▼──────▼┐  ┌──▼──────────┐
            │  @agentcraft│  │ @agentcraft│  │ @agentcraft  │
            │    /acp    │  │   /api   │  │ /mcp-server │
            │  ACP 协议   │  │ Daemon/RPC│  │  MCP 服务   │
            └──────┬─────┘  └────┬─────┘  └─────────────┘
                   │             │
            ┌──────▼─────────────▼─────┐
            │     @agentcraft/cli      │
            │     CLI · REPL · 输出     │
            └──────────────────────────┘
```

**依赖规则**：`cli` → `api`, `acp`, `core`, `shared`；`api` → `acp`, `core`, `shared`；`acp` → `core`, `shared`；`core` → `shared`。横向包之间不互相依赖。

---

## 5. 模块架构详解

### 5.1 @agentcraft/shared — 共享层

为所有包提供基础类型定义、错误体系、日志和平台抽象。

```
shared/src/
├── types/
│   ├── agent.types.ts           # AgentInstanceMeta, AgentStatus, LaunchMode, WorkspacePolicy
│   ├── template.types.ts        # AgentTemplate, AgentBackendConfig, ModelProviderConfig
│   ├── domain-context.types.ts  # DomainContextConfig, McpServerRef
│   ├── domain-component.types.ts# SkillDefinition, PromptDefinition, PluginDefinition ...
│   ├── source.types.ts          # SourceConfig, PackageManifest, PresetDefinition
│   └── rpc.types.ts             # JSON-RPC 类型, RpcMethodMap（所有 RPC 方法签名）
├── errors/
│   ├── base-error.ts            # AgentCraftError 基类
│   ├── config-errors.ts         # 配置相关错误
│   └── lifecycle-errors.ts      # 生命周期相关错误
├── logger/
│   └── logger.ts                # 基于 pino 的结构化日志
└── platform/
    └── platform.ts              # 跨平台抽象（IPC 路径、信号处理）
```

**关键类型**：

| 类型 | 说明 |
|------|------|
| `AgentTemplate` | Agent 定义模板，包含 backend、provider、domainContext、schedule |
| `AgentInstanceMeta` | Agent 实例元数据：状态、启动模式、工作区策略 |
| `LaunchMode` | `direct` / `acp-background` / `acp-service` / `one-shot` |
| `WorkspacePolicy` | `persistent` / `ephemeral` |
| `AgentStatus` | `created` / `running` / `stopped` / `error` |
| `DomainContextConfig` | 领域上下文：skills、prompts、mcpServers、workflow、plugins |
| `RpcMethodMap` | 所有 JSON-RPC 方法的参数与返回值类型映射 |

---

### 5.2 @agentcraft/core — 核心层

承载全部业务逻辑，分为 10 个子模块：

```
core/src/
├── template/       # 模板系统
├── domain/         # 领域组件管理器
├── builder/        # 工作区构建器
├── initializer/    # Agent 初始化
├── manager/        # Agent 生命周期管理
├── communicator/   # Agent 通信
├── scheduler/      # 任务调度器
├── source/         # 组件源管理
├── session/        # 会话注册
└── state/          # 实例状态持久化
```

#### 5.2.1 Template — 模板系统

| 组件 | 职责 |
|------|------|
| `TemplateRegistry` | 模板的内存注册表，支持注册/查询/卸载 |
| `TemplateLoader` | 从 JSON 文件加载模板，使用 Zod Schema 校验 |
| `AgentTemplateSchema` | Zod 校验 Schema，定义模板结构 |

#### 5.2.2 Domain — 领域组件管理器

统一的 CRUD 组件管理体系，全部继承自 `BaseComponentManager<T>`：

| 管理器 | 管理对象 | 持久化目录 |
|--------|----------|-----------|
| `SkillManager` | 技能定义 (SkillDefinition) | `skills/` |
| `PromptManager` | 提示词定义 (PromptDefinition) | `prompts/` |
| `McpConfigManager` | MCP 服务配置 (McpServerDefinition) | `mcp/` |
| `WorkflowManager` | 工作流定义 (WorkflowDefinition) | `workflows/` |
| `PluginManager` | 插件定义 (PluginDefinition) | `plugins/` |

**BaseComponentManager 能力**：`add` / `get` / `list` / `update` / `remove` / `importFromFile` / `exportToFile` / `loadFromDirectory` / `persist`

#### 5.2.3 Builder — 工作区构建器

六步构建流水线：**Resolve → Validate → Scaffold → Materialize → Inject → Verify**

```
                     WorkspaceBuilder（编排器）
                    ┌──────────────────────────┐
                    │  1. resolve（解析组件引用）  │
                    │  2. validate（校验完整性）   │
                    │  3. scaffold（搭建目录结构） │
      DomainManagers│  4. materialize（物化配置） │BackendBuilder
     ──────────────►│  5. inject（注入权限/上下文）│◄──────────────
                    │  6. verify（验证构建产物）   │
                    └──────────────────────────┘
```

| 构建器 | 目标后端 | 说明 |
|--------|---------|------|
| `CursorBuilder` | Cursor IDE | 生成 `.cursor/` 配置 |
| `ClaudeCodeBuilder` | Claude Code | 生成 `.claude/` 配置 |
| `CustomBuilder` | 自定义后端 | 继承 CursorBuilder，支持扩展 |

#### 5.2.4 Initializer — 初始化器

| 组件 | 职责 |
|------|------|
| `AgentInitializer` | 编排 Agent 创建流程：`createInstance` → `WorkspaceBuilder` |
| `ContextMaterializer` | （已废弃）旧版上下文物化逻辑 |

#### 5.2.5 Manager — 生命周期管理器

```
AgentManager
├── AgentInitializer       # 创建 Agent 实例
├── AgentLauncher          # 启动 Agent 进程
│   ├── ProcessLauncher    # 子进程管理
│   └── MockLauncher       # 测试用 Mock
├── ProcessWatcher         # 进程监控（PID 存活检测）
├── LaunchModeHandler      # 启动模式策略
├── RestartTracker         # ACP 模式重启策略
└── BackendResolver        # 后端类型解析
```

**AgentManager 核心 API**：`create` / `start` / `stop` / `destroy` / `status` / `list` / `resolve` / `attach` / `detach`

#### 5.2.6 Communicator — 通信器

| 组件 | 说明 |
|------|------|
| `AgentCommunicator` | 通信抽象接口：`prompt()`, `streamPrompt()` |
| `CursorCommunicator` | Cursor 后端通信实现 |
| `ClaudeCodeCommunicator` | Claude Code 后端通信实现 |
| `createCommunicator()` | 工厂函数，按 backend 类型创建通信器 |

#### 5.2.7 Scheduler — 任务调度器

```
InputSource(s)           TaskQueue            TaskDispatcher
  ┌──────────┐      ┌───────────────┐      ┌───────────────┐
  │Heartbeat │─┐    │               │      │               │
  │CronInput │─┼──► │  InputRouter  │─────►│  优先级队列    │─────► PromptAgentFn
  │HookInput │─┘    │ （路由/合并）   │      │ （轮询分发）    │      （执行 Agent）
  └──────────┘      └───────────────┘      └───────────────┘
                                                    │
                                           ┌────────▼────────┐
                                           │  ExecutionLog    │
                                           │ （执行记录持久化） │
                                           └─────────────────┘
```

| 组件 | 职责 |
|------|------|
| `EmployeeScheduler` | 顶层编排器，串联 Queue + Dispatcher + Router |
| `TaskQueue` | 按 Agent 分区的优先级任务队列 |
| `TaskDispatcher` | 轮询队列、分发任务至 Agent |
| `InputRouter` | 注册 InputSource，将任务路由至队列 |
| `HeartbeatInput` | 心跳输入源（固定间隔） |
| `CronInput` | Cron 表达式输入源 |
| `HookInput` | 事件驱动输入源（EventEmitter） |
| `ExecutionLog` | 任务执行记录 |

#### 5.2.8 Source — 组件源管理

| 组件 | 职责 |
|------|------|
| `SourceManager` | 注册/移除/同步组件源 |
| `GitHubSource` | GitHub 远程组件源 |
| `LocalSource` | 本地文件系统组件源 |

组件源同步后，以 `package@name` 命名空间注入到各 Domain Manager 中。

#### 5.2.9 Session — 会话管理

| 组件 | 职责 |
|------|------|
| `SessionRegistry` | 管理 ACP 会话租约（创建/关闭/列表） |

#### 5.2.10 State — 状态持久化

| 组件 | 职责 |
|------|------|
| `InstanceMetaSchema` | Zod Schema，定义实例元数据结构 |
| `InstanceMetaIO` | `read` / `write` / `update` / `scan` 实例元数据 |

---

### 5.3 @agentcraft/api — 服务层

Daemon 进程及 JSON-RPC 请求处理。

```
api/src/
├── daemon/
│   ├── daemon.ts              # Daemon 主类（启动/停止/处理器注册）
│   ├── socket-server.ts       # Unix Socket / Named Pipe JSON-RPC 服务
│   ├── pid-file.ts            # PID 文件管理
│   └── acp-relay-server.ts    # ACP 中继服务器
└── handlers/
    ├── handler-registry.ts    # 处理器注册表
    ├── agent-handlers.ts      # agent.* RPC 方法
    ├── template-handlers.ts   # template.* RPC 方法
    ├── domain-handlers.ts     # skill/prompt/mcp/workflow/plugin.* RPC 方法
    ├── source-handlers.ts     # source.* RPC 方法
    ├── preset-handlers.ts     # preset.* RPC 方法
    ├── schedule-handlers.ts   # schedule.* / agent.dispatch/tasks/logs RPC 方法
    ├── session-handlers.ts    # session.* RPC 方法
    ├── proxy-handlers.ts      # proxy.* RPC 方法
    └── daemon-handlers.ts     # daemon.ping / daemon.shutdown
```

**AppContext** 是服务层的依赖注入容器，组装以下核心服务：
- TemplateRegistry + TemplateLoader
- 五大 Domain Manager（Skill / Prompt / Mcp / Workflow / Plugin）
- SourceManager
- AgentInitializer（注入 Domain Managers）
- AcpConnectionManager
- AgentManager
- SessionRegistry
- Schedulers Map

---

### 5.4 @agentcraft/acp — 协议层

ACP（Agent Client Protocol）集成，支持 Agent 与外部系统的双向通信。

```
acp/src/
├── connection.ts          # ACP 连接封装
├── connection-manager.ts  # 连接生命周期管理
├── communicator.ts        # ACP 通信器（实现 AgentCommunicator 接口）
├── gateway.ts             # ACP 网关
├── terminal-manager.ts    # 终端管理
└── callback-router.ts     # 回调路由
```

**两种 ACP 模式**：
- **Direct Bridge**（默认）：CLI 直接通过 stdin/stdout 与 Agent 进程通信
- **Session Lease**（`--lease`）：Daemon 持有 Agent 进程，客户端按需租借会话

---

### 5.5 @agentcraft/cli — 交互层

```
cli/src/
├── bin/agentcraft.ts      # 入口文件（#!/usr/bin/env node）
├── program.ts             # Commander 主程序（注册所有命令组）
├── daemon-entry.ts        # Daemon 入口
├── client/
│   └── rpc-client.ts      # JSON-RPC 客户端（与 Daemon 通信）
├── output/
│   ├── printer.ts         # 输出控制器
│   ├── formatter.ts       # 格式化（table / json / quiet）
│   ├── error-presenter.ts # 错误展示
│   └── stream-renderer.ts # 流式输出渲染
├── repl/
│   └── repl.ts            # REPL 交互（无子命令时启动）
└── commands/              # 12 个命令组（详见第 8 节）
```

---

### 5.6 @agentcraft/mcp-server — MCP 服务

MCP（Model Context Protocol）服务器，允许其他 Agent 通过 MCP 工具调用 AgentCraft 管理的 Agent。

> 当前处于基础骨架阶段，仅包含入口文件。

---

## 6. 核心数据流

### 6.1 Agent 创建流程

```
CLI: agentcraft agent create myagent -t code-review
  │
  ▼
RPC Client ──► Daemon (socket) ──► agent-handlers.ts
  │                                       │
  │                              AgentManager.create()
  │                                       │
  │                              AgentInitializer.createInstance()
  │                                       │
  │                    ┌──────────────────┼──────────────────┐
  │                    ▼                  ▼                  ▼
  │             TemplateRegistry   DomainManagers      WorkspaceBuilder
  │             （查找模板）        （解析组件）        （构建工作区）
  │                                                         │
  │                                              BackendBuilder.scaffold()
  │                                              BackendBuilder.materialize()
  │                                              BackendBuilder.verify()
  │                                                         │
  ▼                                                         ▼
CLI Output ◄── RPC Response ◄── AgentInstanceMeta（已持久化）
```

### 6.2 Agent 交互流程

```
CLI: agentcraft agent run myagent --prompt "Review this code"
  │
  ▼
RPC Client ──► Daemon ──► agent-handlers (agent.run)
                                │
                     AgentManager.ensureRunning()
                                │
                     Communicator.prompt(message)
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             CursorCommunicator    ClaudeCodeCommunicator
              (Cursor IDE)           (Claude Code)
                    │                       │
                    ▼                       ▼
               Agent Process ◄──────► AI Backend
```

---

## 7. Agent 生命周期

### 7.1 状态转换

```
          create              start              stop
(none) ──────────► created ──────────► running ──────────► stopped
                      │                   │                   │
                      │                   │   error           │
                      │                   └──────► error      │
                      │                                       │
                      └──────────── destroy ◄─────────────────┘
```

### 7.2 启动模式

| 模式 | 描述 | 进程归属 |
|------|------|---------|
| `direct` | Daemon 管理完整生命周期 | Managed |
| `acp-background` | ACP 后台模式，Daemon 管理 | Managed |
| `acp-service` | ACP 服务模式，带重启策略 | Managed |
| `one-shot` | 单次执行后退出 | Managed |
| External Spawn | 外部启动，通过 `attach` 注册 | External |

### 7.3 工作区策略

| 策略 | 描述 |
|------|------|
| `persistent` | 工作区在 Agent 生命周期间保留 |
| `ephemeral` | 每次启动重新创建工作区 |

---

## 8. CLI 命令全览

> 二进制入口：`agentcraft`（无子命令时进入 REPL）  
> 全局选项：`-h, --help` / `-V, --version`  
> 通用输出格式：`-f, --format <table|json|quiet>`

### 8.1 daemon — 守护进程管理

| 命令 | 说明 | 选项 |
|------|------|------|
| `daemon start` | 启动 Daemon | `--foreground` |
| `daemon stop` | 停止 Daemon | — |
| `daemon status` | 查看 Daemon 状态 | `-f` |

### 8.2 template (别名: tpl) — 模板管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `template list` | `ls` | 列出已注册模板 | — | `-f` |
| `template show` | — | 查看模板详情 | `<name>` | `-f` |
| `template validate` | — | 校验模板 JSON 文件 | `<file>` | — |
| `template load` | — | 加载模板到注册表 | `<file>` | — |

### 8.3 agent — Agent 实例管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `agent create` | — | 从模板创建 Agent | `<name>` | `-t, --template`（必需）, `--launch-mode`, `--work-dir`, `--overwrite`, `--append`, `-f` |
| `agent start` | — | 启动 Agent | `<name>` | — |
| `agent stop` | — | 停止 Agent | `<name>` | — |
| `agent status` | — | 查看 Agent 状态 | `[name]` | `-f` |
| `agent list` | `ls` | 列出所有 Agent | — | `-f` |
| `agent destroy` | `rm` | 销毁 Agent（删除工作区） | `<name>` | `--force` |
| `agent run` | — | 发送提示词并获取响应 | `<name>` | `--prompt`（必需）, `--model`, `--max-turns`, `--timeout`, `--session-id`, `-f` |
| `agent chat` | — | 与 Agent 交互聊天 | `<name>` | `-t, --template` |
| `agent resolve` | — | 解析外部启动信息 | `<name>` | `-t, --template`, `-f` |
| `agent attach` | — | 挂载外部进程 | `<name>` | `--pid`（必需）, `--metadata`, `-f` |
| `agent detach` | — | 卸载外部进程 | `<name>` | `--cleanup` |
| `agent prompt` | — | ACP 会话提示 | — | — |
| `agent dispatch` | — | 向调度器提交一次性任务 | `<name>` | `-m, --message`（必需）, `-p, --priority` |
| `agent tasks` | — | 查看调度器任务队列 | `<name>` | `-f` |
| `agent logs` | — | 查看调度器执行日志 | `<name>` | `--limit`, `-f` |

### 8.4 skill — 技能管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `skill list` | `ls` | 列出已加载技能 | — | `-f` |
| `skill show` | — | 查看技能详情 | `<name>` | `-f` |
| `skill add` | — | 从 JSON 文件添加技能 | `<file>` | — |
| `skill remove` | `rm` | 移除技能 | `<name>` | — |
| `skill export` | — | 导出技能为 JSON | `<name>` | `-o, --out` |

### 8.5 prompt — 提示词管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `prompt list` | `ls` | 列出已加载提示词 | — | `-f` |
| `prompt show` | — | 查看提示词详情 | `<name>` | `-f` |
| `prompt add` | — | 从 JSON 文件添加提示词 | `<file>` | — |
| `prompt remove` | `rm` | 移除提示词 | `<name>` | — |
| `prompt export` | — | 导出提示词为 JSON | `<name>` | `-o, --out` |

### 8.6 mcp — MCP 服务配置管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `mcp list` | `ls` | 列出 MCP 服务配置 | — | `-f` |
| `mcp show` | — | 查看 MCP 配置详情 | `<name>` | `-f` |
| `mcp add` | — | 从 JSON 文件添加 MCP 配置 | `<file>` | — |
| `mcp remove` | `rm` | 移除 MCP 配置 | `<name>` | — |
| `mcp export` | — | 导出 MCP 配置为 JSON | `<name>` | `-o, --out` |

### 8.7 workflow — 工作流管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `workflow list` | `ls` | 列出已加载工作流 | — | `-f` |
| `workflow show` | — | 查看工作流详情 | `<name>` | `-f` |
| `workflow add` | — | 从 JSON 文件添加工作流 | `<file>` | — |
| `workflow remove` | `rm` | 移除工作流 | `<name>` | — |
| `workflow export` | — | 导出工作流为 JSON | `<name>` | `-o, --out` |

### 8.8 plugin — 插件管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `plugin list` | `ls` | 列出所有插件 | — | `-f` |
| `plugin show` | — | 查看插件详情 | `<name>` | `-f` |
| `plugin add` | — | 从 JSON 文件添加插件 | `<file>` | — |
| `plugin remove` | `rm` | 移除插件 | `<name>` | — |
| `plugin export` | — | 导出插件为 JSON | `<name>` | `-o, --out` |

### 8.9 source — 组件源管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `source list` | `ls` | 列出已注册组件源 | — | `-f` |
| `source add` | — | 注册组件源 | `<url-or-path>` | `--name`（必需）, `--type`, `--branch` |
| `source remove` | `rm` | 移除组件源 | `<name>` | — |
| `source sync` | — | 同步组件源 | `[name]` | — |

### 8.10 preset — 预设管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `preset list` | `ls` | 列出来自源的预设 | `[package]` | `-f` |
| `preset show` | — | 查看预设详情 | `<qualified-name>` | `-f` |
| `preset apply` | — | 应用预设到模板 | `<qualified-name>` `<template>` | — |

### 8.11 schedule — 调度管理

| 命令 | 别名 | 说明 | 参数 | 选项 |
|------|------|------|------|------|
| `schedule list` | `ls` | 列出 Agent 的调度源 | `<name>` | `-f` |

### 8.12 proxy — ACP 代理

| 命令 | 说明 | 参数 | 选项 |
|------|------|------|------|
| `proxy` | 为 Agent 运行 ACP 代理（stdin/stdout） | `<name>` | `--lease`, `-t, --template` |

### 命令统计

| 统计项 | 数量 |
|--------|------|
| 顶级命令组 | 12 |
| 子命令总数 | ~55 |
| 独立命令 | 1（proxy） |

---

## 9. 配置体系

### 9.1 AgentTemplate 结构

```typescript
interface AgentTemplate {
  name: string;
  description?: string;
  backend: {
    type: "cursor" | "claude-code" | "custom";
    command?: string;
    args?: string[];
  };
  provider?: {
    model?: string;
    apiKey?: string;
  };
  initializer?: {
    workDir?: string;
    launchMode?: LaunchMode;
    workspacePolicy?: WorkspacePolicy;
  };
  domainContext?: {
    skills?: string[];       // 技能名称引用
    prompts?: string[];      // 提示词名称引用
    mcpServers?: McpServerRef[];
    workflow?: string;
    plugins?: string[];
  };
  schedule?: {
    heartbeat?: HeartbeatConfig;
    cron?: CronConfig[];
    hooks?: HookConfig[];
  };
  permissions?: { ... };     // Phase 3 待完善
}
```

### 9.2 平台 IPC

| 平台 | IPC 方式 |
|------|---------|
| macOS / Linux | Unix Domain Socket |
| Windows | Named Pipe |

### 9.3 通信协议

| 协议 | 用途 |
|------|------|
| JSON-RPC 2.0 | CLI ↔ Daemon 管理通信 |
| ACP (Agent Client Protocol) | Agent 流式交互 |
| MCP (Model Context Protocol) | Agent-to-Agent 工具调用 |

---

## 10. 内置配置资源

```
configs/
├── skills/
│   ├── code-review.json           # 代码审查技能
│   └── typescript-expert.json     # TypeScript 专家技能
├── prompts/
│   └── system-code-reviewer.json  # 代码审查系统提示词
├── mcp/
│   └── filesystem.json            # 文件系统 MCP 服务配置
├── workflows/
│   └── trellis-standard.json      # Trellis 标准工作流
├── templates/
│   └── code-review-agent.json     # 代码审查 Agent 模板
└── plugins/
    ├── github-plugin.json         # GitHub 插件
    ├── web-search-plugin.json     # Web 搜索插件
    └── memory-plugin.json         # 记忆插件
```

---

## 11. 当前版本状态总结

### 已完成（Phase 1 – 3 核心）

| 阶段 | 能力 | 状态 |
|------|------|------|
| **Phase 1** | ProcessWatcher、LaunchMode（4种）、resolve/attach/detach、one-shot、acp-service 重启 | ✅ 完成 |
| **Phase 2** | Domain Context 组件加载、Agent 通信（Cursor/ClaudeCode）、CLI chat/run、E2E 流程 | ✅ 完成 |
| **Phase 3a** | BaseComponentManager CRUD、PluginManager、5 组 RPC/CLI（skill/prompt/mcp/workflow/plugin） | ✅ 完成 |
| **Phase 3b** | BackendBuilder 接口、CursorBuilder、ClaudeCodeBuilder、WorkspaceBuilder 流水线 | ✅ 完成 |
| **Phase 3c** | TaskQueue、TaskDispatcher、InputRouter（heartbeat/cron/hook）、EmployeeScheduler、RPC/CLI | ✅ 完成 |
| **Phase 3d** | Component Source（GitHub/Local）、Source CRUD、Preset 系统 | ✅ 完成 |

### 进行中

| Issue | 功能 | 状态 |
|-------|------|------|
| #51 | AgentTemplate 权限控制 | 🔄 设计中 |
| #52 | AgentTemplate 可通过 Source 共享 | 🔄 设计中 |
| #53 | 可共享组件版本管理 | 🔄 设计中 |

### 已知限制

| 限制 | 说明 |
|------|------|
| Scheduler 未自动启动 | AppContext.schedulers 已定义但未在 Agent 启动时自动创建 EmployeeScheduler |
| MCP Server 骨架阶段 | 仅包含入口文件，Agent-to-Agent 工具调用尚未实现 |
| 权限系统待设计 | Template 的 permissions 字段和组件权限控制尚未实现 |
| Web UI 未启动 | 当前仅有 CLI 交互，REST API 和 Web UI 为后续规划 |

### 后续路线

| 阶段 | 焦点 |
|------|------|
| Phase 4 | 插件系统、stdout/stderr 日志捕获 |
| Phase 5 | 记忆系统（实例记忆、合并、上下文分层） |
| Phase 6 | ACP-Fleet（多 Agent 集群编排） |

---

> **文档生成时间**：2026-02-22 &nbsp;|&nbsp; **基于代码状态**：master 分支，Phase 3 收尾
