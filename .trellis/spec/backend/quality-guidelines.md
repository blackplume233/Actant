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
