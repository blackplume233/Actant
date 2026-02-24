# Quality Guidelines

> Code quality standards for Actant backend development.

---

## Overview

Actant follows a **test-driven, review-enforced** quality model. Every feature exposed as CLI operation or configuration must have comprehensive tests. Code quality and extensibility are verified through dedicated review before merge.

---

## Development Workflow

```
Design → Confirm → Implement → Test → Review → Commit
```

1. **Design first**: Explicit design document or spec before coding
2. **Confirm**: Design reviewed and approved before implementation
3. **Implement**: Small, focused increments (one commit = one coherent change)
4. **Test**: All CLI/config behaviors covered by unit tests
5. **Review**: Dedicated review for quality, extensibility, maintainability
6. **Commit**: Only after all checks pass

---

## Forbidden Patterns

### Don't: Tight Coupling Between Modules

```typescript
// Bad — API module directly imports core internals
import { AgentState } from '../../core/manager/state/internal-state';

// Good — API module uses core's public API
import { getAgentState } from '@actant/core';
```

**Why**: Modules must communicate through public interfaces. Internal details change frequently.

### Don't: Hardcoded Domain Context

```typescript
// Bad — Skill content embedded in code
const skill = { rules: "Always respond in JSON..." };

// Good — Skill loaded from configuration
const skill = await skillManager.load("json-response");
```

**Why**: Domain Context must be configurable and reusable. Hardcoded content cannot be composed.

### Don't: Skip Error Handling on Agent Lifecycle Operations

```typescript
// Bad — Fire and forget
agentManager.launch(instance);

// Good — Handle lifecycle errors
try {
  await agentManager.launch(instance);
} catch (error) {
  if (error instanceof AgentLaunchError) {
    logger.error("Agent launch failed", { instanceId, error });
    await agentManager.cleanup(instance);
  }
  throw error;
}
```

**Why**: Agent lifecycle failures can leave orphaned processes and corrupted state.

### Don't: Centralized Backend-Specific Logic

```typescript
// Bad — hardcoded if/else for each backend in a central function
function buildProviderEnv(provider: ModelProviderConfig, backendType: string) {
  if (backendType === "pi") {
    env["ACTANT_API_KEY"] = provider.apiKey;
  } else if (backendType === "claude-code") {
    env["ANTHROPIC_API_KEY"] = provider.apiKey;
  } else if (backendType === "cursor-agent") {
    // ...more hardcoding
  }
}

// Good — each backend self-describes via BackendDescriptor strategy
registerBackend({
  type: "claude-code",
  supportedModes: ["resolve", "acp"],
  buildProviderEnv: (provider) => ({
    ANTHROPIC_API_KEY: provider.apiKey,
  }),
});
// AgentManager queries the descriptor, no if/else
const env = descriptor.buildProviderEnv?.(providerConfig) ?? defaultEnv;
```

**Why**: Adding a new backend should not require modifying core manager code. Backend-specific behavior belongs in the backend's own registration descriptor. This follows the same open-closed pattern as `acpResolver` and `resolveCommand`. ACP protocol's `SessionConfigOption` covers model/thinking_level switching but NOT credentials — API Keys can only be injected via env vars at spawn time, so each backend must declare its own expected variable names.

### Don't: Hardcode Backend-Specific Knowledge in Generic Layers

```typescript
// Bad — ACP layer knows about specific backend packages
const KNOWN_ACP_PACKAGES: Record<string, string> = {
  "claude-agent-acp": "@zed-industries/claude-agent-acp",
  "claude-code-acp": "@zed-industries/claude-code-acp",
};
export function resolveAcpBinary(command: string) {
  const pkg = KNOWN_ACP_PACKAGES[command]; // hardcoded lookup
  // ...
}

// Good — backend declares its dependency, resolver is generic
registerBackend({
  type: "claude-code",
  resolvePackage: "@zed-industries/claude-agent-acp",
  // ...
});
// binary-resolver receives resolvePackage as a parameter
export function resolveAcpBinary(command: string, resolvePackage?: string) {
  // generic resolution — no backend-specific knowledge
}
```

**Why**: Generic layers (`@actant/acp`, `binary-resolver`) provide **mechanisms**, not **policy**. When the ACP layer hardcodes a map of backend→package, adding a new backend requires modifying the ACP package — violating the open-closed principle. By letting each backend declare `resolvePackage` in its `BackendDescriptor`, the knowledge stays where it belongs: in the backend registration.

