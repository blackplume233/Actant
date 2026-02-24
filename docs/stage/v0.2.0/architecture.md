# Actant v0.2.0 — 架构文档

> **版本**: v0.2.0 | **日期**: 2026-02-24 | **分支**: master

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

Actant 通过声明式模板定义 Agent 的后端类型 (Cursor / Cursor Agent / Claude Code / Pi / 自定义)、领域上下文 (技能、提示词、MCP 服务器、工作流)、权限策略和调度规则，然后自动构建工作区、管理生命周期并提供通信接口。

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
| **Pi Agent** | @mariozechner/pi-ai, @mariozechner/pi-agent-core | latest |
| **开发工具** | tsx | ^4.21.0 |

---

## 3. Monorepo 结构

```
actant/                          # 根 (private, pnpm workspace)
├── packages/
│   ├── shared/                  # 共享类型、错误、日志、平台工具
│   ├── core/                    # 核心领域逻辑 (模板、初始化、调度、构建、权限)
│   ├── acp/                     # Agent Client Protocol 集成
│   ├── pi/                      # ★ v0.2.0: Pi Agent 后端 (pi-ai + pi-agent-core)
│   ├── api/                     # Daemon、RPC 处理器、AppContext
│   ├── cli/                     # CLI 命令 + REPL + Setup Wizard
│   ├── mcp-server/              # MCP Server (骨架)
│   └── actant/                  # ★ v0.2.0: Facade 包 (re-export all)
├── configs/                     # 内置模板和组件配置
├── scripts/                     # 工具脚本 (安装、自更新、standalone 构建)
├── docs/
│   ├── stage/                   # 版本快照存档
│   └── site/                    # Landing Page (GitHub Pages)
├── .github/workflows/           # CI/CD
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

        ┌──────────────┐    ┌────────────────┐
        │  @actant/pi  │    │@actant/mcp-server│
        │(Pi Agent后端) │    │  (骨架)          │
        │ → shared, acp│    │  → core, shared  │
        └──────────────┘    └────────────────┘

        ┌────────────────────────────┐
        │         actant             │
        │  (Facade: re-export all)   │
        │  → api,core,shared,acp,    │
        │    mcp,pi,cli              │
        └────────────────────────────┘
```

**依赖方向**: cli → api/acp/core/shared, api → acp/core/shared/pi, acp → core/shared, core → shared, pi → shared/acp

---

## 5. 各模块详细架构

### 5.1 @actant/shared — 共享基础

```
shared/src/
├── types/           # 全局类型定义
│   ├── agent.types.ts        # AgentInstanceMeta, AgentStatus, LaunchMode
│   ├── template.types.ts     # AgentTemplate, BackendConfig, AgentOpenMode, BackendDescriptor
│   ├── domain-context.types.ts   # DomainContextConfig
│   ├── domain-component.types.ts # SkillDefinition, PromptDefinition 等
│   ├── source.types.ts       # SourceConfig, PackageManifest, PresetDefinition
│   ├── validation.types.ts   # ValidationIssue, ConfigValidationResult
│   └── rpc.types.ts          # RpcMethodMap, 所有 RPC 请求/响应类型
├── errors/          # 错误体系 (ActantError 基类 + 分类子类)
├── logger/          # createLogger (基于 pino)
└── platform/        # 平台工具 (IPC 路径、信号处理、Windows 检测)
```

**v0.2.0 变更**:
- `AgentBackendType` 扩展为 `"cursor" | "cursor-agent" | "claude-code" | "pi" | "custom"`
- 新增 `AgentOpenMode` (`"resolve" | "open" | "acp"`)、`PlatformCommand`、`BackendDescriptor` 类型
- 新增 `agent.open` RPC 方法类型 (`AgentOpenParams` / `AgentOpenResult`)

### 5.2 @actant/core — 核心领域

