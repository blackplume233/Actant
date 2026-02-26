<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

Use the `/trellis:start` command when starting a new session to:
- Initialize your developer identity
- Understand current project context
- Read relevant guidelines

Use `@/.trellis/` to learn:
- Development workflow (`workflow.md`)
- Project structure guidelines (`spec/`)
- Developer workspace (`workspace/`)

## Code Intelligence (GitNexus MCP)

本项目已索引代码知识图谱（2091 符号、5354 关系、144 执行流）。
**修改核心模块前必须执行 impact 分析**。详见 `workflow.md` §Development Process。
索引过期时执行 `npx gitnexus analyze`。

Keep this managed block so 'trellis update' can refresh the instructions.

<!-- TRELLIS:END -->

## Cursor Cloud specific instructions

### Overview

Actant is a pure Node.js/TypeScript monorepo (pnpm workspaces, 8 packages) for building and orchestrating AI agents. No Docker, no database, no external services required for development or testing.

### Key commands

Standard dev commands are in the root `package.json` and documented in `README.md` § 开发 and `docs/guides/dev-environment-setup.md`. Key ones:

- **Build**: `pnpm build` (required before running CLI from `dist/`)
- **Dev mode**: `pnpm dev` (runs CLI via tsx, no build needed)
- **Test**: `pnpm test` (830 tests, ~14s) or `pnpm test:changed` for incremental
- **Lint**: `pnpm lint`
- **Type-check**: `pnpm type-check`

### Non-obvious caveats

- **Build before test/run**: Cross-package imports reference `dist/` outputs. You must run `pnpm build` after `pnpm install` before tests or the CLI will work. `pnpm dev` is the exception (uses tsx for on-the-fly compilation).
- **Mock launcher mode**: Set `ACTANT_LAUNCHER_MODE=mock` when running the daemon/CLI without a real agent backend (Claude Code / Cursor). This enables the full agent lifecycle with a mock process.
- **`pnpm install` bin warnings**: After a clean install (before build), pnpm warns about missing bin files (e.g. `actant.js`, `acp-bridge.js`). These resolve after `pnpm build`.
- **IPC sockets**: The daemon communicates via Unix domain sockets (auto-created). No port configuration needed.
- **No git hooks**: The repo has no husky / pre-commit hooks configured.
