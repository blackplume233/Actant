# Cross-Platform Compatibility Guide

> **Goal**: Actant must run on Linux, macOS, and Windows. Every feature must work on all three platforms.

---

## Platform Utilities

All platform-specific logic is centralized in `packages/shared/src/platform/platform.ts`.

**Never write platform-specific code inline.** Always use the shared utilities:

| Utility | Purpose |
|---------|---------|
| `getDefaultIpcPath()` | Default daemon IPC path (Unix socket or Windows named pipe) |
| `getIpcPath(homeDir)` | IPC path for a given home directory |
| `ipcRequiresFileCleanup()` | Whether stale IPC files need `unlink` before listening |
| `onShutdownSignal(handler)` | Cross-platform graceful shutdown (SIGINT/SIGTERM/SIGBREAK) |
| `isWindows()` | Platform check |

---

## IPC: Unix Sockets vs Named Pipes

| Platform | IPC Mechanism | Path Format |
|----------|--------------|-------------|
| macOS/Linux | Unix domain socket | `~/.actant/actant.sock` |
| Windows | Named pipe | `\\.\pipe\actant` |

Node.js `net.createServer` and `net.createConnection` handle both transparently — the only difference is the path string.

**Rules**:
- Never hardcode `.sock` paths. Use `getIpcPath()` or `getDefaultIpcPath()`.
- Before listening on Unix sockets, call `unlink()` to remove stale files — but only when `ipcRequiresFileCleanup()` returns true.
- Named pipes on Windows are automatically cleaned up when the server closes.

---

## Signal Handling

| Signal | macOS/Linux | Windows |
|--------|-------------|---------|
| `SIGINT` | Ctrl+C | Ctrl+C (terminal only) |
| `SIGTERM` | Standard termination | **Not supported** |
| `SIGBREAK` | Not available | Ctrl+Break |

**Rules**:
- Never use `process.on("SIGTERM", ...)` directly. Use `onShutdownSignal()` from shared.
- `onShutdownSignal()` registers SIGINT + SIGTERM on Unix, SIGINT + SIGBREAK on Windows.

---

## Process Management

### Daemonization

`fork()` with `detached: true` behaves differently:
- **Unix**: Creates a new process group/session (true daemon)
- **Windows**: Creates a new console window

This is acceptable for now. Future consideration: Windows service integration for production.

### Process Existence Check

`process.kill(pid, 0)` works cross-platform in Node.js for checking if a process exists.

---

## Symlinks and Junctions

Custom `workDir` instances use a link from `{instancesDir}/{name}` → target directory.

| Platform | Link Type | Privileges |
|----------|-----------|------------|
| macOS/Linux | Symbolic link (`"dir"`) | Normal user |
| Windows | Junction (`"junction"`) | Normal user |

Windows directory symlinks (`"dir"`) require Administrator or Developer Mode. Junctions have no such restriction and behave identically for our use case — `lstat().isSymbolicLink()` returns `true`, and `readlink()` returns the target path.

**Rules**:
- Use `process.platform === "win32" ? "junction" : "dir"` as the symlink type.
- Remove links with `rm(path, { recursive: true, force: true })` instead of `unlink()` — `unlink` fails on Windows junctions.
- When comparing `readlink()` results, normalize with `path.resolve()` to handle platform path differences.

---

## File System

### Path Handling

