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
- **Git Bash** (included with Git for Windows) - recommended
- **WSL** (Windows Subsystem for Linux) - also works
- These scripts are not needed for running Actant itself, only for the Trellis development workflow

### Rule: Always invoke Trellis `.sh` scripts via `bash` on Windows

**Symptom**: Running `./.trellis/scripts/task.sh` directly from PowerShell fails or behaves inconsistently.

**Cause**: PowerShell does not execute Bash scripts natively; shebang and shell features (`source`, heredoc, Bash arrays) are not interpreted as expected.

**Required pattern**:

```powershell
# Good
bash ./.trellis/scripts/get-context.sh
bash ./.trellis/scripts/task.sh list

# Bad
./.trellis/scripts/get-context.sh
./.trellis/scripts/task.sh list
```

**Scope**: Applies to command docs under `.claude/commands/` and `.cursor/commands/` as well as manual terminal usage.

### Rule: Keep docs and command markdown in UTF-8 (no BOM)

**Symptom**: Markdown tables/box-drawing characters appear as garbled text (mojibake), especially after cross-platform edits.

**Cause**: Mixed encodings (UTF-8 with BOM, local code page fallback, or non-UTF8 files) across tools.

**Required policy**:
- All docs (`*.md`, `*.mdx`, `*.txt`, `*.rst`, `*.adoc`) must be `UTF-8` without BOM.
- Keep `.sh` files LF and rely on `.gitattributes` for line-ending normalization.
- Prefer file-based scripting (`node script.mjs`) over large inline `node -e` snippets in PowerShell.

**Repository check command**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-doc-encoding.ps1
```

**Auto-fix command**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-doc-encoding.ps1 -Fix
```

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

### Common Mistake: `node -e` 内联脚本在 PowerShell 中失败（非 ASCII / 复杂脚本）

**症状**: `node -e "..."` 内联脚本含有中文字符或多行逻辑时，PowerShell 报 `SyntaxError: Invalid or unexpected token` 或字符乱码，即使代码本身语法正确。

**原因 1 — 编码问题**: PowerShell 向 `node -e` 传递参数时，非 ASCII 字符（汉字、日文等）经过 PowerShell 的代码页转换，Node.js 收到的字节串已损坏。  
**原因 2 — 转义冲突**: 反引号 `` ` ``（PS 转义符）、`$`（PS 变量前缀）与 JS 模板字符串冲突，导致参数在 Shell 层被截断。

**Fix**: 将脚本写入 `.mjs` 文件，再通过 `node` 执行：

```powershell
# Bad — 中文 / 复杂逻辑直接内联
node -e "console.log('验证 conversationId')"   # 可能输出乱码

