---
id: 118
title: "Template loader drops schedule, permissions, and plugins fields during Zod-to-type mapping"
status: closed
labels:
  - bug
  - core
  - "priority:P1"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#118"
closedAs: completed
createdAt: "2026-02-22T14:49:09Z"
updatedAt: "2026-02-22T15:42:28"
closedAt: "2026-02-22T15:42:22Z"
---

## Bug Description

`toAgentTemplate()` in `packages/core/src/template/loader/template-loader.ts` (lines 103-125) maps the Zod-validated output to the `AgentTemplate` type, but **omits the `schedule` and `permissions` fields**. The Zod schema (`AgentTemplateSchema`) correctly validates these fields, but the manual mapping function only copies: name, version, description, backend, provider, domainContext, initializer, metadata.

Additionally, `domainContext.plugins` is also not mapped.

## Impact

- **schedule**: Heartbeat/Cron/Hook scheduler configurations are silently dropped when loading templates. The EmployeeScheduler never initializes because the schedule config is lost.
- **permissions**: Template-level permission configurations are dropped.
- **plugins**: Domain context plugins are dropped.

## Reproduction

```bash
# Create a template with schedule
cat > /tmp/test-tpl.json << 'EOF'
{
  "name": "test-sched", "version": "1.0.0",
  "backend": {"type": "claude-code"},
  "provider": {"type": "anthropic"},
  "domainContext": {},
  "schedule": { "heartbeat": { "intervalMs": 20000, "prompt": "hello" } }
}
EOF
actant template load /tmp/test-tpl.json
actant template show test-sched -f json
# schedule field is missing from output
```

## Fix

Add the missing fields to `toAgentTemplate()`:
```typescript
return {
  ...existingFields,
  schedule: output.schedule,
  permissions: output.permissions,
  // domainContext should also include plugins
};
```

## Related Files

- `packages/core/src/template/loader/template-loader.ts` lines 103-125
- `packages/core/src/template/schema/template-schema.ts`
- `packages/shared/src/types/template.types.ts`

## Discovered By

QA explore test: Web Search Agent Heartbeat (2026-02-22)
