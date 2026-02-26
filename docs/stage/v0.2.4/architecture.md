# Actant v0.2.4 — Architecture Document

> **Actant** is "Docker for AI Agents" — a platform to build, manage, and compose AI agents with pluggable backends, declarative configuration, and a component ecosystem.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22+ / TypeScript 5.7 |
| Build | tsup (ESM) + pnpm workspaces |
| Validation | Zod |
| CLI | Commander.js |
| IPC | JSON-RPC 2.0 over Unix socket / Windows named pipe |
| Agent Protocol | ACP (Agent Client Protocol) |
| Dashboard | React 19 + Vite + Tailwind CSS + shadcn/ui |
| i18n | react-i18next + i18next-browser-languagedetector |
| REST API | Custom HTTP router (zero-dependency) |
| Testing | Vitest |
| Package Manager | pnpm 10 |
| Docs | VitePress (wiki), GitHub Pages (landing) |

## Monorepo Structure

```
packages/
├── shared/       @actant/shared      Types, logger, config helpers (foundation)
├── core/         @actant/core        Runtime engine (managers, builders, domain)
├── api/          @actant/api         Daemon, socket server, RPC handlers
├── cli/          @actant/cli         CLI frontend (commander-based)
├── acp/          @actant/acp         Agent Client Protocol adapter
├── pi/           @actant/pi          Pi — in-process lightweight agent backend
├── mcp-server/   @actant/mcp-server  Built-in MCP server with canvas tools
├── rest-api/     @actant/rest-api    Standalone RESTful API server
├── dashboard/    @actant/dashboard   Web dashboard SPA + server
└── actant/       actant              Meta-package + global binary
```

### Package Dependency Graph

```
                    ┌──────────┐
                    │  actant  │  (meta-package)
                    └────┬─────┘
          ┌──────┬───────┼───────┬──────┬──────┐
          ▼      ▼       ▼       ▼      ▼      ▼
        cli    api     core    acp    pi    mcp-server
          │      │       │       │      │      │
          │      │       │       ├──────┘      │
          │      │       │       │             │
          │    rest-api  │       │             │
          │      │       │       ▼             │
          │  dashboard   └──► shared ◄─────────┘
          └──────┘
```

## Module Architecture

### 1. `@actant/shared` — Foundation Types

Pure type definitions and shared utilities. No runtime logic.

- **Types**: `AgentInstanceMeta` (v0.2.4: +`workspaceDir`, +`startedAt`), `AgentTemplate`, `BackendDefinition`, `VersionedComponent`, `DomainContextConfig`, `SourceConfig`, `RPC method map`, `ActivityRecord`
- **Hook Types**: `HookEventName`, `HookDeclaration`, `HookAction`, `HOOK_CATEGORIES`, `BUILTIN_EVENT_META` — unified 6-layer event taxonomy
- **Utilities**: Logger (pino), IPC helpers, platform detection
- **Error hierarchy**: `ActantError` → `AgentNotFoundError`, `ConfigValidationError`, `ComponentReferenceError`, etc.

### 2. `@actant/core` — Runtime Engine

The core logic layer containing all business rules.

#### Manager (`src/manager/`)

- **AgentManager** — The central orchestrator for agent lifecycle
  - State machine: `created → starting → running → stopping → stopped`
  - Launch modes: `direct`, `acp-background`, `acp-service`, `one-shot`
  - Process ownership: `managed` (Actant spawns) or `external` (user spawns, Actant attaches)
  - Workspace policy: `persistent` or `ephemeral`
  - Archetypes: `tool`, `employee`, `service` — determines default launch mode and autoStart
  - v0.2.4: Populates `workspaceDir` and `startedAt` on start; improved prompt error messages for stopped agents
  - Methods: `createAgent`, `startAgent`, `stopAgent`, `destroyAgent`, `runPrompt`, `streamPrompt`, `resolveAgent`, `openAgent`, `attachAgent`, `detachAgent`, `promptAgent`

- **ProcessLauncher** — Spawns backend processes
- **LaunchModeHandler** — Determines behavior on process exit per launch mode
- **RestartTracker** — Manages restart policies for `acp-service` mode
- **ProcessWatcher** — Monitors process health via PID polling
- **BackendResolver** — Resolves backend commands with platform-aware logic

#### Domain (`src/domain/`)

All domain components are `VersionedComponent`s managed by `BaseComponentManager`:

| Manager | Component | Persistence Dir |
|---------|-----------|-----------------|
| `SkillManager` | `SkillDefinition` | `configs/skills/` |
| `PromptManager` | `PromptDefinition` | `configs/prompts/` |
| `McpConfigManager` | `McpServerDefinition` | `configs/mcp/` |
| `WorkflowManager` | `WorkflowDefinition` | `configs/workflows/` |
| `PluginManager` | `PluginDefinition` | `configs/plugins/` |
| `BackendManager` | `BackendDefinition` | `configs/backends/` |

