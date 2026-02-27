---
id: 240
title: "bug(acp): AcpConnectionManager.connect() 澶辫触鏃?enforcer/gateway 鏉＄洰娉勬紡"
status: open
labels:
  - bug
  - acp
  - review
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#240"
closedAs: null
createdAt: "2026-02-27T04:03:14Z"
updatedAt: "2026-02-27T12:35:42"
closedAt: null
---

## 现象

`AcpConnectionManager.connect()` 在执行过程中如果抛出异常（例如 `gateway.connect()` 失败），catch 块只做日志和 re-throw，不清理已写入 `this.enforcers` 和 `this.gateways` Map 的条目。

## 影响

- 泄漏的 enforcer/gateway 条目会在后续调用中被 `disconnect()` 或 `disposeAll()` 处理，但如果中间调用了其他方法（如 `isConnected()`），可能返回不一致的状态
- 如果 `connect()` 被重试，新的 enforcer 会覆盖旧的（Map.set），但旧 gateway 的 cleanup 可能未执行

## 建议方案

在 catch 块中添加清理逻辑：

```typescript
catch (err) {
  this.enforcers.delete(name);
  const gw = this.gateways.get(name);
  if (gw) {
    await gw.disconnect().catch(() => {});
    this.gateways.delete(name);
  }
  throw err;
}
```

## 相关文件

- `packages/acp/src/connection-manager.ts` — `connect()` 方法