### Don't: `any` Types

```typescript
// Bad
function processConfig(config: any) { ... }

// Good
function processConfig(config: AgentTemplateConfig) { ... }
```

**Why**: Actant composes many dynamic components. Type safety is the primary guard against misconfiguration.

### Don't: `console.log`

Use the project logger instead. See [Logging Guidelines](./logging-guidelines.md).

### Don't: Non-null Assertions (`!`)

```typescript
// Bad
const agent = registry.get(id)!;

// Good
const agent = registry.get(id);
if (!agent) {
  throw new AgentNotFoundError(id);
}
```

---

## Required Patterns

### CLI-First Implementation

Every feature must be implementable and testable via CLI before any UI integration.

```typescript
// Good — Command logic is separated from CLI parsing
export class CreateTemplateCommand {
  async execute(options: CreateTemplateOptions): Promise<TemplateResult> {
    // Pure business logic, no CLI I/O
  }
}

// CLI adapter calls the command
program.command('template create')
  .action(async (opts) => {
    const cmd = new CreateTemplateCommand();
    const result = await cmd.execute(opts);
    formatter.output(result);
  });
```

### Reference-Based Composition

Domain Context components are always referenced by name, never embedded.

```typescript
// Good — Template references skills by name
const template: AgentTemplate = {
  skills: ["code-review", "typescript-expert"],
  mcp: ["filesystem", "github"],
  workflow: "trellis-standard",
};
```

### Single Source of Truth for Release Metrics

README.md 和 GitHub Pages 中的统计数字（LOC、Tests、RPC methods、CLI commands）**必须**从 `docs/stage/<version>/` 下的 JSON 产物中提取，不得手工计数。

| 指标 | 数据源 | JSON 路径 |
|------|--------|-----------|
| Lines of Code | `metrics.json` | `totals.lines` |
| Tests / Suites | `test-report.json` | `summary.tests` / `summary.testFiles` |
| RPC Methods | `api-surface.json` | `rpc.methodCount` |
| CLI Commands | `api-surface.json` | `cli.totalSubcommands` |

**Why**: 手工计数容易与实际不符，且版本间无法追踪变化。stage 产物是自动提取的，作为统一数据源可确保 README、Pages、Release Notes 之间的数字一致性。

### CLI Exit Code Consistency

Every CLI command must return a non-zero exit code when the operation does not succeed, even if the failure is "soft" (no exception thrown).

```typescript
// Good — logical failure sets exit code
if (!result.queued) {
  printer.dim("No scheduler for agent.");
  process.exitCode = 1;
}

// Bad — prints failure message but exits 0
if (!result.queued) {
  printer.dim("No scheduler for agent.");
  // caller sees exit code 0, cannot detect failure
}
```

**Why**: QA automation, shell scripts, and CI pipelines rely on exit codes to determine success/failure. A non-zero exit code is the only reliable contract.

**Rule**: For each CLI command, enumerate all execution paths and ensure every "unhappy path" sets `process.exitCode = 1` (or throws, which the global error handler converts to non-zero).

### Non-Interactive Testability (--skip-* Pattern)

Interactive CLI commands (wizards, prompts) must provide `--skip-*` flags to enable fully non-interactive execution for QA automation.

```typescript
// Good — each interactive step has a skip flag
.option("--skip-home", "Skip work directory selection")
.option("--skip-provider", "Skip model provider configuration")
```

**Why**: Interactive prompts (`@inquirer/prompts`) hang in non-TTY environments. Without skip flags, the command cannot be tested in CI or by QA scripts.

**Rule**: Any command that uses `@inquirer/prompts` or similar interactive input must:
1. Provide `--skip-<step>` flags for each interactive section
2. Use sensible defaults when a step is skipped (e.g., `ACTANT_HOME` from env)
3. Ensure the skipped path still creates necessary artifacts (directories, config files)
4. Be idempotent — running the command multiple times with the same flags produces the same result

### Deduplication in Recursive Validation

When validating assets that can be discovered through multiple paths (e.g., manifest explicit list + directory scan), always track already-validated files to avoid duplicating issues.

