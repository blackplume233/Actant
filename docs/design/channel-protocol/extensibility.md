# Extensibility

**副标题**：ACP-EX 中的扩展机制

---

## Overview

ACP-EX 提供多种扩展机制，使 Backend 在不破坏协议兼容性的前提下增加自定义功能。

---

## adapterOptions（Connect 级）

在 `ChannelConnectOptions.adapterOptions` 中提供。协议层 MUST NOT 解读；直接透传给 adapter。每个 adapter 定义自己的 schema。

### Per-Adapter Examples

**AcpChannelAdapter**：

```typescript
{
  connectionOptions: { /* raw ACP options */ },
  activityRecorder: recorder,
  sessionToken: "token123"
}
```

**ClaudeChannelAdapter**：

```typescript
{
  model: "claude-sonnet-4-20250514",
  permissionMode: "acceptEdits",
  hooks: { /* Claude SDK hooks */ },
  agents: [{ name: "subagent", model: "..." }],
  thinking: { type: "enabled", budgetTokens: 10000 },
  effort: "high"
}
```

**PiChannelAdapter**：

```typescript
{
  personality: "professional",
  voiceMode: true
}
```

---

## backendOptions（Prompt 级）

在 `PromptOptions.backendOptions` 中提供。协议层 MUST NOT 解读；按 prompt 透传给 adapter。允许按 prompt 定制 backend 特有功能。

---

## x_ Namespace

- 所有 ACP-EX 扩展事件类型使用 `x_` 前缀
- 所有扩展内容类型使用 `x_` 前缀（如 `x_structured`）
- 所有扩展传输类型使用 `x_` 前缀（如 `x_sdk`）
- 避免与未来 ACP 标准类型冲突

---

## ChannelCapabilities.extensions

- 字符串标识符数组，表示 backend 特有能力
- 示例：`["hooks", "agents", "plugins", "effort"]`
- Host 可据此启用 adapter 特有 UI 功能
- 无标准语义；完全由 adapter 定义

---

## ChannelHostServices.invoke()

详见 [Extended Services](./extended-services.md)。

作为 Backend → Host 调用的 ultimate extension point。方法名 SHOULD 使用命名空间格式：`"x_<vendor>/<category>/<method>"`。

---

## Comparison with ACP Extensibility

| Mechanism | ACP | ACP-EX |
|-----------|-----|--------|
| Custom data | 所有类型上的 `_meta` 字段 | `adapterOptions` / `backendOptions` 透传 |
| Custom methods | `_` 前缀的 JSON-RPC 方法 | `invoke()` + `x_` 事件类型 |
| Custom capabilities | capability 对象中的 `_meta` | `ChannelCapabilities.extensions[]` |
| Naming convention | `_` 前缀 | `x_` 前缀 |
