# Actant v0.2.1 — 架构文档

> **版本**: v0.2.1 | **日期**: 2026-02-24 | **分支**: master

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
│   │   └── source/              # ★ v0.2.1: SourceValidator 资产验证
│   ├── acp/                     # Agent Client Protocol 集成
│   ├── pi/                      # Pi Agent 后端 (pi-ai + pi-agent-core)
│   ├── api/                     # Daemon、RPC 处理器、AppContext
│   │   └── services/            # ★ v0.2.1: ModelProviderRegistry 集成
│   ├── cli/                     # CLI 命令 + REPL + Setup Wizard
│   │   └── commands/source/     # ★ v0.2.1: source validate 子命令
│   ├── mcp-server/              # MCP Server (骨架)
│   └── actant/                  # Facade 包 (re-export all)
├── configs/                     # 内置模板和组件配置
├── scripts/                     # 工具脚本 (安装、自更新、standalone 构建)
├── docs/
│   ├── stage/                   # 版本快照存档
│   ├── site/                    # Landing Page (GitHub Pages)
│   └── guides/                  # ★ v0.2.1: actant-hub 用法和自定义 Hub 指南
├── .github/workflows/           # CI/CD (★ v0.2.1: validate-hub.yml)
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
│   │                         # ★ v0.2.1: ModelProviderConfig 扩展 (apiKey, baseUrl, headers)
│   ├── domain-context.types.ts   # DomainContextConfig
│   ├── domain-component.types.ts # SkillDefinition, PromptDefinition 等
│   │                             # ★ v0.2.1: Agent Skills open standard 扩展字段
│   ├── source.types.ts       # SourceConfig, PackageManifest, PresetDefinition
│   ├── validation.types.ts   # ValidationIssue, ConfigValidationResult
│   └── rpc.types.ts          # RpcMethodMap, 所有 RPC 请求/响应类型
│                              # ★ v0.2.1: source.validate RPC 方法
├── errors/          # 错误体系 (ActantError 基类 + 分类子类)
├── logger/          # createLogger (基于 pino)
└── platform/        # 平台工具 (IPC 路径、信号处理、Windows 检测)
```

**v0.2.1 变更**:
- `ModelProviderConfig` 扩展: 新增 `apiKey`、`baseUrl`、`headers` 字段支持自定义 Provider
- `SkillDefinition` 新增 `inputSchema`、`outputSchema` 字段，兼容 Agent Skills Open Standard
- 新增 `source.validate` RPC 方法类型
- `AgentBackendType` 新增 `claude-code` 三模式支持 (resolve + open + acp)

### 5.2 @actant/core — 核心领域

```
core/src/
├── template/        # 模板注册、加载、校验、文件监听
│   └── schema/      # ★ v0.2.1: provider 字段变为 optional
├── builder/         # 工作区构建 (Cursor/ClaudeCode/Custom/Pi builders)
├── initializer/     # Agent 初始化 (pipeline + steps)
├── state/           # 实例状态管理
│   └── instance-meta-schema.ts  # ★ v0.2.1: 新增 providerType 持久化字段
├── manager/         # Agent 生命周期管理
│   ├── agent-manager.ts      # ★ v0.2.1: PID 验证 + non-zero exit code 处理
│   ├── launcher/
│   │   ├── backend-resolver.ts
│   │   ├── backend-registry.ts    # ★ v0.2.1: claude-code 三模式注册
│   │   ├── builtin-backends.ts
│   │   ├── process-launcher.ts
│   │   ├── process-watcher.ts
│   │   ├── restart-tracker.ts
│   │   └── process-log-writer.ts
│   └── launch-mode-handler.ts
├── scheduler/       # 任务调度 (EmployeeScheduler)
├── domain/          # 领域组件管理
│   └── skill/       # ★ v0.2.1: skill-manager 支持 open standard 字段传播
├── communicator/    # Agent 通信
├── permissions/     # 权限策略
├── provider/        # ★ v0.2.1: ModelProviderRegistry (新增模块)
│   ├── model-provider-registry.ts  # 可扩展 Provider 注册表
│   ├── builtin-providers.ts        # 内置 Provider (anthropic, openai 等)
│   └── index.ts
├── session/         # 会话管理
├── source/          # 组件源管理
│   ├── source-validator.ts    # ★ v0.2.1: 全新资产验证引擎 (750+ LOC)
│   ├── source-schemas.ts      # ★ v0.2.1: Zod schema 集合
│   └── skill-md-parser.ts     # ★ v0.2.1: Markdown → SkillDefinition 解析器
└── version/         # 版本和同步
```

**v0.2.1 核心变更**:
- **ModelProviderRegistry**: 可扩展的 LLM Provider 注册系统，支持 API Key 安全存储、自定义 baseUrl、协议适配
- **SourceValidator**: 递归验证组件源中所有资产 (templates, skills, prompts, presets, actant.json)，支持严格模式和兼容标准检查
- **claude-code 三模式**: `BackendRegistry` 注册 resolve + open + acp 三种模式
- **PID 验证**: `attachAgent` 检验目标 PID 是否存在
- **模板 Schema**: `provider` 字段改为 optional (降低空模板门槛)

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

**v0.2.1 变更**: `connection.ts` 改进 Windows spawn EINVAL 错误处理，为 `.cmd` 外部后端提供友好提示。

### 5.4 @actant/pi — Pi Agent 后端

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

### 5.5 @actant/api — Daemon 和 API 层

```
api/src/
├── daemon/             # Daemon 主进程 + Socket + ACP 中继
├── handlers/           # RPC 处理器
│   └── source-handlers.ts  # ★ v0.2.1: 新增 source.validate handler
└── services/
    └── app-context.ts  # DI 容器
                        # ★ v0.2.1: ModelProviderRegistry 初始化 + UserConfig provider 注册
