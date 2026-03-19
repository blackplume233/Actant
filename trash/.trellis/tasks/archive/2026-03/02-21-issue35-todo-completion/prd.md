# Issue #35 待办完成

## 目标

完成 Issue #35 的剩余待办事项，确保 ACP Proxy + Agent Chat 双模式功能完整。

## 需求

### 1. 实现 session.cancel 与 ACP cancel 集成

当前 `session.cancel` 仅记录日志，需要实际调用 ACP cancel。

**实现细节:**
- 在 `handleSessionCancel` 中获取 session lease
- 通过 `acpConnectionManager.getConnection()` 获取 ACP 连接
- 调用 `conn.cancel(sessionId)` 发送 cancel 请求
- 处理错误情况（session 不存在、无 ACP 连接等）

### 2. 更新 api-contracts.md 第 7 节

当前文档第 7 节仍描述"架构重设计中"，需要更新为反映实际实现的状态。

**需要更新的内容:**
- 更新 ACP Gateway 架构描述（已废弃，改为 Direct Bridge + Session Lease 双模式）
- 添加 Session Lease API 文档（session.create/prompt/cancel/close/list）
- 更新实现状态标记

### 3. 关闭 Issue #35

所有待办完成后，关闭 Issue #35。

## 验收标准

- [ ] `session.cancel` 实际调用 ACP cancel 方法
- [ ] `api-contracts.md` 第 7 节反映实际实现
- [ ] Issue #35 标记为完成

## 技术笔记

### session.cancel 实现路径

```typescript
const lease = ctx.sessionRegistry.get(sessionId);
if (!lease) throw new Error(`Session "${sessionId}" not found`);

const conn = ctx.acpConnectionManager.getConnection(lease.agentName);
if (!conn) throw new Error(`No ACP connection for agent "${lease.agentName}"`);

await conn.cancel(sessionId);
```

### AppContext 接口

需要确认 `AppContext` 是否暴露 `acpConnectionManager`，可能需要调整接口。
