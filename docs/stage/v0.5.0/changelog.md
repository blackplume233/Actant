# v0.5.0 Changelog — Phase B Context-First Architecture

> Released: 2026-03-18
> Tag: `v0.5.0`
> Predecessor: v0.4.0

## Summary

Implements the Context-First Multi-Source Architecture. The platform's context
management shifts from static pre-assembly (SessionContextInjector) to dynamic
VFS-backed discovery via ContextManager.

## Breaking Changes

- **`@actant/core` renamed to `@actant/agent-runtime`** (package name only;
  physical directory `packages/core` preserved). All imports must update:
  ```
  - import { ... } from "@actant/core"
  + import { ... } from "@actant/agent-runtime"
  ```
- `AgentTemplate.rules` and `AgentTemplate.toolSchema` are new fields.
  Templates using older schemas still work (both fields are optional).

## New Packages

### `@actant/context`

Platform-core package for the Context-First architecture.

- **`ContextManager`** — Multi-source context aggregation hub.
  Manages `ContextSource` registration, VFS mount projection, and
  Tool registration for Agent-as-Tool.
- **`DomainContextSource`** — Projects domain components (skills,
  prompts, workflows, templates, mcp configs) as a single VFS source.
- **`AgentStatusSource`** — Projects Internal Agent status and
  toolSchema into `/agents/` VFS, enabling Agent-as-Tool discovery.
- **`ProjectSource`** — Projects project overview and module info.
- **`UnrealProjectSource`** — Projects Unreal Engine project context.

## Features

### B-1: ContextManager Core

- `ContextSource` interface with `toVfsMounts()` for VFS projection
- `ToolRegistration` interface for Agent-as-Tool
- `ContextManagerEvents` listener API for observability
- `mountSources()` / `unmountAll()` / `refreshChanged()` for VFS lifecycle

### B-2: Agent Integration

- **Agent→Tool 回注**: When an agent with `toolSchema` starts,
  it auto-registers as a ContextManager tool. Unregistered on stop/crash.
- **AgentStatusSource wiring**: `AgentManager` wrapped as `AgentStatusProvider`,
  registered on `ContextManager` at daemon init.
- **ContextManager VFS mount**: All ContextManager sources projected into
  VfsRegistry at init, including agent-status under `/agents/`.

### B-3: AgentTemplate Extensions

- `rules: string[]` — Behavioral rules injected into system prompt
  by `RulesContextProvider`.
- `toolSchema: Record<string, unknown>` — Input JSON Schema for
  exposing the agent as an MCP Tool.
- `toAgentTemplate()` maps both new fields (#301 fix).

### B-4: Project Context Sharing

- `HubContextService` for project-scoped VFS mounts.
- Standalone MCP server with project context discovery.
- `ProjectContextFactoryRegistry` for pluggable project file handling.
- Empty-directory bootstrap validation (#298).

### Deprecated Modules (Phase C cleanup)

The following modules are marked `@deprecated` and retained during
migration. They will be removed once all agents migrate to the
ContextManager path:

| Module | Replacement |
|--------|------------|
| `SessionContextInjector` | ContextManager VFS-based discovery |
| `CoreContextProvider` | AgentServer fixed rules + ContextManager |
| `CanvasContextProvider` | AgentServer-internal capability |
| `VfsContextProvider` | ContextManager MCP Server |
| `ActivityRecorder` | `RecordSystem` |
| `HookInput` | `HookEventBus` + `HookRegistry` |

## Stats

- 119 test files, 1362 tests, 0 failures
- 14 packages at version 0.5.0
