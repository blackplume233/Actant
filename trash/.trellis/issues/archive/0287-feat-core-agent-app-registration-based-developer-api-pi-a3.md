---
id: 287
title: "feat(core): Agent App registration-based developer API [Pi-A3]"
status: closed
labels:
  - enhancement
  - core
  - "priority:P3"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#287"
closedAs: completed
createdAt: "2026-03-15T08:03:56Z"
updatedAt: "2026-03-18T06:39:26"
closedAt: "2026-03-18T06:37:10Z"
---

## Background

Pi's extension entry point is a single function:
```typescript
export default function(pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

Actant's Plugin system requires class inheritance + PluginHost + Hook system binding. The upcoming Agent App concept has no developer API defined yet.

## Motivation

Agent App is the product-level concept for "specialized agent application packaging" (see vision.md). Its developer API should be as simple as Pi's extension API, not requiring developers to understand PluginHost, HookEventBus, or ActionRunner internals.

## Proposed Design Direction

```typescript
// Target: Agent App entry should be as simple as Pi Extensions
export default function(app: AgentAppAPI) {
  app.registerPanel("brief-form", BriefFormComponent);
  app.registerConfig("level-production.schema.json");
  app.registerWorkflow("production-pipeline", flowDefinition);
  app.on("asset.updated", async (event) => { ... });
}
```

## Key Design Decisions

- [ ] Registration-based API vs class inheritance
- [ ] Agent App API scope (UI panels, configs, workflows, event handlers)
- [ ] Relationship between Agent App API and existing Plugin system
- [ ] Package format for Agent App distribution (npm? Hub?)

## Acceptance Criteria

- [ ] AgentAppAPI interface designed
- [ ] At least one example Agent App implemented using the API
- [ ] Documentation comparing with Pi Extension API

## Priority

P3 - Long-term, depends on Agent App concept maturity

## Reference

Pi: `ExtensionAPI` with `registerTool`, `registerCommand`, `on()` event handlers