```
core/src/
├── template/        # 模板注册、加载、校验、文件监听
├── builder/         # 工作区构建 (Cursor/ClaudeCode/Custom builders)
├── initializer/     # Agent 初始化 (pipeline + steps)
├── state/           # 实例状态管理
├── manager/         # Agent 生命周期管理
│   ├── agent-manager.ts      # 核心管理器 (新增 openAgent)
│   ├── launcher/
│   │   ├── backend-resolver.ts    # 后端命令解析 (重构: 使用 BackendRegistry)
│   │   ├── backend-registry.ts    # ★ v0.2.0: 后端能力注册表
│   │   ├── builtin-backends.ts    # ★ v0.2.0: 内置后端注册
│   │   ├── process-launcher.ts
│   │   ├── process-watcher.ts
│   │   ├── restart-tracker.ts
│   │   └── process-log-writer.ts
│   └── launch-mode-handler.ts
├── scheduler/       # 任务调度 (EmployeeScheduler)
├── domain/          # 领域组件管理 (skill/prompt/mcp/workflow/plugin)
├── communicator/    # Agent 通信 (新增 cursor-agent → CursorCommunicator)
├── permissions/     # 权限策略
├── session/         # 会话管理
├── source/          # 组件源管理 (GitHubSource, LocalSource)
└── version/         # 版本和同步
```

**v0.2.0 核心变更**:
- **BackendRegistry**: 替代硬编码 if/else 的可扩展后端能力注册系统
- **builtin-backends**: 在模块加载时注册 cursor / cursor-agent / claude-code / custom
- **backend-resolver**: 重构为使用 `getBackendDescriptor()` / `requireMode()` / `getPlatformCommand()`
- **agent-manager**: 新增 `openAgent()` 方法；`startAgent()` 使用 `requireMode(type, "acp")`
- **create-communicator**: 新增 `registerCommunicator()` 动态注册 + `cursor-agent` 处理

### 5.3 @actant/acp — ACP 协议集成

```
acp/src/
├── connection.ts           # 单个 ACP 连接 (spawn + initialize + session)
├── connection-manager.ts   # 连接池 (agent name → connection)
├── communicator.ts         # AcpCommunicator (基于 ACP 的通信实现)
├── gateway.ts              # AcpGateway (IDE ↔ Agent 双向桥接)
├── terminal-manager.ts     # 本地终端管理
└── callback-router.ts      # 回调路由
```

**v0.2.0 变更**: `connection.ts` 支持 `acpResolver` 自定义命令解析，使 Pi 等 ACP-only 后端可以动态解析 spawn 命令。

### 5.4 @actant/pi — Pi Agent 后端 (v0.2.0 新增)

```
pi/src/
├── index.ts               # 导出 + ACP_BRIDGE_PATH
├── pi-builder.ts          # PiBuilder: .pi/ 目录结构、AGENTS.md、skills/prompts 物化
├── pi-communicator.ts     # PiCommunicator: 直接调用 pi-agent-core (runPrompt/streamPrompt)
├── pi-tool-bridge.ts      # createPiAgent: 构建带工具的 Pi Agent 实例
├── acp-bridge.ts          # pi-acp-bridge: ACP Server 进程 (stdin/stdout NDJSON)
└── pi-builder.test.ts     # 构建器单元测试
```

**关键导出**:

| 导出 | 说明 |
|------|------|
| `PiBuilder` | 实现 `BackendBuilder`，物化 `.pi/skills/`、`.pi/prompts/`、`AGENTS.md` |
| `PiCommunicator` | 实现 `AgentCommunicator`，直接通过 pi-agent-core 执行 prompt |
| `configFromBackend(config?)` | 从 `backend.config` + `ACTANT_*` 环境变量构建配置 |
| `ACP_BRIDGE_PATH` | acp-bridge.js 的绝对路径（通过 `import.meta.url` 解析） |
| `createPiAgent(options)` | 构建带 read_file/write_file/list_directory/run_command 工具的 Pi Agent |