#### Context Injector (`src/context-injector/`) — v0.2.4

- **SessionContextInjector** — Extensible dynamic context injection for ACP sessions
  - Collects MCP servers from registered `ContextProvider` instances
  - Injects the built-in Actant MCP Server into ACP `session/new` automatically
  - Providers can register additional MCP tools, environment variables, or session options

#### Backend System (`src/domain/backend/` + `src/manager/launcher/`)

Built-in backends:

| Backend | Modes | Binary | Notes |
|---------|-------|--------|-------|
| `cursor` | resolve, open | `cursor.cmd` / `cursor` | IDE; shell spawn |
| `cursor-agent` | resolve, open, acp | `agent` | TUI; cwd-based open |
| `claude-code` | resolve, open, acp | `claude-agent-acp.cmd` / `claude` | resolvePackage for ACP |
| `pi` | resolve, acp | in-process | First-class builtin, ACP bridge |
| `custom` | resolve | user-defined | Fallback |

#### Source System (`src/source/`)

- **SourceManager** — Manages external component repositories
- **GitHubSource** — Shallow clone from GitHub
- **LocalSource** — Reads from local directory
- **CommunitySource** — Agent Skills Open Standard compatible repositories
- Default source: `actant-hub` at `github.com/blackplume233/actant-hub.git`

#### Builder System (`src/builder/`)

Materializes agent workspaces from domain context:

- **WorkspaceBuilder** — Orchestrates 6-step pipeline: Resolve → Validate → Scaffold → Materialize → Inject → Verify
- **DeclarativeBuilder** — Driven by `MaterializationSpec` on `BackendDefinition`
- Backend-specific builders: `CursorBuilder`, `ClaudeCodeBuilder`, `PiBuilder`

#### Hook & Event System (`src/hooks/`)

Unified 6-layer event taxonomy:

| Layer | Category | Events |
|-------|----------|--------|
| System | actant | `actant:start`, `actant:stop`, `actant:error` |
| Entity | agent | `agent:created`, `agent:destroyed`, `agent:started`, `agent:stopped` |
| Runtime | process, session, prompt | `process:spawn`, `process:exit`, `session:start`, `session:end`, `prompt:sent`, `prompt:received` |
| Schedule | heartbeat | `heartbeat:tick` |
| User | user | `user:*` (custom events) |
| Extension | subsystem | `subsystem:*` (plugin-defined events) |

- **HookEventBus** — Central pub/sub with `EmitGuard`
- **HookRegistry** — Actant-level and instance-level workflow hooks
- **HookCategoryRegistry** — Extensible event taxonomy
- **ActionRunner** — Executes `ShellAction`, `BuiltinAction`, `AgentAction`

#### Scheduler (`src/scheduler/`)

- **EmployeeScheduler** — Per-agent scheduler for heartbeat, cron, hook triggers
- **TaskDispatcher** — Priority queue, sequential execution
- **ExecutionLog** — Per-agent execution history
- **InputSources**: `HeartbeatInput`, `CronInput`, `HookInput`

### 3. `@actant/api` — Daemon & Handlers

#### Daemon (`src/daemon/`)

- **Daemon** — Long-running background service
- **SocketServer** — JSON-RPC 2.0 over Unix socket / Windows named pipe
- **PidFile** — Process lock via PID file
- **AcpRelayServer** — Routes ACP session updates to CLI clients

#### Handlers (`src/handlers/`)

67+ RPC methods across 12 handler groups:

| Handler | Method Count | Key Methods |
|---------|-------------|-------------|
| template | 5 | list, get, load, unload, validate |
| agent | 16 | create, start, stop, destroy, status, list, resolve, open, attach, detach, run, prompt, adopt, dispatch, tasks, logs |
| session | 5 | create, prompt, cancel, close, list |
| domain (×5) | 25 | list, get, add, update, remove, import, export (per type) |
| source | 5 | list, add, remove, sync, validate |
| preset | 3 | list, show, apply |
| daemon | 2 | ping, shutdown |
| proxy | 3 | connect, disconnect, forward |
| gateway | 1 | lease |
| schedule | 1 | list |
| canvas | 4 | update, get, list, clear |
| activity | 2 | sessions, conversation |
| events | 3 | recent, subscribe, unsubscribe |

v0.2.4: `canvas.update` enforces employee-archetype-only gating. `activity.conversation` assembles `prompt_sent`/`prompt_complete` records.

### 4. `@actant/rest-api` — RESTful HTTP Server

Standalone HTTP server bridging REST requests to daemon JSON-RPC.

