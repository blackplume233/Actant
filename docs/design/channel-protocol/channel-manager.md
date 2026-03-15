# Channel Manager

**副标题**：多连接管理

---

## Overview

`ActantChannelManager` 管理多个以名称区分的 Backend 连接。它是所有协议操作的顶层入口。Host 创建单一 manager 实例，并通过其连接或断开 Backend。

---

## ActantChannelManager Interface

```typescript
interface ActantChannelManager {
  connect(name: string, options: ChannelConnectOptions, hostServices: ChannelHostServices): Promise<{ sessionId: string; capabilities: ChannelCapabilities }>;
  has(name: string): boolean;
  getChannel(name: string): ActantChannel | undefined;
  getPrimarySessionId(name: string): string | undefined;
  getCapabilities(name: string): ChannelCapabilities | undefined;
  disconnect(name: string): Promise<void>;
  disposeAll(): Promise<void>;
}
```

---

## ActantChannelManager.connect()

详见 [Initialization](./initialization.md)。

---

## ActantChannelManager.has()

> 检查指定名称的连接是否存在。

#### Signature

```typescript
has(name: string): boolean;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | 要检查的连接名称 |

#### Behavior

- 若连接存在且未断开，返回 `true`
- Host SHOULD 在调用 `getChannel()` 前先检查

#### Checking Support

```typescript
if (channelManager.has("my-backend")) {
  const channel = channelManager.getChannel("my-backend");
  // ...
}
```

---

## ActantChannelManager.getChannel()

> 获取指定名称的 ActantChannel 实例。

#### Signature

```typescript
getChannel(name: string): ActantChannel | undefined;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | 连接名称 |

#### Return Value

- 若连接不存在，返回 `undefined`
- 返回的 channel 在 `disconnect()` 调用前保持有效

---

## ActantChannelManager.getPrimarySessionId()

> 获取指定连接的主 session ID。

#### Signature

```typescript
getPrimarySessionId(name: string): string | undefined;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | 连接名称 |

#### Return Value

- 返回 `connect()` 响应中的 sessionId
- 对于多 session Backend，此为初始 session

---

## ActantChannelManager.getCapabilities()

> 获取指定连接的能力声明。

#### Signature

```typescript
getCapabilities(name: string): ChannelCapabilities | undefined;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | 连接名称 |

#### Return Value

- 若连接不存在，返回 `undefined`
- 返回的 capabilities 与 `connect()` 返回的一致

---

## ActantChannelManager.disconnect()

> 断开指定名称的连接。

#### Signature

```typescript
disconnect(name: string): Promise<void>;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | 要断开的连接名称 |

#### Behavior

- MUST 优雅关闭 Backend 进程/连接
- 断开后，该名称 MAY 被复用用于新连接
- 断开后，`getChannel(name)` MUST 返回 `undefined`

---

## ActantChannelManager.disposeAll()

> 断开所有连接。

#### Signature

```typescript
disposeAll(): Promise<void>;
```

#### Behavior

- 在 Host 关闭时调用
- MUST 断开所有活跃连接
- SHOULD 幂等
