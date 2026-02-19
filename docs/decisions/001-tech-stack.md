# ADR-001: Technology Stack

> Architecture Decision Record — Finalized 2026-02-19

---

## Status

**Accepted**

## Context

AgentCraft is a platform for building, managing, and composing AI agents. It requires:

- CLI-first interactive REPL as the primary interface
- MCP/ACP protocol integration (both as server)
- Agent process lifecycle management (spawn, monitor, heartbeat, terminate)
- REST API for Docker deployment
- Configuration-driven composition (JSON-based templates)
- Test-driven development
- Future desktop UI and Web UI
- Integration with game engines (Unreal/Unity) via ACP

## Decision

### Core: TypeScript + pnpm Monorepo

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 LTS |
| Language | TypeScript | 5.7+ (strict mode) |
| Package Manager | pnpm | 9+ (workspace) |
| Build | tsup | latest |
| Dev Runner | tsx | latest |

### Framework & Libraries

| Purpose | Technology | Rationale |
|---------|-----------|-----------|
| CLI | Commander.js + Inquirer.js | Mature, composable |
| Schema Validation | Zod | Runtime validation + JSON Schema generation |
| Config Format | JSON | Native Node.js support, Zod JSON Schema generation, zero extra dependency |
| Process Management | execa + child_process | Cross-platform process lifecycle |
| HTTP Framework | Hono | Lightweight, TS-first, multi-runtime |
| API Documentation | @hono/zod-openapi | Auto-generate OpenAPI from Zod schemas |
| WebSocket | ws | Agent status real-time push |
| MCP SDK | @modelcontextprotocol/sdk | Official TypeScript SDK |
| Logging | pino | High-performance structured JSON logging |
| CLI Output | chalk + cli-table3 | Colored output + table formatting |

### Persistence

| Purpose | Technology | Rationale |
|---------|-----------|-----------|
| Runtime State | JSON files (per-instance) | Zero dependency, native Node.js, atomic write + rename |
| Configuration | JSON files | Version-controllable, native TS/Node.js support |

> **Evolution path**: If concurrent access or query complexity exceeds JSON file capability (>100 agents, multi-process writes), migrate `AgentStateStore` implementation to better-sqlite3 without changing the interface.

### Testing

| Purpose | Technology | Rationale |
|---------|-----------|-----------|
| Test Framework | Vitest | Native TS integration, fast, watch mode |
| Coverage | v8 (Vitest built-in) | Zero-config |

### Future UI

| Phase | Technology | Rationale |
|-------|-----------|-----------|
| Web UI | React + Vite | Ecosystem, type sharing with backend |
| Desktop | Tauri 2.0 | Lightweight (~2-10MB), reuse React frontend, Rust backend shell |

### Deployment

| Purpose | Technology |
|---------|-----------|
| Container | Docker + multi-stage build |
| CI Binary | Node.js SEA (Single Executable Application) |

## Rationale

### Why TypeScript over Rust

| Factor | TypeScript | Rust |
|--------|-----------|------|
| MCP/ACP SDK ecosystem | Official first-party SDK | Community-maintained, less mature |
| LLM Provider SDKs | All providers have official TS SDK | Mostly community SDKs |
| Development velocity | Fast iteration (no compile wait) | 5-15s incremental compile |
| Configuration composition | Dynamic types natural for reference resolution | Verbose struct manipulation |
| AI-assisted development | Highest AI code generation accuracy | Lower accuracy (lifetimes, borrows) |
| Full-stack type sharing | Frontend + Backend unified | Requires bridge layer |

### Acknowledged TypeScript Weaknesses

| Weakness | Mitigation |
|----------|-----------|
| Long-running stability (GC pauses) | PM2 supervision, memory leak detection |
| Process management at scale | Sufficient for <50 agents; extract to Rust service if bottleneck |
| CI single-binary | Node.js SEA packaging |
| Windows signal handling | execa abstraction + platform-specific tests |

### Evolution Path

```
Phase 1 (Current): Full TypeScript
  → Validate core architecture, MCP/ACP integration, config system

Phase 2 (Production): Identify bottlenecks
  → If Manager becomes perf bottleneck → Rust microservice
  → If Employee memory issues → Rust process wrapper

Phase 3 (Scale): Hybrid architecture
  → Rust: process management, heartbeat, scheduling (infrastructure)
  → TypeScript: protocols, config, API, CLI (business logic)

Desktop UI: Tauri 2.0
  → Reuse React frontend code
  → Thin Rust shell for system integration (tray, notifications, auto-start)
  → Merges naturally with Phase 3 Rust components
```

## Consequences

- All developers must use TypeScript with strict mode
- pnpm workspace enforces module boundaries
- MCP/ACP integration gets first-class SDK support
- Future desktop UI path is clear (Tauri 2.0)
- Performance-critical paths may need Rust extraction later
