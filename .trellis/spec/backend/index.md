# Backend Development Guidelines

> Best practices for backend development in Actant.

---

## Project Overview

**Actant** is a platform for building, managing, and composing AI agents. It targets complex business domains (e.g. game development) where users need to rapidly assemble, reuse, and deploy agents with zero friction.

### Core Scenarios

| # | Scenario | Description |
|---|----------|-------------|
| 1 | Custom Business Agent | Dynamically compose agents with Domain Context (Skills, MCP, Prompts, memory) |
| 2 | CI Integration | Agents callable via CLI for TeamCity-like CI pipelines |
| 3 | Persistent Agent (OpenClaw) | Long-running agents with heartbeat, self-growth, long-term memory, scheduled tasks |
| 4 | Agent as Service | Persistent agents integrated into IM / Email as virtual employees |
| 5 | ACP Integration | AgentServer exposed via ACP for Unreal/Unity engine communication |
| 6 | Agent-to-Agent | Agents invoking other agents |

---

## Terminology Glossary

| Term | Definition |
|------|-----------|
| **Model Provider** | Base model API (e.g. OpenAI, Anthropic) |
| **Agent Client** | Agent frontend — TUI, IDE plugin, dedicated app (e.g. Claude Desktop) |
| **Agent Backend** | Agent's functional implementation without UI (e.g. Claude Code, Cursor core) |
| **Domain Context** | Business-specific context composed of Workflow, Prompt, MCP/Tools, Skills, SubAgents |
| **Agent Template** | Configuration file defining Domain Context, default backend, provider, and initializer |
| **Agent Instance** | A runnable agent with assigned Provider, Backend, Domain Context, hooks, and plugins |
| **Employee** | A continuously running Agent Instance serving as a persistent worker |

### Domain Context Components

| Component | Description | Example |
|-----------|-------------|---------|
| Workflow | Default instructions, hooks, commands (Trellis-like) | `.trellis/` configuration |
| Prompt | System prompts and instruction sets | Role-specific prompts |
| MCP/Tools | Model Context Protocol servers and tools | File system, database access |
| Skills (Rules) | Behavioral rules and domain knowledge | Coding standards, review rules |
| SubAgent | Nested agent references for composition | Specialist agents |

---

## Module Architecture

```
Actant
├── ActantCore          # Core functionality
│   ├── CLI Module          # Interactive command-line interface
│   ├── Template Module     # Agent Template configuration and management
│   ├── Initializer Module  # Construct Agent Instance from Template
│   ├── Manager Module      # Lifecycle management of all Agent Instances
│   ├── Context Injector    # [Phase 4] SessionContextInjector — 动态上下文注入框架
│   ├── Plugin Module       # [Phase 4] PluginHost + 三插口 Plugin 体系
│   ├── Hook Module         # [Phase 4] HookEventBus + HookRegistry + ActionRunner
│   ├── Scheduler Module    # [Phase 3c+4] EmployeeScheduler + 四模式调度
│   ├── Email Module        # [Phase 4] EmailHub + Agent-to-Agent 通信
│   └── VFS Module          # [#248] VfsRegistry + Source Factories + Path Resolution
│
├── Actant ACP          # Agent Client Protocol server
│
├── Actant MCP          # Built-in MCP server (VFS + RPC gateway, 6 tools)
│
├── Actant Pi           # Pi Agent backend integration (optional)
│
├── Actant API          # RPC API layer (JSON-RPC over IPC)
│
├── Actant REST API     # Standalone RESTful HTTP server (@actant/rest-api)
│                       # 供 Dashboard / n8n / IM 等外部系统访问
│
└── Agent Memory        # [Phase 5] 独立记忆系统 (零 Actant 依赖)
    ├── @agent-memory/core        # 数据模型 + 接口
    ├── @agent-memory/embedding   # Embedding 客户端
    └── @agent-memory/store-<TBD>    # 持久化存储（后端待定）
```

### ActantCore Details

**CLI Module**: Interactive command-line environment. Users execute commands sequentially (similar to Python REPL). All core functionality must be accessible via CLI.

