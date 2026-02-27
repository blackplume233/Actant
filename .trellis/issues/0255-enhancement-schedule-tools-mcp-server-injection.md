---
id: 255
title: "Enhancement: Schedule tools MCP Server injection path (reduce CLI fork latency)"
status: open
labels:
  - enhancement
  - mcp
  - "priority:P2"
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 178
  - 137
relatedFiles:
  - packages/mcp-server/src/index.ts
  - packages/mcp-server/src/schedule-tools.ts
taskRef: null
githubRef: "blackplume233/Actant#255"
closedAs: null
createdAt: 2026-02-27T22:00:00
updatedAt: 2026-02-27T22:00:00
closedAt: null
---

**Related Issues**: [[0178-rfc-actant-acp-tool-capability-manifest]], [[0137-runtime-mcp-manager]]
**Related Files**: `packages/mcp-server/src/index.ts`, `packages/mcp-server/src/schedule-tools.ts`

---

## 目标

为 Agent 调度器自助操作（`schedule.addDelay` / `schedule.addCron` / `schedule.cancel`）增加 **MCP Server 直接注入路径**，替代当前仅有的 CLI 注入方式，降低工具调用延迟。

## 背景

Step 6（调度器四模式增强）中，Agent 自主操作调度器的工具统一通过 **CLI 注入** 路径实现。CLI 路径需要 fork 一个 `actant` 子进程来执行命令，涉及 Node.js 启动 + commander 解析 + IPC 连接，延迟约 200-500ms。MCP Server 路径可将延迟降至 10-30ms。

## 验收标准

- [ ] `@actant/mcp-server` 中新增 `schedule-tools.ts`，注册 3 个 MCP tools
- [ ] 在 `index.ts` 中 import 并注册
- [ ] MCP 路径与 CLI 路径调用同一套 Daemon RPC handler，无需重复实现
- [ ] 对于支持 MCP 的后端，优先使用 MCP 路径
- [ ] CLI 路径保留作为 fallback
