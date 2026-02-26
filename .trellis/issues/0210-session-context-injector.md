---
id: 210
title: "feat(core): SessionContextInjector — extensible dynamic context injection for ACP sessions"
status: open
labels:
  - core
  - feature
  - architecture
  - "priority:P1"
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 178
  - 16
  - 122
  - 137
relatedFiles:
  - packages/core/src/context-injector/session-context-injector.ts
  - packages/core/src/context-injector/index.ts
  - packages/shared/src/types/hook.types.ts
  - packages/acp/src/connection-manager.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/api/src/services/app-context.ts
githubRef: "blackplume233/Actant#216"
---

## Summary

新模块 `packages/core/src/context-injector/`，为 ACP Session 提供可扩展的动态上下文注入能力。

## Motivation

当 Actant 管理的 Agent 进程启动 ACP Session 时，需要动态注入 MCP Servers（如 Canvas、Schedule、Email 等系统工具）和额外的系统上下文。当前缺乏统一的注入机制，各子系统无法扩展。

## Design

### ContextProvider 接口

任何子系统（Canvas、Schedule、Email、Memory）可注册为 provider：

```typescript
interface ContextProvider {
  name: string;
  getMcpServers(agentName: string, meta: AgentInstanceMeta): AcpMcpServerStdio[];
  getSystemContext?(agentName: string, meta: AgentInstanceMeta): string | undefined;
}
```

### SessionContextInjector

- `register(provider)` / `unregister(name)` — 注册/注销 provider
- `prepare(agentName, meta)` — 收集所有 MCP servers + 系统上下文，去重同名 MCP server
- EventBus 集成：`session:preparing` / `session:context-ready` 事件

### ACP 管道打通

- `ConnectOptions` + `AcpConnectionManagerLike` 新增 `mcpServers` 字段
- `AgentManager.startAgent()` 调用 `injector.prepare()` 收集上下文
- `newSession(cwd, mcpServers)` 传参

## Deliverables

- [x] `packages/core/src/context-injector/session-context-injector.ts`
- [x] `packages/core/src/context-injector/index.ts`
- [x] `hook.types.ts` 新增 `session:preparing` / `session:context-ready`
- [x] `ConnectOptions` + `AcpConnectionManagerLike` mcpServers 扩展
- [x] `AgentManager` 集成 SessionContextInjector

## Related

- #178 Dashboard v0
- #16 ACP Integration
- #122 Schedule Enhancement (Step 6 依赖此 Issue)
- #137 Activity Recording
