# Error Handling

> How errors are handled in Actant.

---

## Overview

Actant manages multiple agent lifecycles concurrently, each involving process management, network communication, and file system operations. Error handling must be robust, recoverable, and informative across all these layers.

---

## Error Categories

### 1. Configuration Errors

Errors in templates, skills, workflows, or other Domain Context configurations.

| Error | When | Recovery |
|-------|------|----------|
| `TemplateNotFoundError` | Template name doesn't resolve | Report to user, suggest available templates |
| `TemplateValidationError` | Template schema is invalid | Show validation details with path to issue |
| `SkillReferenceError` | Skill name doesn't exist in registry | List available skills |
| `CircularReferenceError` | SubAgent references form a cycle | Show the cycle path |

### 2. Lifecycle Errors

Errors during agent instance creation, launch, execution, and termination.

| Error | When | Recovery |
|-------|------|----------|
| `AgentLaunchError` | Process failed to start | Cleanup workspace, report details |
| `AgentCrashError` | Agent process terminated unexpectedly | Attempt restart (with backoff) or report |
| `HeartbeatTimeoutError` | Persistent agent stopped responding | Health check, restart if configured |
| `WorkspaceInitError` | Failed to set up working directory | Cleanup partial files, report |

### 3. Communication Errors

Errors in ACP, MCP, or API communication.

| Error | When | Recovery |
|-------|------|----------|
| `ACPConnectionError` | ACP client connection failed | Retry with backoff, report |
| `MCPToolError` | MCP tool execution failed | Return structured error to caller |
| `APIValidationError` | Invalid API request | Return 400 with validation details |
| `ProviderConnectionError` | Model provider unreachable | Retry, fallback, or report |

### 4. CLI Errors

Errors in command-line interaction.

| Error | When | Recovery |
|-------|------|----------|
| `CommandNotFoundError` | Unknown CLI command | Suggest similar commands |
| `InvalidArgumentError` | Wrong argument type or missing required | Show usage help |
| `PermissionError` | Insufficient permissions for operation | Report required permissions |

---

## Error Handling Patterns

### Pattern: Typed Error Classes

All errors extend a base `ActantError` with structured metadata.

```typescript
abstract class ActantError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;
}

class TemplateNotFoundError extends ActantError {
  readonly code = "TEMPLATE_NOT_FOUND";
  readonly category = "configuration";

  constructor(templateName: string) {
    super(`Template "${templateName}" not found in registry`);
    this.context = { templateName };
  }
}
```

### Pattern: Lifecycle Cleanup on Failure

Agent lifecycle operations must always clean up on failure.

```typescript
async function launchAgent(template: AgentTemplate): Promise<AgentInstance> {
  const workspace = await createWorkspace(template);
  try {
    const instance = await initializeAgent(workspace, template);
    await startProcess(instance);
    return instance;
  } catch (error) {
    await cleanupWorkspace(workspace);
    throw new AgentLaunchError(template.name, error);
  }
}
```

### Pattern: Error Boundaries at Module Edges

Each module (Core, ACP, MCP, API) catches and translates errors at its boundary.

```typescript
// API layer catches core errors and translates to HTTP responses
app.use((error, req, res, next) => {
  if (error instanceof ActantError) {
    res.status(errorToHttpStatus(error.category)).json({
      error: error.code,
      message: error.message,
      details: error.context,
    });
  } else {
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});
```

---

## API Error Response Format

```json
{
  "error": "TEMPLATE_NOT_FOUND",
  "message": "Template \"my-agent\" not found in registry",
  "details": {
    "templateName": "my-agent"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `error` | Yes | Machine-readable error code |
| `message` | Yes | Human-readable description |
| `details` | No | Structured context for debugging |

---

## Common Mistakes

### Mistake: Swallowing Lifecycle Errors

**Symptom**: Agent processes become orphaned, no error visible to user.

**Cause**: `catch` block logs but doesn't propagate or clean up.

**Fix**: Always clean up resources AND propagate the error (or translate to a user-visible message).

### Mistake: Generic Error Messages

**Symptom**: User sees "Something went wrong" with no actionable information.

**Cause**: Catching all errors with a single generic handler.

**Fix**: Use typed error classes that carry context. Display the error code and relevant details.

### Mistake: Accepting Nonexistent PIDs in attach

**Symptom**: `agent attach <name> --pid 99999` succeeds with exit code 0, despite PID 99999 not existing. Agent enters `running` state referencing a dead process.

**Cause**: `attachAgent()` trusted the caller-provided PID without verifying process existence.

**Fix**: Validate with `process.kill(pid, 0)` before accepting the PID. If `ESRCH` is thrown, reject with `AgentLaunchError`.

```typescript
try {
  process.kill(pid, 0);
} catch (err: unknown) {
  if ((err as NodeJS.ErrnoException).code === "ESRCH") {
    throw new AgentLaunchError(name, new Error(`Process with PID ${pid} does not exist`));
  }
}
```

**Prevention**: Any operation that accepts an external PID (attach, process watcher registration) must verify existence first. `process.kill(pid, 0)` works cross-platform in Node.js.

### Mistake: Silent Success on Failed Operations (Exit Code 0)

**Symptom**: CLI commands print a "failure" message (e.g., "No scheduler for agent") but exit with code 0. Automated scripts and QA tools cannot distinguish success from failure.

**Cause**: Command handlers only set `process.exitCode = 1` for thrown errors, not for logical failures communicated via result objects.

**Fix**: Any CLI command whose result indicates the operation did not succeed must set `process.exitCode = 1`:

```typescript
if (result.queued) {
  printer.log("Task queued.");
} else {
  printer.dim(`No scheduler for agent "${name}".`);
  process.exitCode = 1;
}
```

**Prevention**: For every CLI command, enumerate the success and failure conditions. Every failure condition must result in a non-zero exit code, regardless of whether it throws an exception.

### Mistake: No Timeout on External Calls

**Symptom**: CLI hangs indefinitely when a Model Provider is down.

**Cause**: No timeout configured on HTTP/process calls.

**Fix**: All external calls (provider API, ACP, MCP) must have configurable timeouts.
