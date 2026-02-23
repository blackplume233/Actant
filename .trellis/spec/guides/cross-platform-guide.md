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