# Good — 写文件执行
# 先 Write 工具写入 .mjs，再:
node "path/to/script.mjs"
```

**原因 3 — `<` 重定向不支持**: PowerShell 中 `<` 不是 stdin 重定向符，执行 `node --input-type=module < script.mjs` 会报 `RedirectionNotSupported`。

**Fix**: 始终以文件路径方式执行：`node "script.mjs"`。对于 `node --input-type=module`，改用临时文件而非 stdin 重定向。

### Common Mistake: PowerShell 中缺少 Unix 命令（`tail`、`grep` 等）

**症状**: `tail -n 5 file.txt` 报 `tail: command not found` 或 `CommandNotFoundException`。

**常见 Unix → PowerShell 等价命令**:

| Unix | PowerShell |
|------|-----------|
| `tail -n N file` | `Get-Content file \| Select-Object -Last N` |
| `head -n N file` | `Get-Content file \| Select-Object -First N` |
| `grep "pattern" file` | `Select-String -Path file -Pattern "pattern"` |
| `cat a b > c` | `Get-Content a,b \| Out-File c` |
| `wc -l file` | `(Get-Content file).Count` |

**规则**: QA 脚本、测试辅助命令中的 Pipeline 命令应使用 PowerShell 原生 cmdlet，而非依赖 Git Bash 别名（Git Bash 在 PowerShell 中不总是可用）。

### Common Mistake: Bash scripts with CRLF on Windows

**Symptom**: Running `.sh` scripts via `bash` on Windows Git Bash produces `$'\r': command not found` errors.

**Cause**: Git on Windows may checkout files with CRLF line endings. Bash interprets `\r` as part of the command/variable name.

**Fix**:
- Add a `.gitattributes` rule: `*.sh text eol=lf`
- For existing files: `dos2unix <file>` or configure Git: `git config core.autocrlf input`
- Agent skill scripts (`.agents/skills/*/scripts/*.sh`) are particularly affected since they're authored outside the main build pipeline

### Common Mistake: `gh issue create --body` with inline content in PowerShell

**Symptom**: `gh issue create --body "..."` with multi-line Chinese/Unicode content in PowerShell produces garbled parse errors or encoding issues.

**Fix**: Write the body to a temporary file, then use `--body-file`:

```powershell
[System.IO.File]::WriteAllText("$env:TEMP\issue-body.md", $content, [System.Text.UTF8Encoding]::new($false))
gh issue create --title "..." --body-file "$env:TEMP\issue-body.md"
```

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

### Common Mistake: External `.cmd` files and `spawn EINVAL`

**Symptom**: `child_process.spawn("claude-agent-acp.cmd", [...])` throws `spawn EINVAL` on Windows.

**Cause**: Windows cannot directly execute `.cmd` / `.bat` files via `spawn()` — they must run through `cmd.exe`. The pnpm bin link pattern (above) avoids this by resolving to the `.js` file. But for **external CLI tools** installed globally (e.g., `claude-agent-acp.cmd` from `@zed-industries/claude-agent-acp`), you don't control the entry point.

**Fix**: Use `shell: true` conditionally on Windows:

```typescript
import { isWindows } from "@actant/shared";

spawn(command, args, {
  cwd,
  stdio: ["pipe", "pipe", "pipe"],
  env,
  shell: isWindows(),
});
```

**Trade-offs**:
- `shell: true` routes through `cmd.exe`, which may interpret special characters in args. For ACP bridges where args are controlled and minimal, this is safe.
- For internal bridges (where you own the `.js` file), prefer the `process.execPath + absolute path` pattern from the section above — it avoids shell entirely.

**Decision tree**:
| Scenario | Approach |
|----------|----------|
| Internal bridge (own `.js` file) | `process.execPath` + absolute `.js` path |
| External CLI tool (`.cmd` on Windows) | `spawn()` with `shell: isWindows()` |

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

## Windows Named Pipe Idle Exit (ACP Child Processes)

> **Warning**: On Windows, a Node.js child process that communicates via named pipes will exit after ~5–15 seconds of **idleness**, even if `process.stdin.resume()` is called.
>
> **Root cause**: Windows named pipe handles become "unreferenced" when the pipe is idle (no bytes flowing). Once all handles are unreferenced, the Node.js event loop drains and the process exits naturally — despite `stdin.resume()` normally preventing this on Unix.

### When It Occurs

This affects any child process spawned by `AcpConnection` using named pipes as stdio, specifically `claude-agent-acp` and any other ACP bridge processes. The observable symptom is:

1. Agent starts and initializes (~11s for `newSession`)
2. ~5s later with no prompts → process exits silently
3. Daemon logs show the agent immediately transitions from `running` to `error`
4. User sees agent in `error` state before sending any message

### Fix: Periodic Keepalive Write

The solution is implemented in `packages/acp/src/connection.ts` (`AcpConnection`):

```typescript
// A blank NDJSON line written every 5s keeps the pipe's event loop reference alive.
// The NDJSON parser silently ignores empty lines (trimmedLine is falsy).
private startKeepalive(): void {
  if (this.keepaliveTimer) return; // idempotent
  this.keepaliveTimer = setInterval(() => {
    if (!this.child?.stdin || this.child.stdin.destroyed) {
      this.stopKeepalive();
      return;
    }
    this.child.stdin.write("\n", (err) => {
      if (err) this.stopKeepalive();
    });
  }, AcpConnection.KEEPALIVE_INTERVAL_MS); // 5_000ms

  // IMPORTANT: unref() so the timer doesn't prevent the DAEMON from exiting.
  // We only want to keep the CHILD alive, not block daemon shutdown.
  this.keepaliveTimer.unref();
}
```

**Protocol safety**: The blank `\n` is protocol-safe for NDJSON streams because every conformant parser checks `if (trimmedLine)` before attempting `JSON.parse()`. This has been verified with 7 test cases covering all positional combinations.

**Timer management rules**:
- Call `startKeepalive()` after successful ACP `initialize()` completes
- Call `stopKeepalive()` at the start of `close()` — before terminating the child
- The timer is `unref()`'d so daemon shutdown is not blocked
- `startKeepalive()` is idempotent: the `if (this.keepaliveTimer) return` guard prevents double timers
- Write errors (EPIPE) and `stdin.destroyed` both trigger automatic `stopKeepalive()`

### Checklist for New ACP Connections

When adding a new `AcpConnection`-like class that spawns a child process with pipe stdio:

- [ ] Start keepalive after `initialize()` succeeds
- [ ] Stop keepalive in `close()` before killing the child
- [ ] Use `unref()` on the timer
- [ ] Verify the child's NDJSON parser ignores blank lines

---

## Known Limitations

| Area | Status | Notes |
|------|--------|-------|
| Daemon daemonization | Partial | `detached: true` opens console on Windows |
| Shell scripts | Unix-only | Require Git Bash or WSL on Windows |
| File permissions | N/A | Windows doesn't support Unix-style permissions |
| GitNexus CLI | Crash on Windows | `query`/`context`/`impact`/`cypher` CLI 子命令因 KuzuDB native 模块兼容问题崩溃 (exit code -1073741819)。**使用 MCP 模式代替**：通过 `.cursor/mcp.json` 配置 GitNexus MCP Server，Agent 通过 MCP 工具调用同等功能，绕过 CLI 限制 |
