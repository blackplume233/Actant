# Directory Structure

> How frontend code (CLI and future UI) is organized in AgentCraft.
>
> **Canonical reference**: See [ADR-002](../../../docs/decisions/002-directory-structure.md) for the full project directory structure.

---

## Overview

AgentCraft's frontend is split across phases. The CLI package is the current primary interface. Web UI and Tauri Desktop are planned for later phases.

---

## CLI Package (`@agentcraft/cli`)

```
packages/cli/
├── src/
│   ├── commands/                # Command implementations
│   │   ├── agent/               # agent create|list|start|stop|status|logs
│   │   ├── template/            # template create|list|edit|validate
│   │   ├── skill/               # skill add|list|remove
│   │   ├── config/              # config get|set|list
│   │   └── index.ts             # Command registry
│   ├── repl/                    # Interactive REPL loop
│   │   ├── repl.ts
│   │   ├── history.ts
│   │   └── completion.ts
│   ├── output/                  # Output formatters
│   │   ├── formatter.ts         # Base interface
│   │   ├── table.ts
│   │   ├── json.ts
│   │   └── text.ts
│   ├── errors/                  # CLI error presentation
│   │   └── error-presenter.ts
│   └── index.ts
├── bin/
│   └── agentcraft.ts            # CLI entry point (#!/usr/bin/env node)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Future: Web UI Package (`@agentcraft/web`)

> Phase 2 — React + Vite, consumes `@agentcraft/api` via REST.

```
packages/web/                    # (future)
├── src/
│   ├── app/                     # App shell, routing
│   ├── pages/
│   │   ├── agents/
│   │   ├── templates/
│   │   └── dashboard/
│   ├── components/
│   │   ├── common/
│   │   └── agent/
│   ├── hooks/
│   ├── services/                # API client (uses @agentcraft/shared types)
│   ├── stores/
│   └── types/
├── public/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Future: Tauri Desktop (`@agentcraft/desktop`)

> Phase 3 — Tauri 2.0 shell wrapping Web UI, adds system tray, notifications, auto-start.

```
packages/desktop/                # (future)
├── src/                         # Reuses packages/web as frontend
├── src-tauri/                   # Rust shell (thin layer)
│   ├── src/
│   │   └── main.rs              # IPC commands, system integration
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── tsconfig.json
```

---

## Code Sharing Strategy

```
packages/shared/src/types/    ← Shared type definitions
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
  cli/            api/            web/ (future)
```

All frontends import types from `@agentcraft/shared`. No direct type duplication.
