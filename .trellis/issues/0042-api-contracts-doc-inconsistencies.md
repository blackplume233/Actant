---
id: 42
title: api-contracts.md 文档与实现不一致（envCallback / env-passthrough / ResolveResult）
status: closed
labels:
  - enhancement
  - qa
  - docs
  - "priority:P2"
milestone: null
author: qa-agent
assignees: []
relatedIssues: []
relatedFiles:
  - .trellis/spec/api-contracts.md
  - packages/api/src/handlers/proxy-handlers.ts
  - packages/cli/src/commands/proxy.ts
taskRef: null
githubRef: "blackplume233/Actant#49"
closedAs: completed
createdAt: "2026-02-21T10:20:00.000Z"
updatedAt: "2026-02-22T12:00:00"
closedAt: "2026-02-22T12:00:00"
---

**Related Files**: `.trellis/spec/api-contracts.md`, `packages/api/src/handlers/proxy-handlers.ts`, `packages/cli/src/commands/proxy.ts`

---

## 测试发现

**场景**: Issue #35 随机漫步测试 — 文档一致性白盒验证
**步骤**: 场景组 7

## 不一致列表

### 1. proxy.envCallback — 文档有但未实现
- **文档** (§3.7): 定义了 `proxy.envCallback` RPC 方法
- **实现**: `proxy-handlers.ts` 中无此方法，仅有 `proxy.connect`, `proxy.disconnect`, `proxy.forward`

### 2. --env-passthrough 选项 — 文档有但未实现
- **文档** (§4.5): proxy 命令支持 `--env-passthrough` 选项
- **实现**: `proxy.ts` 仅定义 `--lease` 和 `-t, --template` 选项

### 3. ResolveResult 字段名不一致
- **文档** (§3.3): 使用 `name` 字段
- **实现**: 代码使用 `instanceName` 字段

### 4. agent.resolve overrides 参数 — 实现有但未文档化
- **实现**: `AgentResolveParams` 包含 `overrides` (launchMode, workspacePolicy, metadata)
- **文档**: 仅描述 `name` 和 `template` 参数

### 5. Proxy session/prompt 响应不完整
- **实现**: proxy 仅发送 `stopReason` 给 IDE，`text` 未转发
- 可能是设计意图（ACP 通过流式通知发送内容），但文档未明确说明

## 建议

1. 如果 envCallback 和 env-passthrough 已废弃，应从文档中移除或标记为 planned
2. 统一 ResolveResult 的字段命名
3. 补充 overrides 参数的文档
4. 明确 proxy 响应转发策略

---

## Comments

### cursor-agent — 2026-02-22T12:00:00

Closed as completed — All 5 inconsistencies resolved: (1,2) envCallback and env-passthrough correctly marked as not-yet-implemented, (3) ResolveResult uses instanceName consistently, (4) overrides documented, (5) proxy behavior documented in Section 7 Direct Bridge + Session Lease architecture.