**ACP Bridge 架构**:
```
Daemon → spawn(process.execPath, [ACP_BRIDGE_PATH])
           │
           ▼
      acp-bridge (Node.js 进程)
           │
           ├── AgentSideConnection (stdin/stdout NDJSON)
           │     ├── initialize → createPiAgent()
           │     ├── newSession → sessions Map
           │     ├── prompt → agent.run() + 流式 sessionUpdate
           │     └── cancel → agent.abort()
           │
           └── Pi Agent (pi-agent-core + pi-ai)
                 ├── Provider: ACTANT_PROVIDER → pi-ai model registry
                 ├── Model: ACTANT_MODEL
                 └── Tools: read_file, write_file, list_directory, run_command
```

### 5.5 @actant/api — Daemon 和 API 层

```
api/src/
├── daemon/             # Daemon 主进程 + Socket + ACP 中继
├── handlers/           # RPC 处理器 (新增 agent.open handler)
└── services/
    └── app-context.ts  # DI 容器 (新增 registerPiBackend)
```

**v0.2.0 变更**:
- `agent-handlers.ts`: 新增 `handleAgentOpen` 处理器
- `app-context.ts`: 新增 `registerPiBackend()` — 注册 Pi 的 `BackendDescriptor`（acpResolver + acpOwnsProcess）、`PiBuilder`、`PiCommunicator`

### 5.6 @actant/cli — 命令行界面

```
cli/src/
├── commands/
│   ├── agent/
│   │   ├── open.ts         # ★ v0.2.0: agent open (打开原生 UI)
│   │   └── ... (create, start, stop, status, list, ...)
│   └── ... (template, skill, prompt, mcp, workflow, plugin, source, preset, schedule, daemon, setup, proxy, help, self-update)
├── output/                 # 输出格式化
└── repl/                   # 交互式 REPL
```

**v0.2.0 新增**: `agent open <name>` — 通过 `agent.open` RPC 获取命令后，`spawn(detached)` 打开后端原生 UI。

### 5.7 actant — Facade 包 (v0.2.0 新增)

```
actant/
├── bin/actant.js           # CLI 入口
├── scripts/postinstall.mjs # 安装后处理
└── src/                    # Re-export 所有子包
    ├── index.ts → @actant/api
    ├── core.ts  → @actant/core
    ├── shared.ts → @actant/shared
    ├── acp.ts   → @actant/acp
    ├── mcp.ts   → @actant/mcp-server
    ├── pi.ts    → @actant/pi
    └── cli.ts   → @actant/cli
```

**用途**: 单一 npm 包安装所有功能，简化分发。Bin 命令 `actant` 和 `pi-acp-bridge` 都通过此包暴露。

### 5.8 @actant/mcp-server — MCP 服务器 (骨架)

```
mcp-server/src/
└── index.ts              # export type {} (空导出, 未实现)
```

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
                  AgentManager.createAgent(name, templateName, overrides)
                       │
                       ├── TemplateRegistry.get(templateName)
                       │
                       ├── AgentInitializer.createInstance(template, options)
                       │     ├── WorkspaceBuilder.build(template, workspaceDir, managers)
                       │     │     ├── resolve: BackendBuilder (Cursor/ClaudeCode/Pi/Custom)
                       │     │     ├── validate → scaffold → materialize → inject → verify
                       │     │     └── Pi: .pi/skills/, .pi/prompts/, AGENTS.md
                       │     │
                       │     ├── (可选) InitializationPipeline.run(steps)
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
                       ├── 如果有 ACP 连接 (agent started):
                       │     AcpConnectionManager.getConnection(name)
                       │       → conn.prompt(sessionId, prompt) → 流式 ContentBlock[]
                       │
                       └── 如果无 ACP (direct CLI pipe):
                             createCommunicator(backendType, backendConfig)
                               → communicator.runPrompt(workspaceDir, prompt)
