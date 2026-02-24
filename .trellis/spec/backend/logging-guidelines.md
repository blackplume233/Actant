# Logging Guidelines

> How logging is done in Actant.

---

## Overview

Actant manages multiple concurrent agent lifecycles. Structured logging is essential for debugging, monitoring, and auditing agent behavior across the CLI, Core, ACP, MCP, and API layers.

---

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Unrecoverable failures requiring attention | Agent crash, provider connection failure |
| `warn` | Recoverable issues or degraded behavior | Heartbeat timeout (retrying), deprecated config field |
| `info` | Key lifecycle events and user actions | Agent launched, template loaded, CLI command executed |
| `debug` | Detailed internal state for troubleshooting | Domain Context assembly details, config resolution |
| `trace` | Very fine-grained protocol-level detail | ACP/MCP message payloads, individual API calls |

### Level Guidelines

- **Production default**: `info`
- **Development default**: `debug`
- **Troubleshooting**: `trace` (enable selectively per module)

---

## Structured Logging

All log entries must include structured context. Never use string interpolation alone.

```typescript
// Bad — Unstructured
logger.info(`Agent ${name} launched on port ${port}`);

// Good — Structured
logger.info("Agent launched", {
  instanceId,
  templateName,
  port,
  launchMode: "acp-service",
});
```

### Required Fields

| Field | Always Present | Description |
|-------|---------------|-------------|
| `timestamp` | Yes | ISO 8601 format |
| `level` | Yes | error / warn / info / debug / trace |
| `message` | Yes | Human-readable event description |
| `module` | Yes | Source module (core, acp, mcp, api, cli) |
| `instanceId` | When applicable | Agent Instance identifier |
| `templateName` | When applicable | Source template name |
| `command` | CLI operations | CLI command being executed |

---

## What to Log

### Agent Lifecycle Events (info)

| Event | Required Context |
|-------|-----------------|
| Agent instance created | `instanceId`, `templateName`, `launchMode` |
| Agent launched | `instanceId`, `pid`, `port` (if applicable) |
| Agent stopped | `instanceId`, `reason`, `exitCode` |
| Heartbeat received | `instanceId`, `status` |
| Heartbeat timeout | `instanceId`, `lastHeartbeat`, `threshold` |

### Configuration Events (info)

| Event | Required Context |
|-------|-----------------|
| Template loaded | `templateName`, `resolvedSkills`, `resolvedMcp` |
| Skill registered | `skillName`, `source` |
| Workflow applied | `workflowName`, `targetInstance` |

### CLI Events (info)

| Event | Required Context |
|-------|-----------------|
| Command executed | `command`, `args`, `duration` |
| Command failed | `command`, `errorCode`, `errorMessage` |

### Communication Events (debug)

| Event | Required Context |
|-------|-----------------|
| ACP connection | `clientId`, `protocol` |
| MCP tool call | `toolName`, `agentId`, `duration` |
| API request | `method`, `path`, `statusCode`, `duration` |

---

## What NOT to Log

| Category | Examples | Reason |
|----------|---------|--------|
| Secrets | API keys, tokens, passwords | Security |
| Full prompts | System prompts, user messages | Privacy, size |
| Model responses | LLM output content | Privacy, size |
| PII | User email, IP addresses (unless required) | Privacy regulations |
| Binary data | File contents, encoded payloads | Size, readability |

> **Rule**: When in doubt, log the metadata (size, type, duration) not the content.

---

## Module-Specific Logging

### Per-Module Logger

Each module creates its own logger with the module name.

```typescript
// In packages/core/manager/
const logger = createLogger("core:manager");

logger.info("Agent launched", { instanceId });
// Output: [2026-02-19T10:30:00Z] [INFO] [core:manager] Agent launched { instanceId: "abc-123" }
```

### Agent Instance Logger

Long-running agents get their own log stream for isolated debugging.

```typescript
const instanceLogger = createLogger(`agent:${instanceId}`);
```

---

## Common Mistakes

### Mistake: Logging Inside Hot Loops

**Symptom**: Log files grow to gigabytes, performance degrades.

**Fix**: Use `trace` level for hot-path logging, which is disabled by default.

### Mistake: Missing Context on Error Logs

**Symptom**: Error log says "Agent failed" with no way to identify which agent.

**Fix**: Always include `instanceId`, `templateName`, and relevant state in error context.

### Mistake: Logging Sensitive Configuration

**Symptom**: API keys appear in log files.

**Fix**: Sanitize config objects before logging. Use an allow-list of safe fields.
