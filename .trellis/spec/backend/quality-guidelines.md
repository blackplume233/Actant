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