```typescript
// Good — track validated files to avoid duplicates
const validatedFiles = new Set<string>();

for (const file of manifestFiles) {
  validatedFiles.add(file);
  validate(file);
}

for (const file of directoryScan) {
  if (validatedFiles.has(file)) continue; // skip already validated
  validatedFiles.add(file);
  validate(file);
}

// Bad — validate without dedup, same file processed twice
for (const file of manifestFiles) { validate(file); }
for (const file of directoryScan) { validate(file); } // duplicates!
```

**Why**: Sources have both explicit file lists in `actant.json` and auto-scanned directory contents. Without dedup, the same component gets validated twice, producing duplicate warnings/errors and inflated pass counts.

### Static Validation vs Runtime Registry

Static validation tools (like `source validate`) run without the full application context. Singletons populated at startup (e.g., `modelProviderRegistry`) are empty during static validation. Design validation to be resilient to this.

```typescript
// Good — optional field that's resolved at runtime
{
  "backend": { "type": "claude-code" },
  "domainContext": { "skills": ["code-review"] }
}
// provider is omitted; resolved at runtime from config.json

// Caution — provider type warning in static validation
{
  "provider": { "type": "anthropic" }
}
// Static validator warns: "anthropic is not registered"
// because modelProviderRegistry is empty at validation time
```

**Why**: Example templates and hub content should validate cleanly in CI without running the full daemon. Avoid fields that depend on runtime state in static assets unless necessary.

### External Standard Compatibility via Opt-in Validation

When adding compatibility with an external standard (e.g., Agent Skills), use an opt-in `compat` flag rather than changing default behavior. This preserves backward compatibility while enabling stricter checks.

```typescript
// Good — compat mode is opt-in, default behavior unchanged
interface ValidateOptions {
  strict?: boolean;
  compat?: "agent-skills";  // discriminated union for future standards
}

// Validator branches on compat mode
if (compat === "agent-skills") {
  this.validateAgentSkillsCompat(skill, relPath, issues, parentDirName);
} else {
  // existing default checks (e.g., description as warning, not error)
}
```

```typescript
// Bad — changing default behavior to match external standard
// breaks existing users who don't care about that standard
```

**Why**: External standards evolve independently from the project's own schema. Layering compat checks on top of base validation keeps the base stable and lets users opt in when they need interoperability.

### Hub Component Portability

共享 source 仓库（如 actant-hub）面向不同配置的用户。设计组件时应最大化可移植性：

**Templates — 省略 `provider` 字段**。让用户 `config.json` 中配置的默认 Provider 生效。

```json
// Good — provider-agnostic, works for all users
{ "backend": { "type": "claude-code" }, "domainContext": { "skills": ["code-review"] } }

// Bad — locks template to Anthropic, non-Anthropic users must manually override
{ "backend": { "type": "claude-code" }, "provider": { "type": "anthropic" }, "domainContext": { ... } }
```

**Skills — JSON 与 SKILL.md 字段保持一致**。如果 SKILL.md 声明了 `license: MIT`，对应 JSON 也应包含 `"license": "MIT"`。两种格式的元数据应始终同步。

**Validation — 在 CI 中运行严格 Agent Skills 验证**：

```bash
actant source validate --path . --compat agent-skills --strict
```

此命令递归校验所有组件（manifest、schema、cross-reference、template semantics），strict 模式将 warning 提升为 error。actant-hub 已通过此验证（16 组件全部通过）。

**开发约定 — 直接操作 actant-hub 仓库**：

Hub 相关的修改（组件增删、schema 调整、CI 配置等）应**直接操作真实仓库** `https://github.com/blackplume233/actant-hub`，而非 `examples/actant-hub/` 目录。真实仓库即是最好的 example。

```
# 本地路径约定
g:\Workspace\AgentWorkSpace\actant-hub    # 真实仓库（独立 clone）
examples/actant-hub/                       # 已废弃，仅保留作为历史参考

# 如果本地没有该仓库，先克隆
git clone https://github.com/blackplume233/actant-hub.git \
  g:\Workspace\AgentWorkSpace\actant-hub
```

| 操作 | 在哪里做 |
|------|----------|
| 新增/修改组件（Skills, Templates, Presets 等） | `actant-hub` 仓库 |
| 修改 CI workflow | `actant-hub` 仓库的 `.github/workflows/` |
| 修改 SourceValidator 逻辑 | AgentCraft 主项目 `packages/core/src/source/` |
| SourceValidator 集成测试 | AgentCraft 主项目，但测试目标应为本地 clone 的 `actant-hub` 仓库 |