```

**v0.2.1 变更**:
- `source-handlers.ts`: 新增 `handleSourceValidate` — 转发到 `SourceValidator`
- `app-context.ts`: 初始化 `ModelProviderRegistry`，从 `config.json` 读取用户自定义 Provider 并注册；API Key 从环境变量或配置中安全读取

### 5.6 @actant/cli — 命令行界面

```
cli/src/
├── commands/
│   ├── agent/
│   │   ├── open.ts         # 打开原生 UI
│   │   ├── chat.ts         # ★ v0.2.1: chat 命令改进 (自动创建 agent)
│   │   └── ... (create, start, stop, status, list, ...)
│   ├── source/
│   │   └── validate.ts     # ★ v0.2.1: source validate 子命令 (102 LOC)
│   ├── setup/
│   │   └── steps/configure-provider.ts  # ★ v0.2.1: 支持多 Provider 选择
│   └── ... (template, skill, prompt, mcp, workflow, plugin, preset, schedule, daemon, proxy, help, self-update)
├── output/                 # 输出格式化
└── repl/                   # 交互式 REPL
```

**v0.2.1 新增**:
- `source validate [name]` — 递归验证源中所有资产的合规性
- Setup Wizard 中 Provider 配置步骤支持更多选项（OpenAI, Gemini 等）
- `agent chat` 增强: 支持 `-t` 选项自动创建 agent

### 5.7 actant — Facade 包

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

### 6.3 Backend Open Mode 流程

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

### 6.5 Source Validate 流程 (v0.2.1 新增)

```
用户: actant source validate [name] [--strict] [--compat standard]
  │
  ▼