```

### 6.3 Backend Open Mode 流程 (v0.2.0 新增)

```
resolve 模式: actant agent resolve myagent
  │
  ├── BackendRegistry.requireMode(type, "resolve")
  ├── getPlatformCommand(desc.resolveCommand)
  └── return { command, args, workspaceDir, env }
       → 调用方自行 spawn + attach

open 模式: actant agent open myagent
  │
  ├── BackendRegistry.requireMode(type, "open")
  ├── getPlatformCommand(desc.openCommand)
  └── CLI spawn(command, args, { detached: true })
       → 打开 Cursor IDE 等原生 UI

acp 模式: actant agent start myagent
  │
  ├── BackendRegistry.requireMode(type, "acp")
  ├── desc.acpResolver? → 自定义命令解析 (Pi)
  │   或 desc.acpCommand → 平台命令
  └── AcpConnectionManager.spawn(command, args)
       → Daemon 持有 ACP 连接
```

### 6.4 调度流程

```
EmployeeScheduler
  ├── InputRouter: HeartbeatInput / CronInput / HookInput → enqueue
  ├── TaskQueue: 按优先级排序
  └── TaskDispatcher: 每 1s 轮询 → dequeue → promptAgent → ExecutionLog
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

### 7.2 Backend Open Mode (v0.2.0 新增)

每个后端在 `BackendRegistry` 中声明支持的 Open Mode：

| 后端 | resolve | open | acp | 备注 |
|------|---------|------|-----|------|
| `cursor` | ✅ | ✅ | — | 只打开 IDE |
| `cursor-agent` | ✅ | ✅ | ✅ | Cursor Agent 模式 |
| `claude-code` | ✅ | — | ✅ | CLI 无独立 UI |
| `pi` | — | — | ✅ | ACP-only，acpOwnsProcess |
| `custom` | ✅ | — | — | 仅外部 spawn |

### 7.3 启动模式 (LaunchMode)

| 模式 | 进程管理 | 退出行为 | 场景 |
|------|----------|----------|------|
| `direct` | Daemon 管理 | mark-stopped | 一次性执行 |
| `acp-background` | Daemon + ACP | mark-stopped | 后台 Agent |
| `acp-service` | Daemon + ACP | 自动重启 | 持久服务 |
| `one-shot` | Daemon 管理 | 可选 autoDestroy | 一次性任务 |
| `external` | 外部管理 | mark-crashed | IDE 启动的 Agent |

### 7.4 工作区策略 (WorkspacePolicy)

| 策略 | 说明 |
|------|------|
| `managed` | Daemon 管理工作区 (默认) |
| `external` | 工作区由外部管理 (adopt) |

---

## 8. CLI 命令全览

### 总计: 16 个命令组, 63 个子命令

### 8.1 template (别名: tpl)

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| list (ls) | — | `-f` | 列出所有模板 |
| show | `<name>` | `-f` | 显示模板详情 |
| validate | `<file>` | — | 验证模板 JSON |
| load | `<file>` | — | 加载模板 |
| install | `<spec>` | — | 从源安装模板 |

### 8.2 agent

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| create | `<name>` | `-t`, `--launch-mode`, `--work-dir`, `--workspace`, `--overwrite`, `--append`, `-f` | 从模板创建 |
| start | `<name>` | — | 启动 Agent (需 acp mode) |
| stop | `<name>` | — | 停止 Agent |
| status | `[name]` | `-f` | 查看状态 |
| list (ls) | — | `-f` | 列出所有 |
| adopt | `<path>` | `--rename`, `-f` | 收养工作区 |
| destroy (rm) | `<name>` | `--force` | 销毁 |
| resolve | `<name>` | `-t`, `-f` | 解析 spawn 信息 (需 resolve mode) |
| **open** | `<name>` | — | **★ v0.2.0: 打开原生 UI (需 open mode)** |
| attach | `<name>` | `--pid`, `--metadata`, `-f` | 附加外部进程 |
| detach | `<name>` | `--cleanup` | 分离外部进程 |
| run | `<name>` | `--prompt`, `--model`, `--max-turns`, `--timeout`, `--session-id`, `-f` | 执行单次提示 |
| prompt | `<name>` | `-m`, `--session-id`, `-f` | 向运行中 Agent 发消息 |
| chat | `<name>` | `-t` | 交互式聊天 |
| dispatch | `<name>` | `-m`, `-p` | 派发调度任务 |
| tasks | `<name>` | `-f` | 查看任务队列 |
| logs | `<name>` | `--limit`, `-f` | 查看执行日志 |

