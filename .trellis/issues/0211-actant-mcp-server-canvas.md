---
id: 211
title: "feat(mcp-server): activate built-in Actant MCP Server with actant_canvas_update tool"
status: open
labels:
  - mcp
  - feature
  - "priority:P2"
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 16
  - 210
  - 178
relatedFiles:
  - packages/mcp-server/src/index.ts
  - packages/mcp-server/src/rpc-client.ts
  - packages/api/src/services/canvas-store.ts
  - packages/api/src/handlers/canvas-handlers.ts
  - packages/shared/src/types/rpc.types.ts
  - packages/dashboard/src/server.ts
  - packages/dashboard/client/src/lib/transport.ts
  - packages/dashboard/client/src/hooks/use-realtime.tsx
  - packages/dashboard/client/src/pages/live-canvas.tsx
  - .agents/skills/canvas-manager/SKILL.md
---

## Summary

激活 `packages/mcp-server/` 空 stub，实现内置 Actant MCP Server，提供 `actant_canvas_update` / `actant_canvas_clear` 工具，配合 Dashboard Live Canvas 页面实现 Agent 自主管理状态小组件。

## Motivation

Employee Agent 需要一种语义化的方式在 Dashboard 上展示实时状态。通过内置 MCP Server 提供专用工具，Agent 可以推送 HTML 内容到 Live Canvas，无需 hack writeTextFile 等通用工具。

## Design

### MCP Server (`packages/mcp-server`)

- 添加 `@modelcontextprotocol/sdk` + `zod` 依赖
- 实现 `actant_canvas_update(html, title?)` / `actant_canvas_clear()` 工具
- 通过 `ACTANT_SOCKET` 环境变量连接回 Daemon RPC
- 以 stdio 模式运行，通过 ACP `session/new` 的 `mcpServers` 参数注入

### Canvas 数据流

- `CanvasStore` — 内存存储 (`packages/api/src/services/canvas-store.ts`)
- `canvas.*` RPC handlers — `canvas.update`, `canvas.get`, `canvas.list`, `canvas.clear`
- `CanvasProvider` 注册到 `SessionContextInjector`
- Dashboard SSE 广播 canvas 数据

### Dashboard Live Canvas

- iframe sandbox 渲染 Agent HTML 内容
- Transport 抽象层为 Tauri 桌面化预留
- `use-realtime.tsx` 替代 `use-sse.tsx`（向后兼容）

### Skill

- `.agents/skills/canvas-manager/SKILL.md` — 指导 Agent 使用 canvas 工具
- HTML 示例模板

## Deliverables

- [x] `packages/mcp-server/src/index.ts` — MCP Server 实现
- [x] `packages/mcp-server/src/rpc-client.ts` — Daemon RPC 客户端
- [x] `packages/api/src/services/canvas-store.ts` — CanvasStore
- [x] `packages/api/src/handlers/canvas-handlers.ts` — RPC handlers
- [x] `packages/shared/src/types/rpc.types.ts` — canvas.* 类型
- [x] `packages/dashboard/src/server.ts` — SSE + REST canvas 端点
- [x] `packages/dashboard/client/src/lib/transport.ts` — Transport 抽象
- [x] `packages/dashboard/client/src/hooks/use-realtime.tsx` — 重构
- [x] `packages/dashboard/client/src/pages/live-canvas.tsx` — iframe 渲染
- [x] `.agents/skills/canvas-manager/SKILL.md` — Skill 定义

## Related

- #16 ACP Integration
- #210 SessionContextInjector
- #178 Dashboard v0
