# Actant

一个用于构建、管理和编排 AI Agent 的平台。面向游戏开发等复杂业务场景，让用户能够快速拼装、复用合适的 Agent，零成本地将 AI 嵌入工作流。

> **当前版本**: [v0.2.2](https://github.com/blackplume233/Actant/releases/tag/v0.2.2) — Phase 4 进行中，核心功能可用

---

## 功能概览

### 核心能力

| 功能 | 说明 | 状态 |
|------|------|------|
| **Agent Template 系统** | JSON 配置文件定义 Agent 模板，引用式组合 Skills、Prompts、MCP、Workflow | ✅ |
| **Domain Context 拼装** | 通过 Skills、Prompts、MCP Server、Workflow、Plugin 动态组装 Agent 能力 | ✅ |
| **Agent 生命周期管理** | 创建、启动、监控、重启、停止、销毁 Agent Instance | ✅ |
| **多后端支持** | Claude Code / Cursor / Cursor Agent / Pi / Custom 五种 Agent Backend | ✅ |
| **权限控制** | 4 级预设（permissive/standard/restricted/readonly）+ 沙箱配置 | ✅ |
| **组件源与共享** | 从 GitHub/本地源同步组件和模板，支持 Preset 批量应用 | ✅ |
| **组件版本管理** | Semver 引用、同步变更报告、Breaking Change 检测 | ✅ |
| **可扩展架构** | ComponentTypeHandler 注册模式，可添加自定义组件类型 | ✅ |
| **实例注册表** | 集中管理所有 Agent 实例，支持 adopt/reconcile 孤立实例 | ✅ |
| **雇员调度器** | Heartbeat/Cron/Hook 三种输入源，优先级任务队列 | ✅ |
| **交互式 CLI** | 68 子命令，覆盖模板、Agent、组件、源、调度全部操作 | ✅ |
| **ACP 协议集成** | Direct Bridge + Session Lease 双模式 Agent 通信 | ✅ |
| **安装与自更新** | 一键安装脚本 + self-update 机制 | ✅ |
| **Hook/Plugin 体系** | 事件驱动 Workflow、系统级 Plugin、Agent 间通信 | 🔧 Phase 4 |
| **记忆系统** | 实例记忆、合并、上下文分层 | 🔲 Phase 5 |
| **ACP-Fleet** | 多 Agent 集群编排 | 🔲 Phase 6 |

---

## Quick Start

### 环境要求

- [Node.js](https://nodejs.org/) >= 22.0.0
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 或 [Cursor](https://cursor.com/) (Agent Backend)

### 安装

安装脚本会自动检测环境、安装 `actant` npm 包并运行配置向导：

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.ps1 | iex
```

> **Note**: `scripts/install.sh` 和 `scripts/install.ps1` 会随每次版本发布（stage）自动更新，始终指向最新版本。

### 从源码开发

```bash
git clone https://github.com/blackplume233/Actant.git
cd Actant
pnpm install    # 需要 pnpm >= 9.0.0
pnpm build
pnpm link --global
```

### 基本使用

```bash
# 启动 Daemon
actant daemon start

# 查看可用模板和组件
actant template list
actant skill list

# 从模板创建 Agent
actant agent create my-agent -t code-review-agent

# 向 Agent 发送任务
actant agent run my-agent --prompt "Review the error handling in src/index.ts"

# 交互式对话
actant agent chat my-agent

# 停止并销毁
actant agent stop my-agent
actant agent destroy my-agent --force

# 关闭 Daemon
actant daemon stop
```

### 组件源管理

```bash
# 注册远程组件源
actant source add https://github.com/user/my-hub --name my-hub

# 同步组件（显示 SyncReport：新增/更新/删除/Breaking Change）
actant source sync my-hub

# 查看和应用预设
actant preset list my-hub
actant preset apply my-hub@dev-suite my-template
```

### 实例管理

```bash
# 在指定外部目录创建 Agent
actant agent create my-agent -t code-review-agent --workspace /path/to/project

# 采纳已有的 Actant 工作目录
actant agent adopt /path/to/existing-workspace

# 查看所有实例
actant agent list
```

---

## 架构

借鉴 Docker 的核心理念：

| Docker 概念 | Actant 对应 |
|-------------|-------------|
| Dockerfile | AgentTemplate（模板） |
| Image | 解析后的模板 + 领域组件 |
| Container | Agent Instance（有进程、有工作区） |
| Docker Daemon | Actant Daemon（后台守护进程） |
| docker CLI | `actant` CLI |
| Registry | Component Source（组件源） |

### 模块结构

```
Actant
├── actant               统一入口（门面包，re-export 所有子包 + CLI bin）
├── @actant/shared       公共类型、错误、日志、平台
├── @actant/core         模板、构建器、管理器、调度器、领域组件、Source、版本
├── @actant/pi           Pi Agent 后端（pi-agent-core、pi-ai）
├── @actant/api          Daemon 服务层、RPC Handlers、AppContext
├── @actant/acp          ACP 协议集成（连接、网关、回调路由）
├── @actant/cli          CLI 前端（68 命令、REPL、流式输出）
└── @actant/mcp-server   MCP 协议服务端（骨架）
```

### 依赖关系

```
shared ← core ← pi
              ← acp
              ← mcp-server
              ← api ← cli ← actant (facade)
```

### 技术栈

| 层面 | 技术 |
|------|------|
| 运行时 | Node.js 22+ |
| 语言 | TypeScript 5.9+（strict） |
| 包管理 | pnpm 9+（workspace monorepo） |
| 构建 | tsup |
| 测试 | Vitest 4（669 tests, 56 suites） |
| Schema 校验 | Zod |
| CLI 框架 | Commander.js v14 |
| 日志 | pino |
| 定时任务 | croner |
| ACP 协议 | @agentclientprotocol/sdk |

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Agent Template** | Agent 配置蓝图，定义后端、Domain Context、权限、调度 |
| **Domain Context** | 领域上下文 — Skills + Prompts + MCP Servers + Workflow + Plugins |
| **Agent Instance** | 可运行的 Agent 实例，拥有工作区和生命周期 |
| **Component Source** | 组件仓库（GitHub/本地），可同步 Skills、Templates、Presets 等 |
| **Permission Preset** | 权限预设（permissive/standard/restricted/readonly） |
| **Employee Scheduler** | 雇员调度器，让 Agent 按心跳/Cron/事件自动执行任务 |
| **VersionedComponent** | 所有组件的公共信封，含版本号、来源追踪、标签 |

### 启动模式

| 模式 | 生命周期管理方 | 典型场景 |
|------|---------------|---------|
| Direct | 用户 | 直接打开 IDE / TUI |
| ACP Background | 调用方 | 第三方 Client 通过 ACP 管理 |
| ACP Service | Actant | 持久化雇员 Agent，崩溃自动重启 |
| One-Shot | Actant | 执行任务后自动终止 |

### Agent 状态机

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

---

## 项目结构

```
Actant/
├── packages/              源码（pnpm workspace）
│   ├── shared/            公共类型、错误、日志
│   ├── core/              核心业务逻辑
│   │   ├── builder/       WorkspaceBuilder + BackendBuilder + ComponentTypeHandler
│   │   ├── domain/        5 大组件管理器（Skill/Prompt/MCP/Workflow/Plugin）
│   │   ├── manager/       AgentManager + ProcessWatcher + RestartTracker
│   │   ├── scheduler/     EmployeeScheduler + TaskQueue + InputRouter
│   │   ├── source/        SourceManager + LocalSource + GitHubSource + SKILL.md Parser
│   │   ├── state/         InstanceRegistry + InstanceMetaIO
│   │   ├── permissions/   权限预设解析
│   │   ├── version/       ComponentRef + SyncReport
│   │   └── template/      TemplateRegistry + TemplateLoader + Zod Schema
│   ├── pi/                Pi Agent 后端
│   ├── api/               Daemon + RPC Handlers + AppContext
│   ├── acp/               ACP 协议（Connection/Gateway/Callback）
│   ├── cli/               CLI 命令（15 组 68 子命令）
│   ├── mcp-server/        MCP 服务端（骨架）
│   └── actant/            统一入口门面包（npm: actant）
├── configs/               内置配置（模板、技能、提示词、工作流、插件、MCP）
├── examples/              示例（actant-hub 组件源仓库）
├── scripts/               安装脚本 + 自更新脚本
├── docs/                  项目文档
│   ├── guides/            使用教程与操作指南
│   ├── design/            功能设计文档
│   ├── decisions/         架构决策记录（ADR）
│   └── stage/             版本快照存档
└── .trellis/              AI 开发框架（Issue、Roadmap、Spec）
```

---

## 开发

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式启动 CLI |
| `pnpm build` | 构建所有包 |
| `pnpm test` | 运行全部测试（669 tests） |
| `pnpm test:changed` | 仅运行受变更影响的测试 |
| `pnpm test:watch` | 测试监听模式 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm type-check` | TypeScript 类型检查（8 packages） |
| `pnpm clean` | 清理构建产物 |

### 自更新

```bash
actant self-update              # 从源码更新
actant self-update --check      # 仅检查版本
actant self-update --dry-run    # 模拟执行
```

---

## 文档

### 功能文档

逐功能介绍 Actant 的能力，每篇包含使用场景和验证示例：

| 文档 | 说明 |
|------|------|
| [功能文档索引](docs/guides/features/README.md) | 全部功能文档的目录和阅读建议 |
| [Agent 模板系统](docs/guides/features/agent-template.md) | JSON 配置定义可复用的 Agent 类型 |
| [Agent 生命周期管理](docs/guides/features/agent-lifecycle.md) | 创建、启动、运行、停止、销毁 |
| [领域上下文拼装](docs/guides/features/domain-context.md) | Skills + Prompts + MCP + Workflow + Plugin |
| [多后端支持](docs/guides/features/multi-backend.md) | Claude Code / Cursor / Pi / Custom |
| [权限控制](docs/guides/features/permissions.md) | 4 级安全预设 + 自定义配置 |
| [雇员调度器](docs/guides/features/employee-scheduler.md) | 心跳 / Cron / Hook 自动任务调度 |
| [ACP 连接与代理](docs/guides/features/acp-proxy.md) | Direct Bridge + Session Lease |
| [组件源与同步](docs/guides/features/component-source.md) | GitHub / 本地组件仓库 |
| [CLI 交互模式](docs/guides/features/cli-interaction.md) | 68 命令 + REPL 模式 |
| [安装与自更新](docs/guides/features/installation-update.md) | 一键安装 + 自动升级 |
| [可扩展架构](docs/guides/features/extensible-architecture.md) | ComponentTypeHandler 注册式扩展 |

### 教程与参考

| 文档 | 说明 |
|------|------|
| [入门指南](docs/guides/getting-started.md) | 安装、配置、第一个 Agent |
| [开发流程指南](docs/guides/dev-workflow-guide.md) | Plan → Code → Review → PR → Ship 全流程 |
| [ActantHub 使用指南](docs/guides/actant-hub-usage.md) | 默认组件源的使用 |
| [创建自定义 Hub](docs/guides/create-custom-hub.md) | 从零创建组件源仓库 |
| [v0.2.2 架构文档](docs/stage/v0.2.2/architecture.md) | 完整架构（模块、数据流、CLI、配置体系） |
| [v0.2.2 API 接口](docs/stage/v0.2.2/api-surface.md) | 62 个 RPC 方法 + 68 个 CLI 命令 |
| [v0.2.2 变更日志](docs/stage/v0.2.2/changelog.md) | v0.2.1 → v0.2.2 变更记录 |
| [DomainContext 扩展指南](docs/design/domain-context-extension-guide.md) | 如何添加自定义组件类型 |
| [ADR-001: 技术栈](docs/decisions/001-tech-stack.md) | TypeScript + pnpm monorepo 选型 |
| [ADR-002: 目录结构](docs/decisions/002-directory-structure.md) | 项目目录规范 |

---

## 参考项目

| 项目 | 关联 |
|------|------|
| [PicoClaw](https://picoclaw.net/) | Agent 持续集成 |
| [ACP](https://agentclientprotocol.com/) | Agent Client Protocol 框架 |
| [n8n](https://n8n.io/) | 工作流自动化模式 |
| [Trellis](https://github.com/mindfold-ai/Trellis) | 工程初始化及 Workflow 设计 |
| [UnrealFairy](https://github.com/blackplume233/UnrealFairy) | 关联项目 — Actant 将取代其 Agent 子系统 |

## License

[MIT](LICENSE)
