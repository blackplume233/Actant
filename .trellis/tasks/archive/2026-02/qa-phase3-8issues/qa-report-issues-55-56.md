# QA Report: Issues #56 + #55 — Random-Walk Testing

**Date:** 2025-02-22  
**Scope:** InstanceRegistry system (#56), Help command / install scripts / self-update (#55)

---

## Issue #56: InstanceRegistry System

### Step 1: White-box — InstanceRegistry implementation (`packages/core/src/state/instance-registry.ts`)

| Check | Result | Notes |
|-------|--------|-------|
| `load()` creates registry.json if not exists | **WARN** | `load()` does NOT create the file on ENOENT; it initializes in-memory `{ version: 1, instances: {} }` and returns. The file is created on first `save()` (e.g. during `reconcile()`). Net effect: after `init()` → `load()` → `reconcile()`, `registry.json` exists. |
| `save()` writes atomically | **PASS** | Uses tmp path `registryPath.{uuid}.tmp`, writes, then `rename(tmpPath, registryPath)`. Atomic write pattern confirmed. |
| `register()` adds entry correctly | **PASS** | `this.data.instances[entry.name] = entry`. |
| `unregister()` removes entry | **PASS** | `delete this.data.instances[name]`, returns `true` if existed. |
| `adopt()` reads `.actant.json` and validates | **PASS** | Uses `readInstanceMeta(resolvedPath)`; validates `name` and `templateName`; throws `InstanceCorruptedError` if missing. |
| `reconcile()` marks unreachable as orphaned | **PASS** | For each entry, `stat(workspacePath)`; on error or non-directory, `updateStatus(name, "orphaned")`. |
| `reconcile()` auto-adopts unregistered builtin instances | **PASS** | Scans `builtinInstancesDir`, skips registered; for unregistered dirs with valid `.actant.json`, calls `adopt()`. |
| `updateStatus()` changes status | **PASS** | `entry.status = status` when entry exists. |

**Implementation gaps / edge cases:**
- `reconcile()` only auto-adopts from `builtinInstancesDir`; external workspaces (adopted via `agent adopt`) are not re-discovered if registry is reset.
- Path comparison `e.workspacePath === dirPath` may be sensitive to path normalization on Windows (e.g. `\` vs `/`); `join()` and `resolve()` should align in typical usage.

---

### Step 2: White-box — AppContext integration (`packages/api/src/services/app-context.ts`)

| Check | Result | Notes |
|-------|--------|-------|
| `configsDir` exists | **PASS** | `readonly configsDir: string`; `join(this.homeDir, "configs")`. |
| `sourcesDir` exists | **PASS** | `readonly sourcesDir: string`; `join(this.homeDir, "sources")`. |
| `registryPath` exists | **PASS** | `readonly registryPath: string`; `join(this.homeDir, "instances", "registry.json")`. |
| `builtinInstancesDir` exists | **PASS** | `readonly builtinInstancesDir: string`; `join(this.homeDir, "instances")`. |
| InstanceRegistry instantiated | **PASS** | `this.instanceRegistry = new InstanceRegistry(this.registryPath, this.builtinInstancesDir)`. |
| `load()` + `reconcile()` called during init | **PASS** | `await this.instanceRegistry.load()`; `await this.instanceRegistry.reconcile()`; logs orphaned/adopted. |

---

### Step 3: White-box — CLI agent adopt command

| Check | Result | Notes |
|-------|--------|-------|
| Sends correct RPC call | **PASS** | `client.call("agent.adopt", { path, rename: opts.rename })`. |
| `agent.adopt` handler exists | **PASS** | `handleAgentAdopt` in `agent-handlers.ts`; destructures `path`, `rename`; calls `ctx.instanceRegistry.adopt(path, rename)`. |

---

### Step 4: White-box — CLI agent create `--workspace` option

| Check | Result | Notes |
|-------|--------|-------|
| `--workspace` wired correctly | **PASS** | `opts.workspace ?? opts.workDir`; passed as `workDir` in `overrides` to `agent.create`. |
| Conflict handling | **PASS** | `overwrite` / `append` / interactive prompt when dir exists. |

---

### Step 5: White-box — RPC types (`packages/shared/src/types/rpc.types.ts`)

| Check | Result | Notes |
|-------|--------|-------|
| `AgentAdoptParams` exists | **PASS** | `{ path: string; rename?: string }`. |
| `AgentAdoptResult` exists | **PASS** | `{ name, template, workspacePath, location, createdAt, status }`. |
| `agent.adopt` in `RpcMethodMap` | **PASS** | Line 416: `"agent.adopt": { params: AgentAdoptParams; result: AgentAdoptResult }`. |

---

## Issue #55: Help command, install scripts, self-update

### Step 6: Black-box — Help command via CLI

| Check | Result | Notes |
|-------|--------|-------|
| `actant help` shows grouped overview | **PASS** | Sections: Quick Start, Agent Management, Component Management, Ecosystem, Scheduling, System, Tips. |
| `actant help agent` shows agent subcommands | **PASS** | Lists create, start, stop, status, list, adopt, destroy, resolve, attach, detach, run, prompt, chat, dispatch, tasks, logs. |

---

### Step 7: White-box — Install scripts

| Check | Result | Notes |
|-------|--------|-------|
| `scripts/install.sh` — Node.js check | **PASS** | `node -v`, requires >= 22. |
| `scripts/install.sh` — pnpm check | **PASS** | `pnpm -v`, requires >= 9. |
| `scripts/install.sh` — build, link | **PASS** | `pnpm install`, `pnpm build`, `pnpm --filter @actant/cli link --global`. |
| `scripts/install.sh` — creates directories | **PASS** | `mkdir -p` for configs, instances, sources, logs, backups. |
| `scripts/install.sh` — idempotent | **PASS** | `mkdir -p`; config.json only if `[[ ! -f "$CONFIG_FILE" ]]`. |
| `scripts/install.ps1` — equivalent | **PASS** | Same checks, `New-Item -Force`, `Test-Path` for config.json. |
| `scripts/install.ps1` — idempotent | **PASS** | `New-Item -Force`; config only when `-not (Test-Path $ConfigFile)`. |

---

### Step 8: White-box — Self-update script

| Check | Result | Notes |
|-------|--------|-------|
| `scripts/self-update.js` — 7-phase process | **PASS** | pre-check → backup → build → link → verify → daemon-restart → agent-check. |
| `packages/cli/src/commands/self-update.ts` — CLI command | **PASS** | `createSelfUpdateCommand()`; options: `--source`, `--check`, `--force`, `--dry-run`, `--no-agent`, `--skip-build`. |
| `cleanOldBackups` logic | **WARN** | Uses `dirs.slice(maxBackups - 1)`; with `maxBackups = 3`, removes from 3rd-oldest onward, leaving 2 backups instead of 3. Expected: `dirs.slice(maxBackups)`. |

---

### Step 9: White-box — Getting-started docs

| Check | Result | Notes |
|-------|--------|-------|
| Prerequisites | **PASS** | Node.js >= 22, pnpm >= 9, Claude Code CLI, Cursor IDE. |
| Install instructions | **PASS** | Quick install (bash/ps1), manual install. |
| First steps | **PASS** | daemon start, browse components, create agent, start/chat, stop. |
| Configuration | **PASS** | `config.json` structure, `devSourcePath`. |
| Getting help | **PASS** | `actant help`, `actant help <command>`. |
| Common issues | **PASS** | command not found, daemon connection, permission errors. |

---

## Summary

| Category | PASS | WARN | FAIL |
|----------|------|------|------|
| #56 InstanceRegistry | 18 | 1 | 0 |
| #55 Help / install / self-update | 17 | 1 | 0 |

### WARN items
1. **#56:** `load()` does not create `registry.json` when missing; file is created on first `save()` during `reconcile()`. Behavior is acceptable.
2. **#55:** `cleanOldBackups` in `scripts/self-update.js` may keep one fewer backup than intended; consider `dirs.slice(maxBackups)`.

### Recommendations
- Add unit tests for `InstanceRegistry` (load/save/register/unregister/adopt/reconcile/updateStatus).
- Fix `cleanOldBackups` slice to preserve `maxBackups` backups correctly.
