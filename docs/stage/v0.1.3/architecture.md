# Actant v0.1.3 — 架构文档

> **版本**: v0.1.3 | **日期**: 2026-02-23 | **分支**: master

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [Monorepo 结构](#3-monorepo-结构)
4. [包依赖关系图](#4-包依赖关系图)
5. [各模块详细架构](#5-各模块详细架构)
6. [核心数据流](#6-核心数据流)
7. [Agent 生命周期](#7-agent-生命周期)
8. [CLI 命令全览](#8-cli-命令全览)
9. [配置体系](#9-配置体系)
10. [内置配置资源](#10-内置配置资源)
11. [当前版本状态总结](#11-当前版本状态总结)

---

## 1. 项目概览

**Actant** 是一个 AI Agent 构建、管理和编排平台，定位类似于 "Docker for AI Agents"：

| Docker 概念 | Actant 对应 |
|-------------|-------------|
| Dockerfile | AgentTemplate (JSON 配置) |
| Image | 解析后的模板 + 域组件 |
| Container | Agent 实例 (workspace + process) |
| Docker Daemon | Actant Daemon (后台服务) |
| docker CLI | actant CLI |
| Docker Hub | Source (GitHub/本地组件源) |
| docker-compose | 未来: Agent 编排 |

Actant 通过声明式模板定义 Agent 的后端类型 (Cursor / Claude Code / 自定义)、领域上下文 (技能、提示词、MCP 服务器、工作流)、权限策略和调度规则，然后自动构建工作区、管理生命周期并提供通信接口。

---

## 2. 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| **运行时** | Node.js | ≥22.0.0 |
| **模块系统** | ESM | — |
| **语言** | TypeScript | ^5.9.3 |
| **包管理** | pnpm (workspace) | 9.15.0 |
| **构建** | tsup | ^8.5.1 |
| **SEA 打包** | esbuild + Node.js SEA | 0.27.x |
| **测试** | Vitest | ^4.0.18 |
| **Lint** | ESLint + typescript-eslint | ^10.0.0 / ^8.56.0 |
| **CLI** | Commander.js | ^14.0.3 |
| **交互式提示** | @inquirer/prompts | ^7.5.3 |
| **终端渲染** | chalk, cli-table3 | ^5.6.2 / ^0.6.5 |
| **Schema 验证** | Zod | ^4.3.6 |
| **日志** | Pino | ^10.3.1 |
| **定时任务** | Croner | ^9.0.0 |
| **ACP 协议** | @agentclientprotocol/sdk | ^0.14.1 |
| **开发工具** | tsx | ^4.21.0 |

---

## 3. Monorepo 结构

```
actant/                          # 根 (private, pnpm workspace)
├── packages/
│   ├── shared/                  # 共享类型、错误、日志、平台工具
│   ├── core/                    # 核心领域逻辑 (模板、初始化、调度、构建、权限)
│   ├── acp/                     # Agent Client Protocol 集成
│   ├── api/                     # Daemon、RPC 处理器、AppContext
│   ├── cli/                     # CLI 命令 + REPL + Setup Wizard
│   └── mcp-server/              # MCP Server (骨架)
├── configs/                     # 内置模板和组件配置
├── scripts/                     # 工具脚本 (安装、自更新、standalone 构建)
│   ├── install.sh               # Linux/macOS 安装脚本
│   ├── install.ps1              # Windows 安装脚本
│   └── build-standalone.mjs     # SEA 单文件可执行构建
├── docs/
│   ├── stage/                   # 版本快照存档
│   └── site/                    # Landing Page (GitHub Pages)
├── .github/workflows/           # CI/CD
│   ├── build-standalone.yml     # 三平台 standalone binary 构建
│   ├── publish-npm.yml          # npm 发布
│   ├── deploy-site.yml          # GitHub Pages 部署
│   └── sync-issues.yml          # Issue 同步
├── .trellis/                    # 项目管理 (roadmap, issues, specs)
└── .agents/                     # Agent 技能定义
```

---

## 4. 包依赖关系图

```
                        ┌──────────────┐
                        │  @actant/cli │
                        │   (命令行)    │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────────┐
        │@actant/api│    │@actant/acp│    │  @actant/core │
        │  (Daemon) │    │ (ACP协议) │    │  (核心逻辑)   │
        └─────┬────┘    └─────┬────┘    └──────┬───────┘
              │               │                │
              │    ┌──────────┴─────┐          │
              │    │                │          │
              ▼    ▼                ▼          ▼
        ┌─────────────────────────────────────────────┐
        │              @actant/shared                   │
        │    (类型、错误、日志、平台工具)                   │
        └─────────────────────────────────────────────┘

        ┌────────────────┐
        │@actant/mcp-server│  (骨架, 依赖 core + shared)
        └────────────────┘
```

**依赖方向**: cli → api/acp/core/shared, api → acp/core/shared, acp → core/shared, core → shared

---

## 5. 各模块详细架构

### 5.1 @actant/shared — 共享基础

```
shared/src/
├── types/           # 全局类型定义
│   ├── agent.types.ts        # AgentInstanceMeta, AgentStatus, LaunchMode
│   ├── template.types.ts     # AgentTemplate, BackendConfig, InitializerConfig
│   ├── domain-context.types.ts   # DomainContextConfig
│   ├── domain-component.types.ts # SkillDefinition, PromptDefinition 等
│   ├── source.types.ts       # SourceConfig, PackageManifest, PresetDefinition
│   ├── validation.types.ts   # ValidationIssue, ConfigValidationResult
│   └── rpc.types.ts          # RpcMethodMap, 所有 RPC 请求/响应类型
├── errors/          # 错误体系 (ActantError 基类 + 分类子类)
├── logger/          # createLogger (基于 pino)
└── platform/        # 平台工具 (IPC 路径、信号处理、Windows 检测)
```

**职责**: 提供整个 monorepo 共享的类型定义、结构化错误、日志工厂和跨平台工具函数。

**v0.1.3 变更**: `getDefaultIpcPath` 统一了 Windows 平台上的 IPC socket 路径解析逻辑，修复了自定义 `ACTANT_HOME` 时 Daemon 与 CLI 路径不匹配的问题 (#120)。

### 5.2 @actant/core — 核心领域

```
core/src/
├── template/        # 模板注册、加载、校验、文件监听
│   ├── schema/      # Zod schema + validators
│   ├── template-registry.ts
│   ├── template-loader.ts
│   └── template-file-watcher.ts
├── builder/         # 工作区构建
│   ├── backend-builder.ts    # 抽象基类
│   ├── cursor-builder.ts     # Cursor 后端
│   ├── claude-code-builder.ts # Claude Code 后端
│   ├── custom-builder.ts     # 自定义后端
│   ├── workspace-builder.ts  # 编排: resolve → validate → scaffold → materialize → inject → verify
│   └── handlers/    # 组件类型处理器 (skills, prompts, mcp, workflow, plugins)
├── initializer/     # Agent 初始化
│   ├── agent-initializer.ts
│   ├── context-materializer.ts
│   ├── pipeline/    # InitializationPipeline, StepRegistry
│   └── steps/       # mkdir, exec, file-copy, git-clone, npm-install
├── state/           # 实例状态管理
│   ├── instance-meta-schema.ts
│   ├── instance-meta-io.ts
│   └── instance-registry.ts
├── manager/         # Agent 生命周期管理
│   ├── agent-manager.ts      # 核心管理器
│   ├── agent-launcher.ts     # 进程启动
│   ├── launch-mode-handler.ts
│   ├── process-watcher.ts    # 进程监控
│   ├── restart-tracker.ts    # 重启策略
│   └── process-log-writer.ts
├── scheduler/       # 任务调度
│   ├── employee-scheduler.ts # 雇员型调度器
│   ├── task-queue.ts
│   ├── task-dispatcher.ts
│   ├── execution-log.ts
│   ├── input-router.ts
│   └── inputs/      # heartbeat, cron, hook
├── domain/          # 领域组件管理
│   ├── base-component-manager.ts
│   ├── skill/       # SkillManager
│   ├── prompt/      # PromptManager
│   ├── mcp/         # McpConfigManager
│   ├── workflow/    # WorkflowManager
│   └── plugin/      # PluginManager
├── communicator/    # Agent 通信
│   ├── agent-communicator.ts   # 接口
│   ├── claude-code-communicator.ts
│   └── cursor-communicator.ts
├── permissions/     # 权限策略
│   ├── permission-resolver.ts
│   ├── permission-policy-enforcer.ts
│   └── permission-audit-logger.ts
├── session/         # 会话管理
│   └── session-registry.ts
├── source/          # 组件源管理
│   ├── source-manager.ts
│   ├── github-source.ts
│   ├── local-source.ts
│   └── skill-md-parser.ts
└── version/         # 版本和同步
    ├── component-ref.ts
    └── sync-report.ts
```

**职责**: Agent 全生命周期核心逻辑。

**v0.1.3 变更**: `ExecStep` 在所有平台统一使用 `shell: true` 模式，修复了非 Windows 平台上可能的执行问题。

### 5.3 @actant/acp — ACP 协议集成

```
acp/src/
├── connection.ts           # 单个 ACP 连接 (spawn + initialize + session)
├── connection-manager.ts   # 连接池 (agent name → connection)
├── communicator.ts         # AcpCommunicator (基于 ACP 的通信实现)
├── gateway.ts              # AcpGateway (IDE ↔ Agent 双向桥接)
├── terminal-manager.ts     # 本地终端管理
└── callback-router.ts      # 回调路由 (permission, file, terminal → IDE/本地)
```

**架构流程**:
```
IDE (ACP Client) ←→ AgentSideConnection (上游)
                          ↕
                     AcpGateway (桥接 + 回调路由)
                          ↕
             ClientSideConnection (下游) ←→ Agent Process (ACP Server)
```

### 5.4 @actant/api — Daemon 和 API 层

```
api/src/
├── daemon/
│   ├── daemon.ts           # Daemon 主进程
│   ├── socket-server.ts    # Unix Socket / Named Pipe 服务器
│   ├── acp-relay-server.ts # ACP 中继服务器
│   └── pid-file.ts         # PID 文件管理
├── handlers/
│   ├── handler-registry.ts      # 方法 → 处理器映射
│   ├── template-handlers.ts     # template.* RPC
│   ├── agent-handlers.ts        # agent.* RPC
│   ├── session-handlers.ts      # session.* RPC
│   ├── domain-handlers.ts       # skill/prompt/mcp/workflow/plugin.* RPC
│   ├── source-handlers.ts       # source.* RPC
│   ├── preset-handlers.ts       # preset.* RPC
│   ├── daemon-handlers.ts       # daemon.* RPC
│   ├── proxy-handlers.ts        # proxy.* RPC
│   └── schedule-handlers.ts     # schedule.* RPC
└── services/
    └── app-context.ts           # DI 容器 (AppContext)
```

**AppContext 依赖注入**:
```
AppContext
├── TemplateRegistry + TemplateLoader + TemplateFileWatcher
├── SkillManager + PromptManager + McpConfigManager + WorkflowManager + PluginManager
├── SourceManager
├── AgentInitializer
├── AcpConnectionManager
├── AgentManager
├── SessionRegistry
├── InstanceRegistry
└── schedulers: Map<string, EmployeeScheduler>
```

### 5.5 @actant/cli — 命令行界面

```
cli/src/
├── bin/
│   ├── actant.ts            # CLI 入口 (run → createProgram)
│   └── actant-sea.ts        # SEA 入口 (--__actant-daemon → Daemon, else → CLI)
├── daemon-entry.ts          # Daemon 入口
├── program.ts               # Commander 程序注册
├── client/
│   └── rpc-client.ts        # JSON-RPC 客户端 (连接 Daemon Socket)
├── commands/                # 15 个命令组 (含 setup)
│   ├── template/ agent/ skill/ prompt/ mcp/ workflow/ plugin/
│   ├── source/ preset/ schedule/ daemon/ proxy/
│   ├── setup/               # ★ v0.1.3 新增: 交互式设置向导
│   │   ├── setup.ts
│   │   ├── types.ts
│   │   └── steps/
│   │       ├── choose-home.ts          # 选择工作目录
│   │       ├── configure-provider.ts   # 配置模型提供商
│   │       ├── configure-source.ts     # 配置组件源
│   │       ├── materialize-agent.ts    # 创建初始 Agent
│   │       ├── configure-autostart.ts  # 配置开机自启
│   │       ├── hello-world.ts          # 验证安装
│   │       └── configure-update.ts     # 配置自动更新
│   ├── help.ts              # 帮助系统
│   └── self-update.ts       # 自更新
├── output/                  # 输出格式化 (table/json/quiet)
└── repl/                    # 交互式 REPL
```

**v0.1.3 新增**: `setup` 命令 — 7 步交互式设置向导，引导用户完成首次安装配置。

### 5.6 @actant/mcp-server — MCP 服务器 (骨架)

```
mcp-server/src/
└── index.ts              # export type {} (空导出, 未实现)
```

**计划**: 将来作为 Agent 间通信的 MCP 工具服务器 (`actant_run_agent`, `actant_list_agents` 等)。

---

## 6. 核心数据流

### 6.1 Agent 创建流程

```
用户: actant agent create myagent -t code-review
  │
  ▼
CLI ─── JSON-RPC ──→ Daemon (SocketServer)
                       │
                       ▼
                  HandlerRegistry → agent.create handler
                       │
                       ▼
                  AgentManager.createAgent(name, templateName, overrides)
                       │
                       ├── TemplateRegistry.get(templateName)
                       │
                       ├── AgentInitializer.createInstance(template, options)
                       │     ├── mkdir workspaceDir
                       │     ├── WorkspaceBuilder.build(template, workspaceDir, managers)
                       │     │     ├── resolve: 选择 BackendBuilder (Cursor/ClaudeCode/Custom)
                       │     │     ├── validate: 检查组件引用
                       │     │     ├── scaffold: 创建目录结构
                       │     │     ├── materialize: 写入组件文件 (skills→rules, prompts→md, mcp→json)
                       │     │     ├── inject: 注入权限策略 (含 MCP server 权限)
                       │     │     └── verify: 验证工作区完整性
                       │     │
                       │     ├── (可选) InitializationPipeline.run(steps)
                       │     │     ├── mkdir → exec → file-copy → git-clone → npm-install
                       │     │     └── 失败时逆序回滚
                       │     │
                       │     └── writeInstanceMeta(.actant.json)
                       │
                       └── return AgentInstanceMeta
```

### 6.2 Agent 交互流程

```
用户: actant agent run myagent --prompt "Review this PR"
  │
  ▼
CLI ─── JSON-RPC ──→ Daemon
                       │
                       ▼
                  agent.run handler → AgentManager.runPrompt(name, prompt, options)
                       │
                       ├── 如果有 ACP 连接 (acp-background/acp-service):
                       │     AcpConnectionManager.getConnection(name)
                       │       → conn.prompt(sessionId, prompt)
                       │       → 流式返回 ContentBlock[]
                       │
                       └── 如果无 ACP (direct/CLI pipe):
                             createCommunicator(backendType)
                               → communicator.runPrompt(workspaceDir, prompt)
                               → 返回 PromptResult

用户: actant agent chat myagent
  │
  ▼
CLI ─── 直接或 ACP Proxy ──→ Agent Process
                               │
                               ├── 直接模式: stdin/stdout 交互
                               └── Proxy 模式: AcpGateway 桥接 IDE ↔ Agent
```

### 6.3 安装与首次配置流程 (v0.1.3 新增)

```
用户: curl ... | bash   /   irm ... | iex
  │
  ▼
install.sh / install.ps1
  ├── 检查 Node.js ≥ 22
  ├── npm install -g actant-cli.tgz (从 GitHub Release 下载)
  ├── 验证: actant --version
  └── (可选) actant setup
        │
        ▼
  Setup Wizard (7 步交互)
  ├── Step 1: 选择 ACTANT_HOME 工作目录
  ├── Step 2: 配置模型提供商 (API Key)
  ├── Step 3: 自动启动 Daemon + 配置组件源
  ├── Step 4: 从模板创建首个 Agent
  ├── Step 5: 配置开机自启 (systemd / launchd / Task Scheduler)
  ├── Step 6: Hello World 验证
  └── Step 7: 配置自动更新
```

### 6.4 调度流程

```
EmployeeScheduler
  │
  ├── InputRouter 注册输入源:
  │     ├── HeartbeatInput: setInterval → enqueue
  │     ├── CronInput: croner pattern → enqueue
  │     └── HookInput: EventEmitter → enqueue
  │
  ├── TaskQueue: 按优先级排序
  │
  └── TaskDispatcher: 每 1s 轮询
        ├── dequeue → promptAgent(agentName, prompt)
        └── ExecutionLog.record(result)
```

---

## 7. Agent 生命周期

### 7.1 状态机

```
                            ┌─── destroy ───┐
                            │               │
(无) ──create──→ created ──start──→ starting ──→ running ──stop──→ stopping ──→ stopped
                    │                            │                              │
                    │                            │ process exit (managed)       │
                    │                            ├──→ stopped                   │
                    │                            │ process exit (error)         │
                    │                            ├──→ error                     │
                    │                            │ process exit (external)      │
                    │                            └──→ crashed                   │
                    │                                                          │
                    └─────────── destroy ◄──────────────────────────────────────┘
```

### 7.2 状态说明

| 状态 | 说明 |
|------|------|
| `created` | 实例已创建，工作区已构建，`.actant.json` 已写入 |
| `starting` | 进程启动中 |
| `running` | 进程运行中，PID 已记录 |
| `stopping` | 停止请求已发出，断开连接/终止进程中 |
| `stopped` | 进程已停止 |
| `error` | 启动失败或超过重启限制 |
| `crashed` | 进程意外退出 (仅 external ownership) |

### 7.3 启动模式 (LaunchMode)

| 模式 | 进程管理 | 退出行为 | 场景 |
|------|----------|----------|------|
| `direct` | Daemon 管理 | mark-stopped | 一次性执行 |
| `acp-background` | Daemon 管理 + ACP | mark-stopped | 后台 Agent |
| `acp-service` | Daemon 管理 + ACP | 自动重启 (指数退避) | 持久服务 |
| `one-shot` | Daemon 管理 | 可选 autoDestroy | 一次性任务 |
| `external` | 外部管理 | mark-crashed | IDE 启动的 Agent |

### 7.4 工作区策略 (WorkspacePolicy)

| 策略 | 说明 |
|------|------|
| `managed` | Daemon 管理工作区 (默认) |
| `external` | 工作区由外部管理 (adopt) |

### 7.5 进程退出处理

| 启动模式 | 处理动作 |
|----------|----------|
| direct / acp-background | mark-stopped |
| acp-service | restart (RestartTracker 指数退避) |
| one-shot (autoDestroy) | destroy |
| one-shot (!autoDestroy) | mark-stopped |
| external | mark-crashed |

### 7.6 Daemon 重启恢复

当 Daemon 重启时发现 `running`/`starting` 状态的陈旧实例：
- direct / acp-background / one-shot → mark-stopped
- acp-service → restart

---

## 8. CLI 命令全览

### 总计: 15 个命令组, 62 个子命令

### 8.1 template (别名: tpl)

| 子命令 | 别名 | 参数 | 选项 | 说明 |
|--------|------|------|------|------|
| list | ls | — | `-f, --format` (table/json/quiet) | 列出所有模板 |
| show | — | `<name>` | `-f, --format` | 显示模板详情 |
| validate | — | `<file>` | — | 验证模板 JSON 文件 |
| load | — | `<file>` | — | 加载模板到注册表 |
| install | — | `<spec>` | — | 从源安装模板 (占位) |

### 8.2 agent

| 子命令 | 别名 | 参数 | 选项 | 说明 |
|--------|------|------|------|------|
| create | — | `<name>` | `-t, --template` (必需), `--launch-mode`, `--work-dir`, `--workspace`, `--overwrite`, `--append`, `-f` | 从模板创建 Agent |
| start | — | `<name>` | — | 启动 Agent |
| stop | — | `<name>` | — | 停止 Agent |
| status | — | `[name]` | `-f` | 查看 Agent 状态 |
| list | ls | — | `-f` | 列出所有 Agent |
| adopt | — | `<path>` | `--rename`, `-f` | 收养已有工作区 |
| destroy | rm | `<name>` | `--force` | 销毁 Agent |
| resolve | — | `<name>` | `-t, --template`, `-f` | 解析 spawn 信息 |
| attach | — | `<name>` | `--pid` (必需), `--metadata`, `-f` | 附加外部进程 |
| detach | — | `<name>` | `--cleanup` | 分离外部进程 |
| run | — | `<name>` | `--prompt` (必需), `--model`, `--max-turns`, `--timeout`, `--session-id`, `-f` | 执行单次提示 |
| prompt | — | `<name>` | `-m, --message` (必需), `--session-id`, `-f` | 向运行中 Agent 发送消息 |
| chat | — | `<name>` | `-t, --template` | 交互式聊天 |
| dispatch | — | `<name>` | `-m, --message` (必需), `-p, --priority` | 派发任务到调度器 |
| tasks | — | `<name>` | `-f` | 查看调度任务队列 |
| logs | — | `<name>` | `--limit`, `-f` | 查看执行日志 |

### 8.3 领域组件命令 (skill / prompt / mcp / workflow / plugin)

每组 5 个子命令，结构一致：

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| list (ls) | — | `-f` | 列出所有组件 |
| show | `<name>` | `-f` | 显示组件详情 |
| add | `<file>` | — | 从 JSON 文件添加 |
| remove (rm) | `<name>` | — | 移除组件 |
| export | `<name>` | `-o, --out` | 导出为 JSON 文件 |

### 8.4 source

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| list (ls) | — | `-f` | 列出组件源 |
| add | `<url-or-path>` | `--name` (必需), `--type`, `--branch` | 注册源 |
| remove (rm) | `<name>` | — | 移除源 |
| sync | `[name]` | — | 同步源组件 |

### 8.5 preset

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| list (ls) | `[package]` | `-f` | 列出预设 |
| show | `<qualified-name>` | `-f` | 显示预设详情 |
| apply | `<qualified-name>` `<template>` | — | 应用预设到模板 |

### 8.6 schedule

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| list (ls) | `<name>` | `-f` | 列出 Agent 调度源 |

### 8.7 daemon

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| start | — | `--foreground` | 启动 Daemon |
| stop | — | — | 停止 Daemon |
| status | — | `-f` | 检查 Daemon 状态 |

### 8.8 setup (v0.1.3 新增)

| 命令 | 参数 | 选项 | 说明 |
|------|------|------|------|
| setup | — | `--skip-home`, `--skip-provider`, `--skip-source`, `--skip-agent`, `--skip-autostart`, `--skip-hello`, `--skip-update` | 交互式设置向导 |

**Setup Wizard 步骤**:

| 步骤 | 模块 | 说明 |
|------|------|------|
| 1 | `choose-home` | 选择 ACTANT_HOME 工作目录 |
| 2 | `configure-provider` | 配置模型提供商和 API Key |
| 3 | `configure-source` | 注册组件源 (需要 Daemon) |
| 4 | `materialize-agent` | 从模板创建首个 Agent (需要 Daemon) |
| 5 | `configure-autostart` | 配置开机自启 (systemd/launchd/Task Scheduler) |
| 6 | `hello-world` | 验证安装是否成功 (需要 Daemon) |
| 7 | `configure-update` | 配置自动更新选项 |

### 8.9 独立命令

| 命令 | 参数 | 选项 | 说明 |
|------|------|------|------|
| proxy | `<name>` | `--lease`, `-t, --template` | ACP 代理 (stdin/stdout) |
| help | `[command]` | — | 显示帮助 |
| self-update | — | `--source`, `--check`, `--force`, `--dry-run`, `--no-agent`, `--skip-build` | 从本地源自更新 |

---

## 9. 配置体系

### 9.1 AgentTemplate (核心配置)

```typescript
interface AgentTemplate extends VersionedComponent {
  version: string;
  backend: AgentBackendConfig;        // 后端类型 + 配置
  provider: ModelProviderConfig;      // 模型提供商
  domainContext: DomainContextConfig;  // 领域上下文 (skills, prompts, mcp, workflow, plugins)
  permissions?: PermissionsInput;     // 权限策略
  initializer?: InitializerConfig;    // 初始化步骤
  schedule?: ScheduleConfig;          // 调度配置
  metadata?: Record<string, string>;  // 自定义元数据
}
```

### 9.2 AgentBackendConfig

```typescript
interface AgentBackendConfig {
  type: 'cursor' | 'claude-code' | 'custom';
  path?: string;        // 后端可执行文件路径
  args?: string[];       // 启动参数
}
```

### 9.3 ModelProviderConfig

```typescript
interface ModelProviderConfig {
  type: 'anthropic' | 'openai' | 'custom';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}
```

### 9.4 DomainContextConfig

```typescript
interface DomainContextConfig {
  skills?: string[];              // 技能名称引用
  prompts?: string[];             // 提示词名称引用
  mcpServers?: McpServerRef[];    // MCP 服务器引用
  workflow?: string;              // 工作流名称引用
  subAgents?: string[];           // 子 Agent 引用
  plugins?: string[];             // 插件引用
  extensions?: Record<string, unknown[]>;
}
```

### 9.5 PermissionsInput

```typescript
type PermissionsInput =
  | { mode: 'preset'; preset: PermissionPreset }  // 'strict' | 'standard' | 'permissive'
  | { mode: 'custom'; allow?: string[]; deny?: string[]; sandbox?: SandboxConfig }
```

### 9.6 InitializerConfig

```typescript
interface InitializerConfig {
  steps: InitializerStep[];   // 顺序执行的初始化步骤
}

interface InitializerStep {
  type: 'mkdir' | 'exec' | 'file-copy' | 'git-clone' | 'npm-install';
  config?: Record<string, unknown>;
}
```

### 9.7 ScheduleConfig

```typescript
interface ScheduleConfig {
  heartbeat?: { intervalMs: number; prompt: string; priority?: TaskPriority };
  cron?: Array<{ pattern: string; prompt: string; timezone?: string; priority?: TaskPriority }>;
  hooks?: Array<{ eventName: string; prompt: string; priority?: TaskPriority }>;
}
```

### 9.8 AgentInstanceMeta

```typescript
interface AgentInstanceMeta {
  id: string;
  name: string;
  templateName: string;
  templateVersion: string;
  backendType: AgentBackendType;
  backendConfig: AgentBackendConfig;
  status: AgentStatus;
  launchMode: LaunchMode;
  workspacePolicy: WorkspacePolicy;
  processOwnership: ProcessOwnership;
  pid?: number;
  effectivePermissions?: PermissionsConfig;
  metadata?: Record<string, string>;
}
```

---

## 10. 内置配置资源

### 组件源 (Source)

- **GitHub Source**: 从 GitHub 仓库获取组件包
  - 解析 `manifest.json`，包含 templates, skills, prompts, mcpServers, workflows, presets
  - 组件按 `packageName@componentName` 命名空间

- **Local Source**: 从本地路径加载组件包

### 预设 (Preset)

预设将一组组件引用打包，可一键应用到模板：
```typescript
interface PresetDefinition extends VersionedComponent {
  description?: string;
  domainContext: DomainContextConfig;
  templates?: Record<string, Partial<AgentTemplate>>;
}
```

### 后端构建器

| 后端 | 工作区结构 |
|------|----------|
| **Cursor** | `.cursor/rules/*.mdc`, `.cursor/mcp.json`, `AGENTS.md`, `prompts/system.md` |
| **Claude Code** | `.claude/` 目录结构 |
| **Custom** | 继承 Cursor 结构 + 自定义扩展 |

### 内置组件

| 目录 | 文件 | 说明 |
|------|------|------|
| `configs/skills/` | `code-review.json`, `typescript-expert.json` | 技能定义 |
| `configs/prompts/` | `system-code-reviewer.json` | 提示词定义 |
| `configs/mcp/` | `filesystem.json` | MCP 服务器配置 |
| `configs/workflows/` | `trellis-standard.json` | 工作流定义 |
| `configs/templates/` | `code-review-agent.json` | Agent 模板 |
| `configs/plugins/` | `github-plugin.json`, `web-search-plugin.json`, `memory-plugin.json` | 插件定义 |

---

## 11. 当前版本状态总结

### 已完成 (Phase 1–3)

| 里程碑 | 内容 |
|--------|------|
| **Phase 1: 核心运行时** | ProcessWatcher, LaunchMode (5种), resolve/attach/detach, one-shot, acp-service 自动重启 |
| **Phase 2: MVP** | Domain Context, 组件加载, ACP Client, CLI chat/run, E2E 流程 |
| **Phase 3: 通信·管理·构造·调度** | ACP Proxy, 统一组件 CRUD (5 种组件), WorkspaceBuilder (3 种后端), EmployeeScheduler |

### v0.1.3 新增/修复

| 变更 | 说明 |
|------|------|
| **Setup Wizard** | 新增 `actant setup` 交互式 7 步设置向导，引导首次安装配置 |
| **安装脚本** | 新增 `install.sh` (Linux/macOS) 和 `install.ps1` (Windows)，支持从 GitHub Release 一键安装 |
| **npm 发布** | 新增 `publish-npm.yml` CI，支持 npm provenance attestation 发布到 npm registry |
| **Standalone Binary** | 新增三平台 (Linux x64 / macOS arm64 / Windows x64) 独立可执行文件构建 (Node.js SEA) |
| **#120 修复** | 统一 Windows 平台 IPC socket 路径解析，修复自定义 ACTANT_HOME 时 Daemon/CLI 路径不匹配 |
| **ExecStep 修复** | 初始化管线 `exec` 步骤在所有平台使用 `shell: true`，确保跨平台兼容 |
| **代码质量** | ESLint 配置修复、消除 non-null assertions、归档过期任务 |
| **CI 修复** | standalone binary 构建增加缺失的 `pnpm build` 步骤 |

### 已知限制

| 限制 | 说明 |
|------|------|
| **MCP Server** | 仅骨架，Agent 间通信工具未实现 |
| **#95** | ACP Gateway 终端回调 4 个 stub 方法未实现 |
| **#117** | Session Lease Gateway 模式缺少 `gateway.lease` handler |
| **Scheduler 自启动** | AppContext.schedulers 未在 Agent start 时自动创建 |
| **InstanceRegistry** | 缺少独立单元测试 |
| **Web UI** | 未开始 |

### 后续路线

| 阶段 | 计划 |
|------|------|
| **Phase 4** | 系统插件、stdout/stderr 日志收集、工具权限管理 |
| **Phase 5** | Instance Memory、Memory Consolidation、Context Layers |
| **Phase 6** | ACP-Fleet (Daemon 作为 ACP Server) |

### 代码统计

| 指标 | 数值 |
|------|------|
| **包数量** | 6 (5 活跃 + 1 骨架) |
| **CLI 命令** | 62 个子命令 (15 命令组) |
| **RPC 方法** | ~50+ 个 (涵盖 11 个命名空间) |
| **启动模式** | 5 种 |
| **后端类型** | 3 种 (Cursor, Claude Code, Custom) |
| **初始化步骤** | 5 种 (mkdir, exec, file-copy, git-clone, npm-install) |
| **领域组件** | 5 种 (skill, prompt, mcp, workflow, plugin) |
| **输入源** | 3 种 (heartbeat, cron, hook) |
| **分发渠道** | 3 种 (npm, standalone binary, 源码安装) |

---

*本文档由 AI 在 v0.1.3 版本快照流程中自动生成。*