- **Always** use `node:path` (`join`, `resolve`, `dirname`) — never concatenate with `/` or `\`.
- `homedir()` from `node:os` returns the correct home on all platforms.
- `tmpdir()` from `node:os` returns platform-appropriate temp directory.

### File Operations

- `fs.rename()` across volumes may fail on Windows. The atomic write pattern in `instance-meta-io.ts` (write tmp then rename) works because both files are in the same directory.
- File paths on Windows are case-insensitive but case-preserving. Avoid relying on case sensitivity for file lookups.

---

## Shell Scripts (.trellis/scripts/)

The `.trellis/scripts/*.sh` files are Bash scripts for the development workflow (not runtime).

**Windows requirements**:
- **Git Bash** (included with Git for Windows) — recommended
- **WSL** (Windows Subsystem for Linux) — also works
- These scripts are not needed for running Actant itself, only for the Trellis development workflow

### Common Mistake: pnpm/node not found in Git Bash

**Symptom**: `stage-version.sh` commands fail with `pnpm: command not found` or `node: command not found`

**Cause**: Git Bash has an isolated PATH that doesn't include Windows-installed tools like pnpm (installed via npm/corepack) or sometimes node.

**Fix**: Run the corresponding `.mjs` scripts directly in PowerShell using `node`:

```powershell
node .trellis/scripts/gen-surface-snapshot.mjs docs/stage/v0.1.2
node .trellis/scripts/gen-metrics-snapshot.mjs docs/stage/v0.1.2
node .trellis/scripts/gen-issue-snapshot.mjs v0.1.2
```

For pnpm commands, use `npx pnpm <cmd>` in PowerShell.

### Common Mistake: PowerShell syntax limitations

**Symptom**: `&&` chains, heredoc (`<<'EOF'`), or `<` in strings cause parse errors.

**Fix**:
- Replace `&&` with `;` or separate commands
- Write multi-line content to a temp file, then `git commit -F <file>`
- Avoid `<` in inline strings (e.g. email addresses in git trailers)

### Common Mistake: pnpm bin link `EINVAL` on Windows

**Symptom**: `child_process.spawn()` of a pnpm monorepo binary (e.g. `pi-acp-bridge`) throws `spawn EINVAL` on Windows.

**Cause**: pnpm creates `.cmd` shim files as bin links in `node_modules/.bin/`. When passed to `child_process.spawn()` without `shell: true`, Windows cannot execute these `.cmd` files and returns `EINVAL`.

**Fix**: Do not spawn pnpm bin links directly. Instead, resolve the target `.js` file's absolute path and spawn it with `process.execPath` (the Node.js executable):

```typescript
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BRIDGE_PATH = join(dirname(fileURLToPath(import.meta.url)), "acp-bridge.js");

// In the BackendDescriptor acpResolver:
acpResolver: () => ({
  command: process.execPath,   // e.g. "C:\Program Files\nodejs\node.exe"
  args: [BRIDGE_PATH],         // absolute path to the .js file
})
```

This works cross-platform and avoids all `.cmd` shim issues.

### Common Mistake: ACP SDK message format

When implementing an ACP Agent-side bridge (e.g. `acp-bridge.ts`), the following format details are critical:

**1. `PromptRequest` content field**

The user's prompt text is in `params.prompt` (an array of content blocks), **not** `params.content`:

```typescript
// ✅ Correct
const text = params.prompt
  .filter((b: { type: string }) => b.type === "text")
  .map((b: { text: string }) => b.text)
  .join("\n");

// ❌ Wrong — params.content does not exist
const text = params.content;
```

**2. `SessionNotification` format**

`AgentSideConnection.sessionUpdate()` expects the full `SessionNotification` object with nested `update` structure:

```typescript
// ✅ Correct format
conn.sessionUpdate({
  sessionId,
  update: {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: chunk },
  },
});

// ❌ Wrong — flat structure without nesting
conn.sessionUpdate({
  sessionId,
  type: "text",
  textDelta: chunk,
});
```

**3. Avoid duplicate final messages**

The ACP client collects streaming chunks automatically. Do not send a final "complete" message that repeats the accumulated text — it will cause duplicate output.

---

## Public-Facing Install Instructions

所有面向用户的安装指南（README、Landing Page、Getting Started）都必须展示多平台安装方式。

**推荐顺序**（官方安装脚本优先）：

| 平台 | 命令 | 说明 |
|------|------|------|
| Linux / macOS | `curl -fsSL .../scripts/install.sh \| bash` | 自动检测环境 + 配置向导 |
| Windows | `irm .../scripts/install.ps1 \| iex` | PowerShell 等效脚本 |
| npm (fallback) | `npm install -g actant` | 通用方式，跳过配置向导 |

**Rules**:
- 安装脚本是推荐方式（会自动运行 `actant setup`），npm 直装为 fallback
- Landing Page 使用 tab 切换展示三种方式，默认选中 Linux/macOS
- npm 包名始终为 `actant`（门面包），不使用 `@actant/cli`
- 脚本 URL 指向 `master` 分支，会随每次版本发布自动更新

---

## Interactive Prompts (Non-TTY Behavior)

> **Warning**: `@inquirer/prompts` hangs indefinitely when stdin is not a TTY (e.g., piped input, CI environments, automated tests).

When stdin is closed or non-interactive, `@inquirer/prompts` does not immediately throw `ExitPromptError`. Instead, it blocks waiting for input until the process is killed or stdin emits `end`. The `isUserCancellation()` handler in `setup.ts` correctly catches the eventual error, but the delay makes automated testing impractical.

**Mitigation**: The `setup` command provides `--skip-*` flags for each interactive step, enabling fully non-interactive execution:

```bash
actant setup --skip-home --skip-provider --skip-source --skip-agent --skip-autostart --skip-hello --skip-update
```

**Future consideration**: Add a global `--non-interactive` flag or detect `!process.stdin.isTTY` to auto-skip all interactive prompts with sensible defaults.

---

## JSON File Writing (UTF-8 BOM)

> **Warning**: PowerShell's `[System.IO.File]::WriteAllText()` and `Set-Content` write UTF-8 with BOM by default on Windows. JSON parsers in Node.js (`JSON.parse`) will reject the BOM character as invalid JSON.

**Symptom**: `actant template load <file>` fails with "Invalid JSON" on a file that looks correct in a text editor.

**Cause**: The file starts with `\xEF\xBB\xBF` (UTF-8 BOM), which is invisible in most editors but rejected by strict JSON parsers.

**Fix**: When writing JSON files in PowerShell for consumption by Node.js:

```powershell
# Explicit UTF-8 without BOM
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
```

**In Node.js code**: This is not an issue — `fs.writeFileSync` with `"utf-8"` encoding does not add a BOM.

---

## Checklist for New Features

Before implementing any feature, verify:

- [ ] No hardcoded Unix socket paths (use `getIpcPath()`)
- [ ] No direct `SIGTERM` handlers (use `onShutdownSignal()`)
- [ ] File paths use `node:path` (`join`, not string concatenation)
- [ ] No shell commands that only work on Unix (e.g., `chmod`, `ln -s`)
- [ ] Symlinks use `"junction"` type on Windows, `"dir"` on Unix (see Symlinks section)
- [ ] Tests use `getIpcPath()` for socket paths
- [ ] If spawning child processes, handle Windows `.cmd` / `.bat` extensions for npm scripts

---

## Known Limitations

| Area | Status | Notes |
|------|--------|-------|
| Daemon daemonization | Partial | `detached: true` opens console on Windows |
| Shell scripts | Unix-only | Require Git Bash or WSL on Windows |
| File permissions | N/A | Windows doesn't support Unix-style permissions |