> **注意**：`examples/actant-hub/` 和主项目的 `.github/workflows/validate-hub.yml` 不再作为 hub 的主要开发路径。后续如需在主项目 CI 中集成 hub 校验，应 clone 真实仓库而非引用 examples 目录。

### Parser-level Field Name Mapping

When integrating with external formats that use different naming conventions (e.g., kebab-case YAML keys), map to internal TypeScript conventions at the parser boundary. Downstream code never sees the external naming.

```typescript
// Good — parser maps "allowed-tools" → allowedTools at parse time
const allowedToolsRaw = meta["allowed-tools"];
const allowedTools = allowedToolsRaw
  ? allowedToolsRaw.split(/\s+/).filter(Boolean)
  : undefined;
return { ...rest, allowedTools };

// Bad — passing raw kebab-case keys through to the type system
return { "allowed-tools": meta["allowed-tools"] };
```

**Why**: Keeps the internal type system consistent (`camelCase` everywhere) and avoids bracket-notation access throughout the codebase. The parser is the single place where external format differences are absorbed.

### Backend Three-Mode Registration

Every built-in backend should declare its supported modes and provide the correct command for each mode. The three modes serve distinct purposes:

| Mode | Purpose | Command | Protocol |
|------|---------|---------|----------|
| `open` | Opens native TUI/UI for human interaction | `openCommand` | Terminal I/O (no ACP) |
| `resolve` | Returns command/args for external callers to establish ACP connections | `resolveCommand` | ACP (stdio) |
| `acp` | Actant-managed ACP lifecycle (start/stop/run/chat/prompt/proxy) | `acpCommand` or falls back to `resolveCommand` | ACP (stdio) |

> **Core principle**: Everything except `open` (direct native UI) and `resolve` (output connection info) goes through `acp` mode.

```typescript
registerBackend({
  type: "claude-code",
  supportedModes: ["resolve", "open", "acp"],
  resolveCommand: { win32: "claude-agent-acp.cmd", default: "claude-agent-acp" },
  openCommand: { win32: "claude.cmd", default: "claude" },
  resolvePackage: "@zed-industries/claude-agent-acp",
});
```

