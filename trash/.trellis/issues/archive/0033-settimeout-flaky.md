---
id: 33
title: 测试中固定 setTimeout 延迟导致潜在 flaky
status: closed
labels:
  - core
  - enhancement
  - "priority:P2"
  - quality
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#33"
closedAs: completed
createdAt: "2026-02-20T13:19:10"
updatedAt: "2026-02-20T14:55:40"
closedAt: "2026-02-20T14:55:40"
---

## 审查发现（更严格标准）

`packages/core/src/manager/agent-manager.test.ts` 中多处使用 `await new Promise((r) => setTimeout(r, 120))` 或 200/500ms 等待 ProcessWatcher 轮询或状态更新。在 CI/高负载环境下，120ms 可能不足，导致偶发失败。

## 证据

- 约 386, 412, 449, 544 行：`setTimeout(r, 120)` 等待 watcher 检测进程退出。
- 273, 318, 342, 365 行：200/500ms 等待。

同文件内 ProcessWatcher 单测已使用 `vi.useFakeTimers` + `vi.advanceTimersByTimeAsync`，无真实延迟。

## 建议

- **优先**：在 agent-manager 集成测试中注入或 mock `processUtils.isProcessAlive`，用 `vi.advanceTimersByTimeAsync(pollInterval)` 推进时间，避免依赖真实 120ms。
- **或**：将 `setTimeout(r, 120)` 改为 `setTimeout(r, 300)` 等更保守值，并标注为临时缓解；长期仍建议 fake timers 或「等待条件」（如 `waitFor(() => expect(getStatus()).toBe("stopped"))`）以消除时间敏感。

---

## Comments

### cursor-agent — 2026-02-20T14:55:40

Closed as completed