**Template Module**: Manages Agent Template configurations.
- Skills are referenced by name (managed by a central Skill Manager)
- Prompts, Workflows, MCP configs, plugins are all reusable references
- Templates compose references rather than embedding full configs

**Initializer Module**: Constructs Agent Instances from Templates.
- User specifies Agent Backend and Provider (or uses defaults)
- Creates a working directory based on initializer flow
- Optionally starts the agent for service mode

**Manager Module**: Manages all Agent Instance lifecycles.
- Launch modes: direct (open Cursor/Claude Code), ACP background (caller-managed lifecycle), ACP service (Actant-managed), one-shot (execute and terminate)
- Provides start, stop, monitor, status capabilities

---

## Development Principles

1. **Documentation-First（文档先行）**: 治理原则见 [spec/index.md](../index.md#documentation-first-原则最高优先级)；后端实现操作指南见 [quality-guidelines.md §Documentation-First](./quality-guidelines.md#documentation-first-开发模式)。
2. **CLI-First, UI-Ready**: All core functions must work via text config and CLI. CLI design should anticipate future UI integration.
3. **Test-Driven**: All behaviors exposed as CLI operations or configurations must have comprehensive unit tests.
4. **Contract-Driven（契约驱动）**: 模块间通信通过显式接口契约约束。接口先于实现定义，实现必须符合已发布的契约。接口变更需先更新 `api-contracts.md` 和类型定义。
5. **Thorough Review**: Completed features must be reviewed for code quality, extensibility, and maintainability. **Review 必须确认文档与代码同步。**

---

## Guidelines Index

**Core Specifications** (see [spec/index.md](../index.md) for hierarchy):

| Spec | Description |
|------|-------------|
| [Configuration Spec](../config-spec.md) | All schemas, types, and environment variables |
| [API Contracts](../api-contracts.md) | RPC methods, CLI commands, IPC protocol |

**Implementation Guides**:

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Initial |
| [Database Guidelines](./database-guidelines.md) | Persistence patterns for agent state | Initial |
| [Error Handling](./error-handling.md) | Error types and handling strategies | Initial |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, testing, review, monorepo publishing | Updated |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging for agent lifecycle | Initial |
| [Context Injector](./context-injector.md) | ContextProvider 注册/收集/过滤协议、内置 Provider、模板引擎 | Updated |
| [Plugin 预定设计](./plugin-guidelines.md) | **[Phase 4 预定]** Plugin / Hook / Scheduler / Memory 预定设计草案，实施前须重新审查 | **Preliminary** |
| VFS (see [api-contracts §3.18](../api-contracts.md)) | VFS Registry、Source Factories、默认挂载点、能力体系 | **Implemented** |

---

## Common Mistakes

### New Subsystem Missing Daemon Initialization

**Symptom**: 新子系统的所有 RPC 调用返回 "XXX not initialized" 错误，但代码逻辑、类型、handlers、CLI 均已实现且单元测试通过。

**Cause**: 子系统组件全部就绪但未在 `AppContext.init()` 中完成初始化注入。仅在 `AppContext` 中声明属性（`vfsRegistry?: VfsRegistry`）和在 handler registry 中注册 RPC handler 是不够的。

**Fix**: 必须在 `AppContext.init()` 或构造函数中实例化子系统并完成接线。

**Prevention**: 遵循以下检查清单。

### New Subsystem Integration Checklist

添加新子系统时必须完成以下全部 7 步，缺一步都会导致运行时故障：

| # | 步骤 | 位置 | 验证方式 |
|---|------|------|---------|
| 1 | 定义类型 | `@actant/shared` types | `tsc --noEmit` |
| 2 | 实现核心逻辑 | `@actant/core` | 单元测试 |
| 3 | 注册 RPC handlers | `@actant/api` handlers | handler 文件 + daemon.ts import |
| 4 | **初始化实例** | `AppContext` 构造函数/`init()` | **E2E 测试（易遗漏！）** |
| 5 | 注册 ContextProvider（如需） | `AppContext.init()` → `sessionContextInjector.register()` | Agent 启动时 context 检查 |
| 6 | 注册 CLI 命令 | `@actant/cli` commands + `program.ts` | `actant <cmd> --help` |
| 7 | 接入生命周期事件 | `AppContext.init()` → `eventBus.on(...)` | Agent create/destroy 时验证 |

> **教训 (#248 VFS)**: Types、Registry、Handlers、CLI、6 个 Source Factory、57 个单元测试全部实现并通过，但 QA 测试发现所有 RPC 调用返回 "VFS not initialized"——因为 Step 4 被遗漏，`AppContext.init()` 从未实例化 `VfsRegistry`。

---

## Key Design Decisions

### CLI as Primary Interface

All features are first implemented as CLI commands. This ensures:
- CI/CD tools can integrate directly
- Automated testing is straightforward
- Future UI layers call the same underlying logic

### Reference-Based Composition

Agent Templates use **name references** to Domain Context components rather than embedding full configs. This enables:
- Component reuse across templates
- Centralized management of Skills, Workflows, MCP configs
- Independent versioning of components

### Dynamic Context Injection (SessionContextInjector)

Agent 启动时，`SessionContextInjector` 从所有已注册的 `ContextProvider` 收集 MCP Servers、Internal Tools、System Context 三类资源，经去重和 Scope 过滤后聚合为 `SessionContext` 交给 ACP 连接层。子系统（Canvas、Schedule、Memory 等）通过注册 `ContextProvider` 实现松耦合扩展。

> 完整规格（数据格式、接口定义、Scope 过滤规则、工作流）：[context-injector.md](./context-injector.md)
> 实现参考：`packages/core/src/context-injector/`，`packages/api/src/services/app-context.ts`

### Virtual File System (VFS)

所有数据域（workspace、memory、config、canvas、process、VCS）统一通过虚拟路径（如 `/workspace/agent-a/AGENTS.md`）访问。Agent 使用标准 Read/Write 操作即可访问 VFS 路径，无需了解底层存储细节。

核心组件：
- `VfsRegistry` — 中央挂载点管理器，longest-prefix 路径解析
- `SourceFactoryRegistry` — 声明式 spec → 挂载注册 转换
- `VfsLifecycleManager` — 按生命周期策略自动卸载（daemon/agent/session/TTL/manual）
- `VfsContextProvider` — 注入 VFS 挂载信息到 agent 系统上下文

Daemon 启动时自动挂载 `/config`、`/memory`、`/canvas`；Agent 创建时自动挂载 `/workspace/<name>`。

> 类型定义：`packages/shared/src/types/vfs.types.ts`
> 核心实现：`packages/core/src/vfs/`
> 初始化入口：`packages/api/src/services/app-context.ts` → `initializeVfs()`
> RPC 契约：[api-contracts.md §3.18](../api-contracts.md)

### Multiple Launch Modes

Agent Instances support multiple launch patterns:

| Mode | Lifecycle Owner | Use Case |
|------|----------------|----------|
| Direct | User | Open IDE / TUI directly |
| ACP Background | Caller | Third-party client manages via ACP |
| ACP Service | Actant | Persistent employee agent |
| One-Shot | Actant | Execute task and auto-terminate |

---

## Reference Projects

| Project | Relevance |
|---------|-----------|
| [PicoClaw](https://picoclaw.net/) | Agent persistent integration |
| [pi-mono/ai](https://github.com/badlogic/pi-mono/tree/main/packages/ai) | Agent backend implementation |
| [ACP](https://agentclientprotocol.com/) | Agent Client Protocol framework |
| [n8n](https://n8n.io/) | Workflow automation patterns |
| [Trellis](https://github.com/mindfold-ai/Trellis) | Engineering initialization and workflow |
| [UnrealFairy](https://github.com/blackplume233/UnrealFairy) | Related project — Actant will replace its agent subsystem |

---

**Language**: See [Language Conventions](./quality-guidelines.md#language-conventions) in Quality Guidelines.