CLI ─── JSON-RPC ──→ Daemon
                       │
                       ▼
                  SourceValidator.validate(sourcePath, options)
                       │
                       ├── validateManifest(actant.json)
                       │     └── Zod: ManifestSchema
                       │
                       ├── validateTemplates(templates/*.json)
                       │     └── Zod: AgentTemplateSchema
                       │
                       ├── validateSkills(skills/*.json + skills/*.md)
                       │     ├── Zod: SkillDefinitionSchema
                       │     └── skill-md-parser (Markdown → SkillDef)
                       │
                       ├── validatePrompts(prompts/*.json)
                       │     └── Zod: PromptDefinitionSchema
                       │
                       ├── validatePresets(presets/*.json)
                       │     └── 交叉引用: 组件是否存在
                       │
                       └── return ValidationReport
                             ├── errors[]
                             ├── warnings[]
                             └── summary (pass/fail/total)
```

### 6.6 ModelProvider 注册流程 (v0.2.1 新增)

```
Daemon 启动
  │
  ├── AppContext.initialize()
  │     ├── registerBuiltinProviders()
  │     │     └── anthropic, openai, gemini, deepseek, ... → Registry
  │     │
  │     └── loadProviderRegistry()
  │           ├── read ~/.actant/config.json → userConfig.provider
  │           └── modelProviderRegistry.register(customProvider)
  │
  └── Provider 可用于:
        ├── Pi Agent (ACTANT_PROVIDER env → pi-ai model registry)
        ├── Setup Wizard (列出已注册 Provider)
        └── 未来: 统一 LLM 路由
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

### 7.2 Backend Open Mode

每个后端在 `BackendRegistry` 中声明支持的 Open Mode：

| 后端 | resolve | open | acp | 备注 |
|------|---------|------|-----|------|
| `cursor` | ✅ | ✅ | — | 只打开 IDE |
| `cursor-agent` | ✅ | ✅ | ✅ | Cursor Agent 模式 |
| `claude-code` | ✅ | ✅ | ✅ | ★ v0.2.1: 新增 open + acp 模式 |
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
| `persistent` | 工作区跨生命周期保留 (默认) |
| `ephemeral` | 任务完成后可移除 |

---

## 8. CLI 命令全览

### 总计: 16 个命令组, 64 个子命令

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
| resolve | `<name>` | `-t`, `-f` | 解析 spawn 信息 |
| open | `<name>` | — | 打开原生 UI |
| attach | `<name>` | `--pid`, `--metadata`, `-f` | 附加外部进程 (★ v0.2.1: PID 验证) |
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
| **validate** | `[name]` | `--path`, `-f`, `--strict`, `--compat` | **★ v0.2.1: 验证源资产** |

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

★ v0.2.1: configure-provider 步骤支持选择更多 Provider (anthropic, openai, gemini, deepseek 等)

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
  provider?: ModelProviderConfig;   // ★ v0.2.1: 改为 optional
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

### 9.3 ModelProviderConfig (v0.2.1 扩展)

```typescript
interface ModelProviderConfig {
  type: string;
  model?: string;
  apiKey?: string;         // ★ v0.2.1: 直接 API Key 或 env ref
  baseUrl?: string;        // ★ v0.2.1: 自定义端点
  headers?: Record<string, string>;  // ★ v0.2.1: 自定义请求头
  thinkingLevel?: string;
}
```

### 9.4 BackendDescriptor

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

### 9.5 环境变量

| 变量 | 作用 | 默认值 |
|------|------|--------|
| `ACTANT_HOME` | 数据根目录 | `~/.actant` |
| `ACTANT_SOCKET` | IPC Socket 路径 | 平台默认 |
| `ACTANT_LAUNCHER_MODE` | Launcher 模式 | `"real"` |
| `ACTANT_PROVIDER` | 统一 LLM Provider | 无 |
| `ACTANT_MODEL` | 统一 LLM 模型名 | 无 |
| `ACTANT_THINKING_LEVEL` | Thinking 级别 | 无 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | 无 |
| `OPENAI_API_KEY` | ★ v0.2.1: OpenAI API 密钥 | 无 |
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

### 内置 Model Providers (v0.2.1 新增)

| Provider | 协议 | 默认 Base URL |
|----------|------|--------------|
| anthropic | anthropic | https://api.anthropic.com |
| openai | openai | https://api.openai.com/v1 |
| gemini | openai-compat | https://generativelanguage.googleapis.com/v1beta/openai |
| deepseek | openai-compat | https://api.deepseek.com |
| ollama | openai-compat | http://localhost:11434/v1 |

---

## 11. 当前版本状态总结

### 已完成 (Phase 1–3 + Phase 4 部分)

| 里程碑 | 内容 |
|--------|------|
| **Phase 1: 核心运行时** | ProcessWatcher, LaunchMode (5种), resolve/attach/detach, one-shot, 崩溃重启 |
| **Phase 2: MVP** | Domain Context, 组件加载, ACP Client, CLI chat/run, E2E 流程 |
| **Phase 3: 通信·管理·构造·调度** | ACP Proxy, 统一 CRUD, WorkspaceBuilder, EmployeeScheduler, Source Registry |
| **Phase 4 (部分)** | Pi 内置后端, Backend Open Mode Registry, cursor-agent 后端, actant facade 包 |

### v0.2.1 新增

| 变更 | 说明 |
|------|------|
| **ModelProvider Registry** | 可扩展的 LLM Provider 注册系统，内置 anthropic/openai/gemini/deepseek/ollama，支持 API Key 安全配置 (#141) |
| **Source Validator** | 全新组件源资产验证引擎 (750+ LOC)，递归检查 actant.json / templates / skills / prompts / presets 的合规性 (#143) |
| **Agent Skills Open Standard** | SkillDefinition 兼容 Agent Skills 开放标准，新增 inputSchema/outputSchema 等元数据字段 (#144) |
| **claude-code 三模式** | BackendRegistry 为 claude-code 注册 resolve + open + acp 三种模式，附带安装提示 |
| **Windows EINVAL 修复** | 修复 Windows 平台对 `.cmd` 外部后端的 spawn EINVAL 错误 |
| **PID 验证 + 退出码强化** | agent attach 验证目标 PID 是否存在；CLI 命令统一 non-zero exit code |
| **Hub 可移植性** | actant.json manifest 增强，新增 Hub 用法指南和自定义 Hub 指南 |
| **validate-hub.yml** | 新增 GitHub Actions workflow，自动验证 actant-hub 目录结构 |

### 已知限制

| 限制 | 说明 |
|------|------|
| **MCP Server** | 仅骨架 |
| **#95** | ACP Gateway 终端回调 stub 未实现 |
| **#117** | Session Lease Gateway 缺少 handler |
| **#57** | Windows daemon fork 退出 (workaround: `--foreground`) |
| **Web UI** | 未开始 |
| **Memory 系统** | Phase 5 待开始 |

### 后续路线

| 阶段 | 计划 |
|------|------|
| **Phase 4 (剩余)** | #135 Workflow→Hook Package, #136 Email 通信, #134 agent open 前台 TUI, #133 环境变量 provider 配置 |
| **Phase 5** | Instance Memory, Memory Consolidation, Context Layers |
| **Phase 6** | ACP-Fleet (Daemon 作为 ACP Server) |

### 代码统计

| 指标 | 数值 |
|------|------|
| **包数量** | 8 (7 活跃 + 1 骨架) |
| **CLI 命令** | 64 个子命令 (16 命令组) |
| **RPC 方法** | ~50+ 个 (11 命名空间) |
| **后端类型** | 5 种 (Cursor, Cursor Agent, Claude Code, Pi, Custom) |
| **Open Mode** | 3 种 (resolve, open, acp) |
| **内置 Provider** | 5 种 (anthropic, openai, gemini, deepseek, ollama) |
| **领域组件** | 5 种 (skill, prompt, mcp, workflow, plugin) |

---

*本文档由 AI 在 v0.2.1 版本快照流程中自动生成。*
