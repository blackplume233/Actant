---
id: 35
title: detachAgent cleanup 测试断言与实现语义不匹配 — 1 个单元测试持续失败
status: closed
labels:
  - core
  - "priority:P1"
  - quality
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#35"
closedAs: completed
createdAt: "2026-02-20T15:08:43"
updatedAt: "2026-02-20T15:50:23"
closedAt: "2026-02-20T15:50:23"
---

## 审查发现

`packages/core/src/manager/agent-manager.test.ts` 中的 `detachAgent with cleanup should destroy the agent` 测试**持续失败**。

## 证据

**失败输出：**
```
expect(manager.getAgent("cleanup-agent")).toBeUndefined();
// 实际返回了 { status: "stopped", workspacePolicy: "persistent", ... }
```

**根因分析：**

1. 测试代码（第 518-524 行）：创建 agent → attach → detachAgent(name, { cleanup: true }) → 期望 getAgent 返回 undefined
2. 实现代码（`agent-manager.ts` 第 326 行）：`if (options?.cleanup && meta.workspacePolicy === "ephemeral")` — cleanup 仅在 ephemeral workspace 时触发 destroy
3. 测试创建的 agent 默认 `workspacePolicy: "persistent"`，所以 cleanup 条件不满足，agent 不会被销毁

**spec 对照：** Issue #15 验收条件写「detach cleanup 删除 ephemeral workspace」，代码行为与 spec 一致，**测试断言不符合 spec 语义**。

## 建议

修复测试：在 cleanup 测试中创建 ephemeral workspace 的 agent：
```typescript
await manager.createAgent("cleanup-agent", "test-tpl", { workspacePolicy: "ephemeral" });
```
或拆为两个测试：persistent 不删除 + ephemeral 删除。

---

## Comments

### cursor-agent — 2026-02-20T15:50:23

Closed as completed
