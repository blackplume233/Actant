---
id: 165
title: "feat(phase4): wave-1 bug fixes - gateway.lease, adopt sync, ping version, install.ps1"
status: closed
labels: []
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 10
  - 14
  - 161
  - 162
  - 163
  - 164
  - 166
relatedFiles:
  - packages/actant-memory/src/layers/instance-layer.ts
  - packages/actant-memory/src/extractor/rule-based.ts
  - packages/actant-memory/src/hooks/memory-hooks.ts
taskRef: null
githubRef: "blackplume233/Actant#188"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:50"
closedAt: "2026-02-25T02:00:57Z"
---

**Related Issues**: [[0010]], [[0014]], [[0161-plugin-appcontext-integration]], [[0162-agent-memory-core-package]], [[0163-agent-memory-store-lancedb]], [[0164-agent-memory-embedding]], [[0166-template-layer-promote]]
**Related Files**: `packages/actant-memory/src/layers/instance-layer.ts`, `packages/actant-memory/src/extractor/rule-based.ts`, `packages/actant-memory/src/hooks/memory-hooks.ts`

---

## Summary

Phase 4 第一波 Bug 修复，解除 Session Lease 等关键功能的阻塞。

- **#117** 实现 `gateway.lease` RPC handler — 创建 `gateway-handlers.ts`，为每个 Agent 创建专用命名管道/Unix socket，IDE 连接后桥接到 AcpGateway，启用完整的 Session Lease 模式
- **#151** 修复 agent adopt 后 `agent status` 不可见 — 在 `AgentManager` 新增 `registerAdopted()` 方法，adopt handler 同步更新内存缓存
- **#126** 修复 `daemon.ping` 返回硬编码版本 `0.1.0` — 改为从 `package.json` 动态读取真实版本号
- **#127** 修复 `install.ps1` 在非交互终端（CI/自动化）中永久挂起 — 添加 `$IsInteractive` 检测和 `-NpmRegistry` 参数

附带修复：`GatewayLeaseParams`/`GatewayLeaseResult` 类型补充导出到 `@actant/shared`

## Test plan

- [x] 695 tests passing (excluding pre-existing CLI E2E dist issue)
- [x] `@actant/api` type-check passes
- [ ] Manual: `actant proxy <agent> --lease` connects via gateway socket
- [ ] Manual: `actant agent adopt <path>` then `actant agent status <name>` shows agent
- [ ] Manual: `daemon.ping` returns correct version (0.2.1)
- [ ] Manual: `install.ps1 -NpmRegistry` skips interactive prompt