- **RpcBridge** — REST → JSON-RPC 2.0 translation via Unix socket
- **Router** — Zero-dependency HTTP router with middleware support
- **CORS + Auth** — Optional API key authentication (`Bearer` / `X-API-Key`)
- **SSE** — Server-Sent Events for real-time agent status, canvas, and event streaming
- 35+ REST endpoints covering agents, templates, domain, events, canvas, sessions, webhooks

### 5. `@actant/dashboard` — Web Dashboard

React SPA for monitoring and interacting with agents.

- **Server**: HTTP server hosting SPA static files + mounting `@actant/rest-api`
- **Client Pages**: Agents, Agent Detail, Agent Chat, Live Canvas, Events, Activity, Command Center, Settings, Not Found
- **Real-time**: SSE-based `useSSEContext` for live agent status and canvas updates
- **i18n** (v0.2.4): `react-i18next` with English and Chinese (`zh-CN`) support, language switcher in sidebar
- **Archetype gating** (v0.2.4): Live Canvas restricted to `employee` agents in both frontend and backend
- **Chat UX** (v0.2.4): Stopped agent pre-validation, disabled inputs, user-friendly error messages

### 6. `@actant/cli` — Command-Line Interface

68 subcommands organized into 17 command groups:

| Group | Commands | Description |
|-------|----------|-------------|
| agent | 17 | Full lifecycle management |
| template | 5 | Template CRUD |
| skill | 5 | Skill CRUD |
| prompt | 5 | Prompt CRUD |
| mcp | 5 | MCP server config CRUD |
| workflow | 5 | Workflow CRUD |
| plugin | 5 | Plugin CRUD |
| source | 5 | Source management |
| preset | 3 | Preset management |
| schedule | 1 | Schedule listing |
| daemon | 3 | Daemon control |
| proxy | 1 | ACP proxy |
| setup | 1 | Interactive wizard |
| self-update | 1 | Auto-update |
| dashboard | 1 | Web dashboard |
| api | 1 | REST API server |
| help | 1 | Help display |

### 7. `@actant/acp` — Agent Client Protocol

- **AcpConnection** — Manages lifecycle of one agent subprocess via ACP SDK
- **AcpConnectionManager** — Pool of connections by agent name
- **AcpCommunicator** — Implements `AgentCommunicator` over ACP
- **AcpGateway** — IDE ↔ Agent bridge
- **ClientCallbackRouter** — Routes permission requests, file operations, terminal ops
- **RecordingCallbackHandler** — Records activity for Dashboard replay

### 8. `@actant/mcp-server` — Built-in MCP Server (v0.2.4)

No longer a stub — fully functional MCP server injected into agent ACP sessions.

- **Tools**: `actant_canvas_update` (push HTML to Live Canvas), `actant_canvas_clear`
- **RPC Client** (v0.2.4): Connects to daemon via `ACTANT_SOCKET` to execute canvas RPC
- Injected automatically via `SessionContextInjector`

### 9. `@actant/pi` — Lightweight In-Process Agent

- **PiBuilder** — Workspace builder for Pi agents
- **PiCommunicator** — Direct LLM communication (Anthropic, OpenAI, etc.)
- **ACP Bridge** — `pi-acp-bridge` binary for ACP protocol compliance

## Core Data Flows

### Agent Creation Flow

```
CLI: actant agent create myagent -t template [--archetype employee]
  │
  ▼
RPC: agent.create { name, template, archetype? }
  │
  ▼
AgentManager.createAgent()
  ├── TemplateRegistry.get(templateName)
  ├── Determine archetype (explicit > template.archetype > 'tool')
  ├── AgentInitializer.initialize()
  │   ├── InitializationPipeline.execute()
  │   └── ContextMaterializer.materialize()
  │       └── WorkspaceBuilder.build(domainContext)
  ├── HookEventBus.emit('agent:created')
  └── Return AgentInstanceMeta
```

### Agent Start Flow (v0.2.4)

```
CLI: actant agent start myagent
  │
  ▼
AgentManager.startAgent()
  ├── BackendResolver.resolve(backendType)
  ├── BuildProviderEnv(backendType) → inject API keys
  ├── ProcessLauncher.launch() or AcpConnection.connect()
  ├── SessionContextInjector.collect() → inject built-in MCP Server
  ├── Update meta: workspaceDir, startedAt, status='running'
  ├── EmployeeScheduler.start() (if schedule config exists)
  └── HookEventBus.emit('process:start')
```

### Canvas Data Flow (v0.2.4)

```
Agent Process → actant_canvas_update (MCP Tool)
  → Built-in Actant MCP Server (stdio)
    → canvas.update RPC (via ACTANT_SOCKET)
      → Archetype check (employee-only)
        → CanvasStore (in-memory)
          → SSE broadcast → Dashboard iframe sandbox
```

### Hook Event Flow

