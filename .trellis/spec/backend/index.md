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
│   ├── Plugin Module       # [Phase 4] PluginHost + 三插口 Plugin 体系
│   ├── Hook Module         # [Phase 4] HookEventBus + HookRegistry + ActionRunner
│   ├── Scheduler Module    # [Phase 3c+4] EmployeeScheduler + 四模式调度
│   └── Email Module        # [Phase 4] EmailHub + Agent-to-Agent 通信
│
├── Actant ACP          # Agent Client Protocol server
│
├── Actant MCP          # MCP server + Schedule MCP Tools
│
├── Actant Pi           # Pi Agent backend integration (optional)
│
├── Actant API          # RPC API layer (JSON-RPC over IPC)
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

1. **Documentation-First（文档先行）**: 任何功能扩展或修改，**必须先输出文档、定义接口、确定配置结构，再编写实现代码**。文档、契约、接口、配置是项目的主要产出，代码是对它们的实现。详见 [Documentation-First 开发模式](./quality-guidelines.md#documentation-first-开发模式)。
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
| [Plugin 预定设计](./plugin-guidelines.md) | **[Phase 4 预定]** Plugin / Hook / Scheduler / Memory 预定设计草案，实施前须重新审查 | **Preliminary** |

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
