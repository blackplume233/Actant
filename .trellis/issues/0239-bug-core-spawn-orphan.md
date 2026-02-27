---
id: 239
title: "bug(core): spawn 瓒呮椂鍚?orphan 瀛愯繘绋嬫湭瀹屽叏娓呯悊"
status: open
labels:
  - bug
  - core
  - review
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#239"
closedAs: null
createdAt: "2026-02-27T04:03:12Z"
updatedAt: "2026-02-27T12:35:48"
closedAt: null
---

## 现象

`ProcessLauncher.launch()` 中使用 `Promise.race` 实现 30s spawn 超时。当超时发生时，调用 `child.kill()` 并抛出错误。但此时 child 进程引用是 `launch()` 的局部变量，不会被存入 `AgentManager.processes` Map，因此 `AgentManager` 无法在后续执行进一步清理。

## 影响

- 孤儿进程：`child.kill()` 发送 SIGTERM，但不等待进程真正退出。如果子进程忽略 SIGTERM（虽然不太可能），可能残留
- `child` 未被 `unref()`，父进程可能保持对子进程的引用直到其退出

## 建议方案

1. 超时后执行 `child.kill()` + `child.unref()` 组合
2. 或者改为在 `launch()` 超时时将 child 返回给调用者，由调用者负责 `terminate()`
3. 可选：加一个 `setTimeout` 发 SIGKILL 作为后备

## 相关文件

- `packages/core/src/manager/launcher/process-launcher.ts` — spawn timeout 分支