**Key points**:
- `resolveCommand` and `acp` mode typically share the same executable (the ACP adapter)
- `openCommand` is the native TUI binary — it may be a **different executable** than the ACP adapter (e.g., `claude` vs `claude-agent-acp`)
- Always provide `win32` variant when the CLI installs `.cmd` shim files (npm global installs)
- If a backend depends on an **external package** (not bundled with Actant), add an install hint in `backend-registry.ts` (see below)
- Backends declare their own dependency package via `resolvePackage`. The generic `binary-resolver.ts` accepts this as a parameter — the ACP layer has no hardcoded knowledge of specific backend packages. See [agent-lifecycle.md §5.4](../agent-lifecycle.md#54-后端依赖解析resolvepackage-与-binary-resolver) for the full resolution chain and pnpm constraints.

### Backend Install Hints for External Dependencies

When a backend's executable comes from a separate package (not bundled with Actant), register an install hint so error messages can guide users:

```typescript
const installHints = new Map<AgentBackendType, string>([
  ["claude-code", "npm install -g @zed-industries/claude-agent-acp"],
  ["cursor", "Install Cursor from https://cursor.com"],
]);

export function getInstallHint(type: AgentBackendType): string | undefined {
  return installHints.get(type);
}
```

**Usage in error paths** (AgentManager, CLI chat):

```typescript
if (isSpawnNotFound(error)) {
  const hint = getInstallHint(backendType);
  throw new Error(
    `Backend "${backendType}" executable not found.` +
    (hint ? `\nInstall with: ${hint}` : " Ensure the CLI is in your PATH."),
  );
}
```

**Why**: Users encountering `ENOENT`/`EINVAL` from a missing backend CLI get a one-line fix instead of a cryptic spawn error. This avoids bundling heavyweight third-party CLIs while maintaining good UX.

### Explicit Module Boundaries

Each package exposes a public API via barrel exports. Internal modules are not accessible externally.

---

## Testing Requirements

### Coverage Rules

| Category | Requirement |
|----------|-------------|
| CLI commands | Every command must have unit tests for all options and edge cases |
| Configuration loading | Schema validation tests, malformed input tests |
| Agent lifecycle | State transitions, error recovery, cleanup |
| Template composition | Valid/invalid reference resolution |
| Public APIs | All exported functions must have tests |

### End-to-End Regression (QA Loop)

Full CLI regression tests live in `.agents/skills/qa-engineer/scenarios/full-cli-regression.json`. The QA loop:

1. Builds the project and globally links the `actant` binary (`pnpm install:local`)
2. Creates an isolated `ACTANT_HOME` in a temp directory
3. Starts a Daemon with a dedicated `ACTANT_SOCKET`
4. Executes all scenario steps against the real binary
5. Reports results and creates GitHub issues for failures
6. Fixes issues, rebuilds, and re-runs until 100% pass
7. Cleans up (stops daemon, removes temp dirs, unlinks binary)

**Rule**: When changing unit test fixtures (e.g., hardcoded PIDs in `attachAgent` tests), ensure they reference real, existing processes. Use `process.pid` (the test runner's own PID) instead of made-up numbers like `99999`, since PID validation (`process.kill(pid, 0)`) is now enforced.

**Rule**: When adding opt-in validation modes (e.g., `--compat agent-skills`), always include backward-compatibility tests that verify the same input passes without the flag. This ensures new modes don't silently change default behavior.

### Test Structure

```
feature/
├── feature.ts
├── feature.test.ts          # Unit tests (co-located)
└── feature.types.ts
```

### Test Naming Convention

```typescript
describe("TemplateLoader", () => {
  it("should load a valid template from file path", () => { ... });
  it("should throw TemplateNotFoundError when file does not exist", () => { ... });
  it("should resolve skill references from the registry", () => { ... });
});
```

---

## Code Review Checklist

Before approving any feature:

- [ ] **CLI accessible**: Can this feature be fully operated via CLI?
- [ ] **Tests present**: Are all CLI/config behaviors covered?
- [ ] **Types correct**: No `any`, no non-null assertions?
- [ ] **Module boundaries**: Does it only use public APIs of other modules?
- [ ] **Error handling**: Are lifecycle errors properly caught and cleaned up?
- [ ] **Extensible**: Can new Domain Context types be added without modifying existing code?
- [ ] **Reusable**: Are components designed for reference-based composition?
- [ ] **Logged**: Are important operations logged with structured context?
- [ ] **Documented**: Are non-obvious design decisions explained?
- [ ] **Small scope**: Is the change small enough for one coherent commit?

---

## Monorepo 发布规范

### 版本同步

所有子包必须始终保持与根 `package.json` 一致的版本号。

```bash
# 同步版本：读取根 package.json 的 version，写入所有子包
pnpm run version:sync    # → node scripts/version-sync.mjs
```

> **Gotcha**: CI publish workflow 会在 `pnpm build` 前自动运行 `version:sync`。但本地手动发布（`pnpm publish:all`）前也必须先运行此脚本，否则已经在 npm 上的版本号会被跳过。

### Common Mistake: 子包版本未同步导致发布跳过

**症状**: `pnpm -r publish` 成功完成，但某些包的新版本没有出现在 npm 上。

**原因**: 子包的 `package.json` 版本仍是旧值（如 0.1.2），与 npm 上已有版本相同，npm 会静默跳过。

**修复**: 发版前始终运行 `pnpm run version:sync`。CI workflow 已包含此步骤。

**预防**: 不要手动编辑子包版本，只编辑根 `package.json` 的 `version` 字段，然后通过 `version:sync` 同步。

### 本地开发全局安装

使用 `pnpm install:local`（即 `scripts/install-local.mjs`）将本地构建的 `actant` 安装到全局环境，支持两种模式：

```bash
# Link 模式（默认，推荐日常开发）
pnpm install:local              # 构建 + npm link
pnpm install:local --force      # 跳过覆盖确认
pnpm install:local --skip-build # 仅重新 link（已构建时）

# Standalone 模式（独立二进制，无需 Node.js）
pnpm install:local:standalone              # 构建 SEA 二进制 + 安装
pnpm install:local:standalone -- --force   # 跳过覆盖确认
```

Link 模式通过 `npm link` 从 `packages/actant` 创建全局 symlink，安装到 npm 全局目录（已在 PATH 中）。后续只需 `pnpm build` 即可更新全局 `actant` 命令，无需重复 link。

Standalone 模式通过 Node.js SEA 打包平台原生可执行文件（Windows `.exe` / macOS / Linux），完全自包含，不依赖源码仓库或 Node.js 运行时。支持 `--install-dir` 自定义安装目录。

> **Gotcha**: 全局 link 的入口是 **`packages/actant`**（facade 包），不是 `packages/cli`。因为 `actant` 包的 `bin/actant.js` 通过 import 桥接到 `@actant/cli`，而 workspace symlink 会正确解析所有 `@actant/*` 内部依赖。

### Common Mistake: Standalone 二进制与源码不同步

**症状**: 在源码中修复了 bug 并通过 `pnpm test` 验证，但通过全局 `actant` 命令运行时 bug 依旧存在（例如 Source 的 domainContext namespace 解析失败）。

**原因**: 全局安装的 `actant` 使用的是 **旧版 standalone 二进制**（`.exe`），它在构建时将所有代码打包为单一可执行文件。源码改动不会自动反映到已安装的二进制中。

**诊断**:

```bash
# 检查全局 actant 的实际路径
where actant      # Windows
which actant      # macOS/Linux

# 如果路径指向独立 .exe 而非 node_modules 中的 symlink，则为 standalone 模式
```

**修复**:

```bash
# 重新构建 + 安装 standalone
pnpm run build:standalone
pnpm run install:local:standalone

# 重启 daemon（daemon 也运行旧代码）
actant daemon stop
actant daemon start
```

**预防**:
- 日常开发**优先使用 Link 模式**（`pnpm install:local`），改动后只需 `pnpm build` 即可生效
- 仅在需要发布或测试独立部署时使用 Standalone 模式
- 遇到「源码已修复但全局命令仍有问题」时，**第一步检查全局 `actant` 的安装模式**

### Common Mistake: Standalone Bundle ENOENT on AppData

**症状**: `npx actant source validate` 或其他命令报错：

```
Error: ENOENT: no such file or directory, open 'C:\Users\<user>\AppData\Roaming\package.json'
```

**原因**: Standalone bundle 内部使用 `readFileSync` 从 npm 全局前缀路径解析 `package.json`。在非全局安装环境（如 `npx` 临时执行或 `pnpm actant` 脚本调用）下，该路径不存在。

**临时解决方案**: 使用源码模式运行 CLI：

```bash
pnpm --filter @actant/cli exec tsx src/bin/actant.ts <command>
```

**预防**: 日常开发使用 Link 模式（`pnpm install:local`）而非 standalone，或在 bundle 入口添加路径存在性检查的 fallback。

### DTS 生成注意事项

- **Facade 包**（纯 re-export）：不使用 tsup 的 DTS 生成（会触发传递性类型错误），改为在 `onSuccess` 钩子中将 `.ts` 源文件复制为 `.d.ts`
- **包含 bin 脚本的包**：如果 bin 入口有类型错误但库入口正常，使用 `dts: { entry: { index: "src/index.ts" } }` 限定 DTS 生成范围
- **跨包 import 的 DTS 依赖**：如果包 A 中有 `import("@actant/b")`，即使是动态导入，TypeScript DTS 生成也需要 `@actant/b` 在包 A 的 `dependencies` 中声明（pnpm workspace 不自动链接未声明的依赖）

### Don't: ESM 项目中使用 require()

```typescript
// Bad — ESM 项目（"type": "module"）中使用 require
const pkg = require('./package.json');

// Good — 使用 readFileSync + JSON.parse
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
```

**Why**: 根 `package.json` 声明了 `"type": "module"`，所有 `.js` / `.mjs` 文件默认走 ESM，`require()` 不可用。

---

## Language Conventions

The project owner's preferred language is **Chinese (中文)**. Apply the following rules:

| Context | Language | Examples |
|---------|----------|---------|
| **Documentation output** (specs, ADRs, design docs, guides, READMEs) | Chinese preferred, English acceptable | 设计文档、架构决策记录、指南 |
| **Code** (variable names, function names, class names) | English only | `createAgent()`, `templateName` |
| **Code comments** | English preferred (keep minimal per quality guidelines) | Non-obvious logic notes |
| **Commit messages** | English | `feat: add template loader` |
| **CLI user-facing strings** | English (i18n later) | Error messages, help text |
| **Log messages** | English | Structured log entries |
| **Git branch names** | English | `feat/template-loader` |

> **Rule**: When producing documentation, default to Chinese. When writing code or technical identifiers, use English. If a document already exists in one language, follow its existing language unless asked to change.