### 8.3 领域组件 (skill / prompt / mcp / workflow / plugin)

每组 5 个子命令: list, show, add, remove, export

### 8.4 source

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| list | — | `-f` | 列出源 |
| add | `<url-or-path>` | `--name`, `--type`, `--branch` | 注册源 |
| remove | `<name>` | — | 移除源 |
| sync | `[name]` | — | 同步组件 |

### 8.5 preset

| 子命令 | 参数 | 选项 | 说明 |
|--------|------|------|------|
| list | `[package]` | `-f` | 列出预设 |
| show | `<qualified-name>` | `-f` | 显示详情 |
| apply | `<qualified-name>` `<template>` | — | 应用到模板 |

### 8.6 schedule

| 子命令 | 参数 | 说明 |
|--------|------|------|
| list | `<name>` | 列出调度源 |

### 8.7 daemon

| 子命令 | 选项 | 说明 |
|--------|------|------|
| start | `--foreground` | 启动 Daemon |
| stop | — | 停止 Daemon |
| status | `-f` | 检查状态 |

### 8.8 setup

7 步交互式设置向导: choose-home → configure-provider → configure-source → materialize-agent → configure-autostart → hello-world → configure-update

### 8.9 独立命令

| 命令 | 参数 | 说明 |
|------|------|------|
| proxy | `<name>` | ACP 代理 |
| help | `[command]` | 帮助 |
| self-update | — | 自更新 |

---

## 9. 配置体系

### 9.1 AgentTemplate

```typescript
interface AgentTemplate extends VersionedComponent {
  version: string;
  backend: AgentBackendConfig;
  provider: ModelProviderConfig;
  domainContext: DomainContextConfig;
  permissions?: PermissionsInput;
  initializer?: InitializerConfig;
  schedule?: ScheduleConfig;
  metadata?: Record<string, string>;
}
```

### 9.2 AgentBackendConfig

```typescript
interface AgentBackendConfig {
  type: AgentBackendType;   // "cursor" | "cursor-agent" | "claude-code" | "pi" | "custom"
  config?: Record<string, unknown>;
}
```

### 9.3 BackendDescriptor (v0.2.0 新增)

```typescript
type AgentOpenMode = "resolve" | "open" | "acp";

interface PlatformCommand { win32: string; default: string; }

interface BackendDescriptor {
  type: AgentBackendType;
  supportedModes: AgentOpenMode[];
  resolveCommand?: PlatformCommand;
  openCommand?: PlatformCommand;
  acpCommand?: PlatformCommand;
  acpResolver?: (workspaceDir: string, backendConfig?: Record<string, unknown>) => { command: string; args: string[] };
  acpOwnsProcess?: boolean;
}
```

### 9.4 环境变量

| 变量 | 作用 | 默认值 |
|------|------|--------|
| `ACTANT_HOME` | 数据根目录 | `~/.actant` |
| `ACTANT_SOCKET` | IPC Socket 路径 | 平台默认 |
| `ACTANT_LAUNCHER_MODE` | Launcher 模式 | `"real"` |
| `ACTANT_PROVIDER` | ★ 统一 LLM Provider | 无 |
| `ACTANT_MODEL` | ★ 统一 LLM 模型名 | 无 |
| `ACTANT_THINKING_LEVEL` | ★ Thinking 级别 | 无 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | 无 |
| `LOG_LEVEL` | Pino 日志级别 | `"info"` |

---