```
Event Source (AgentManager / Scheduler / Plugin)
  │
  ▼
HookEventBus.emit(eventName, context, agentName?, data?)
  ├── EmitGuard — permission check (allowedCallers)
  ├── Instance-level listeners → HookRegistry
  └── Actant-level listeners → ActionRunner
      ├── ShellAction → exec with template interpolation
      ├── BuiltinAction → built-in handler
      └── AgentAction → promptAgent(target, prompt)
```

## Agent Lifecycle State Machine

```
                    ┌─────────┐
          create ──►│ created │
                    └────┬────┘
                         │ start
                    ┌────▼────┐
                    │starting │
                    └────┬────┘
              success ───┤      ├─── failure
                    ┌────▼────┐ │  ┌───────┐
                    │ running │ └─►│ error │
                    └────┬────┘    └───────┘
                         │ stop
                    ┌────▼────┐
                    │stopping │
                    └────┬────┘
                         │
                    ┌────▼────┐
          destroy ──│ stopped │
                    └─────────┘
```

**Agent Archetypes:**

| Archetype | Default Launch Mode | AutoStart | Canvas | Description |
|-----------|-------------------|-----------|--------|-------------|
| `tool` | `direct` | `false` | No | On-demand tool agents |
| `employee` | `acp-background` | `true` | **Yes** | Persistent background workers |
| `service` | `acp-service` | `true` | No | Always-on services with restart |

## Configuration Hierarchy

```
AgentTemplate
├── name, version, description
├── backend: { type, args?, env? }
├── provider: { type, protocol?, model? }
├── archetype: 'tool' | 'employee' | 'service'
├── autoStart: boolean
├── domainContext
│   ├── skills: string[]
│   ├── prompts: string[]
│   ├── mcpServers: McpServerRef[]
│   ├── subAgents: SubAgentRef[]
│   ├── workflows: string[]
│   └── plugins: string[]
├── permissions: { allow, deny, ask, defaultMode }
├── initializer: { steps[] }
├── schedule: { heartbeat?, cron?, hooks? }
└── metadata: Record<string, string>
```

## Built-in Resources

### Backends

| Name | Type | Modes |
|------|------|-------|
| cursor | IDE | resolve, open |
| cursor-agent | TUI | resolve, open, acp |
| claude-code | CLI | resolve, open, acp |
| pi | In-process | resolve, acp |
| custom | User-defined | resolve |

### Providers

| Name | Protocol |
|------|----------|
| anthropic | anthropic |
| openai | openai |
| gemini | openai |
| openrouter | openai |

## Current Version Status (v0.2.4)

### Completed (Phase 1–3 + Phase 4 partial)

- Full agent lifecycle (create, start, stop, destroy, attach, detach)
- Multi-backend support (Cursor, Claude Code, Pi, custom)
- ACP protocol integration with Direct Bridge + Session Lease
- Domain component system (6 types, CRUD, import/export)
- Source system with actant-hub + community source type
- Template/preset system
- Unified hook/event system with 6-layer taxonomy
- Scheduler (heartbeat, cron, hooks) auto-initialized on agent start
- Session lease system + gateway.lease RPC
- Permission system
- CLI with 68 subcommands across 17 groups
- Daemon with 67+ RPC methods across 12 handler groups
- Backend as VersionedComponent with declarative builder
- Agent archetypes (tool, employee, service) with autoStart
- Backend-aware provider env injection + auto-install
- **REST API server** (`@actant/rest-api`) with 35+ endpoints, SSE, webhook integration
- **Web Dashboard** (`@actant/dashboard`) — SPA with agent monitoring, chat, live canvas
- **Dashboard i18n** (v0.2.4) — react-i18next framework with English + Chinese support
- **Live Canvas** (v0.2.4) — Employee agents push HTML via MCP tool; archetype-gated
- **SessionContextInjector** (v0.2.4) — Dynamic MCP tool injection into ACP sessions
- **Built-in MCP Server** (v0.2.4) — `actant_canvas_update`, `actant_canvas_clear` tools
- **Activity system** (v0.2.4) — Conversation assembly with prompt_sent/prompt_complete
- **Chat UX** (v0.2.4) — Stopped agent pre-validation, improved error messages
- Cross-platform install scripts (Linux/macOS + Windows PowerShell)
- VitePress wiki documentation site

### In Progress (Phase 4)

- Plugin execution engine (#14)
- Advanced scheduling — 4-mode enhancement (#122)
- Workflow as Hook Package (#135)
- Agent-to-Agent Email (#136)
- Extensible Initializer (#37)
- Dashboard v1/v2/v3 iterations

### Known Limitations

- Plugin system interface not yet implemented
- Backend `existenceCheck` requires the binary to be in PATH
- Canvas content is in-memory only (lost on daemon restart)
- MCP server currently only exposes canvas tools; schedule tools planned
- Windows daemon may require `--foreground` workaround

> **Generated**: 2026-02-26 | **Commit**: 76847d3d | v0.2.4
