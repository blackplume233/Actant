# Session Config

**副标题**：Runtime session configuration

---

## Overview

Session 建立后，Host 可动态变更配置。涵盖：模式切换、配置项、运行时参数变更。通过 `ActantChannel.configure()` 实现。

---

## ActantChannel.configure()

> 在运行时配置 session 参数。

**Profile**：Core  
**Requirement**：Optional（`capabilities.configurable = true`）  
**ACP Equivalent**：`session/set_mode` + `session/set_config_option`

### Signature

```typescript
configure?(sessionId: string, config: Record<string, unknown>): Promise<void>;
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | 目标 session |
| config | Record<string, unknown> | Yes | 键值配置映射 |

### Well-known Config Keys

| Key | Type | ACP Equivalent | Description |
|-----|------|----------------|-------------|
| mode | string | session/set_mode | 切换操作模式 |
| autoApprove | boolean | (none) | 切换自动审批 |
| model | string | (none) | 更换模型 |
| thinking | object | (none) | 变更 thinking 模式 |

### Behavior

- Backend SHOULD 立即应用配置变更
- Backend MAY 发送 `config_option_update` 或 `current_mode_update` 事件以确认
- 未识别的 key SHOULD 被忽略（不报错）
- Host SHOULD NOT 假设所有 key 均被支持；应检查 capabilities 或使用 try/catch

### Checking Support

```typescript
if (!channel.capabilities.configurable || !channel.configure) {
  // 此 Backend 不支持配置
  return;
}
await channel.configure(sessionId, config);
```

### Example

```typescript
await channel.configure(sessionId, { mode: "code", autoApprove: true });
```
