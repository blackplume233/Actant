# Extended Services

**副标题**：VFS、Activity Recording 与通用扩展

---

## Overview

ACP-EX 在 ACP 之上扩展了平台特有的 Host 服务。这些服务均属于 Extended Profile，在 ACP 中无对应实现。Backend 通过 capabilities 声明对上述服务的需求。

---

## VFS (Virtual File System)

### Overview

VFS 为结构化数据提供虚拟文件命名空间。与真实文件系统不同，VFS 由 Host 管理，并 MAY 在 session 之间持久化。

> **⚠️ 命名空间更新**：ContextFS V1 的实际命名空间为 `/skills/*`、`/mcp/configs/*`、`/mcp/runtime/*`、`/agents/*`、`/projects/*`。下文中的 `/memory/`、`/proc/`、`/config/`、`/canvas/` 为协议层示例路径，实际路径以 [contextfs-architecture.md](../contextfs-architecture.md) 为准。

### ChannelHostServices.vfsRead()

> 从虚拟文件系统读取。

**Profile**：Extended  
**ACP Equivalent**：None

#### Signature

```typescript
vfsRead?(path: string): Promise<{ content: string }>;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| path | string | 虚拟路径（如 "/memory/context"、"/config/settings"） |

#### Behavior

- Host MUST 解析虚拟路径并返回内容
- 路径格式：`/<namespace>/<resource>`
- 若路径不存在，Host SHOULD 返回空内容或错误

#### Checking Support

Backend 在 `capabilities` 中声明对 VFS 的需求。Host 在注入 `ChannelHostServices` 时，若 Backend 需要 VFS，MUST 提供 `vfsRead` 实现。

---

### ChannelHostServices.vfsWrite()

> 写入虚拟文件系统。

**Profile**：Extended  
**ACP Equivalent**：None

#### Signature

```typescript
vfsWrite?(path: string, content: string): Promise<void>;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| path | string | 虚拟路径 |
| content | string | 要写入的内容 |

#### Behavior

- Host MUST 解析虚拟路径并写入内容
- Host MAY 对只读命名空间（如 `/proc/`）拒绝写入

---

## Activity Recording

### Overview

ACP-EX 将 activity recording 作为一等公民；ACP 则通过外部的 RecordingCallbackHandler 包装实现。Backend 可直接将事件记录到 Host 的 activity log。

### ChannelHostServices.activityRecord()

> 记录一条 activity 事件。

**Profile**：Extended  
**ACP Equivalent**：None（ACP 使用外部 RecordingCallbackHandler 包装）

#### Signature

```typescript
activityRecord?(event: ActivityEvent): Promise<void>;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| event | ActivityEvent | 要记录的事件 |

#### ActivityEvent

```typescript
interface ActivityEvent {
  type: string;
  data: unknown;
  timestamp?: number;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | 事件类型 |
| data | unknown | Yes | 事件数据 |
| timestamp | number | No | Unix 时间戳（毫秒） |

#### Behavior

- Host MUST 将事件追加到当前 activity session 的日志
- 若未调用 `activitySetSession()`，Host MAY 使用 channel 级默认 session

---

### ChannelHostServices.activitySetSession()

> 设置用于记录的当前 activity session。

**Profile**：Extended

#### Signature

```typescript
activitySetSession?(id: string | null): void;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string \| null | Session ID；传 `null` 清除，回退到 channel 级默认 |

#### Behavior

- 传 `null` 时，Host MUST 清除当前 session 绑定，回退到 channel 级默认

---

## Generic Extension

### ChannelHostServices.invoke()

> 调用未由类型化方法覆盖的任意 Host 服务。

**Profile**：Extended  
**ACP Equivalent**：None（ ultimate optionality escape hatch）

#### Signature

```typescript
invoke?(method: string, params: unknown): Promise<unknown>;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| method | string | 要调用的方法名（SHOULD 使用命名空间格式，如 "x_actant/budget/get"） |
| params | unknown | 方法特定参数 |

#### Behavior

- Host SHOULD 对无法识别的方法返回 method-not-found 错误
- 此方法为未来 Host 服务的扩展点，无需修改协议
- Backend SHOULD 在存在类型化方法时优先使用类型化方法

#### Checking Support

`invoke` 为可选方法。Host MAY 不实现；Backend 在调用前 SHOULD 检查 `hostServices.invoke` 是否存在。