## 10. 内置配置资源

### 后端构建器

| 后端 | 工作区结构 |
|------|----------|
| **Cursor** | `.cursor/rules/*.mdc`, `.cursor/mcp.json`, `AGENTS.md` |
| **Cursor Agent** | 同 Cursor（`.cursor/` 目录） |
| **Claude Code** | `.claude/` 目录结构 |
| **Pi** | `.pi/skills/`, `.pi/prompts/`, `AGENTS.md`, `.pi/settings.json` |
| **Custom** | 继承 Cursor 结构 + 自定义扩展 |

### 组件源

- **GitHub Source**: 浅克隆 → 解析 `actant.json` manifest → 加载组件
- **Local Source**: 本地路径 → 直接解析
- **默认源**: `actant-hub` (GitHub: blackplume233/actant-hub.git)

---

## 11. 当前版本状态总结

### 已完成 (Phase 1–3 + Phase 4 部分)

| 里程碑 | 内容 |
|--------|------|
| **Phase 1: 核心运行时** | ProcessWatcher, LaunchMode (5种), resolve/attach/detach, one-shot, 崩溃重启 |
| **Phase 2: MVP** | Domain Context, 组件加载, ACP Client, CLI chat/run, E2E 流程 |
| **Phase 3: 通信·管理·构造·调度** | ACP Proxy, 统一 CRUD, WorkspaceBuilder, EmployeeScheduler, Source Registry |
| **Phase 4 (部分)** | Pi 内置后端, Backend Open Mode Registry, cursor-agent 后端, actant facade 包 |

### v0.2.0 新增

| 变更 | 说明 |
|------|------|
| **Pi Agent 后端** | `@actant/pi` — 基于 pi-agent-core + pi-ai 的零外部依赖 Agent 后端，支持 ACP 模式 |
| **Backend Open Mode Registry** | 可扩展的后端能力注册系统，每个后端声明支持的 resolve/open/acp 模式 |
| **cursor-agent 后端** | 新增 Cursor Agent 模式（支持 resolve + open + acp 三种模式） |
| **agent open 命令** | 新 CLI 命令 + RPC 方法，打开后端原生 TUI/UI |
| **actant facade 包** | 单一 npm 入口，re-export 所有子包 |
| **ACTANT_* 环境变量** | 统一 LLM Provider/Model 配置前缀 |
| **Spec 文档更新** | agent-lifecycle (Open Mode)、api-contracts (agent.open)、config-spec (cursor-agent + env)、cross-platform-guide (gotchas) |

### 已知限制

| 限制 | 说明 |
|------|------|
| **MCP Server** | 仅骨架 |
| **#95** | ACP Gateway 终端回调 stub 未实现 |
| **#117** | Session Lease Gateway 缺少 handler |
| **Web UI** | 未开始 |
| **Memory 系统** | Phase 5 待开始 |

### 后续路线

| 阶段 | 计划 |
|------|------|
| **Phase 4 (剩余)** | #135 Workflow→Hook, #136 Email 通信, #134 agent open 前台 TUI, #133 环境变量 provider |
| **Phase 5** | Instance Memory, Memory Consolidation, Context Layers |
| **Phase 6** | ACP-Fleet (Daemon 作为 ACP Server) |

### 代码统计

| 指标 | 数值 |
|------|------|
| **包数量** | 8 (7 活跃 + 1 骨架) |
| **CLI 命令** | 63 个子命令 (16 命令组) |
| **RPC 方法** | ~50+ 个 (11 命名空间) |
| **后端类型** | 5 种 (Cursor, Cursor Agent, Claude Code, Pi, Custom) |
| **Open Mode** | 3 种 (resolve, open, acp) |
| **测试文件** | ~56 个 |
| **测试用例** | ~544 个 |
| **领域组件** | 5 种 (skill, prompt, mcp, workflow, plugin) |

---

*本文档由 AI 在 v0.2.0 版本快照流程中自动生成。*
