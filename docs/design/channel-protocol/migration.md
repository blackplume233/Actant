# Migration

This document tracks the channel protocol migration from the legacy ACP-shaped manager contract to the unified `ActantChannel` protocol.

---

## Status

Phase 1-3 are now functionally in place for the production paths used by `AgentManager`.

Completed implementation scope:

- `@actant/core` owns the protocol surface in `packages/core/src/channel/types.ts`
- `AgentManager` connects through `channelManager` / `ActantChannelManager`
- `RoutingChannelManager` delegates by backend type and preserves per-agent capability lookup
- `RecordingChannelManager` and `RecordingChannelDecorator` record both native `ChannelEvent` payloads and legacy `StreamChunk` fallbacks
- `@actant/acp` accepts `hostServices` and bridges callbacks through `RecordingCallbackHandler` / `ClientCallbackRouter`
- `@actant/channel-claude` emits protocol-native `ChannelEvent` values on each mapped SDK chunk
- lifecycle regressions in `AgentManager` were re-baselined with deterministic tests plus endurance coverage

Remaining migration posture:

- `StreamChunk` remains supported as the compatibility transport shape for existing consumers
- `StreamChunk.event` is the progressive migration hook; new adapters SHOULD attach native protocol events
- legacy ACP-like interfaces remain temporarily supported where `AgentManager` still accepts compatibility managers during transition

---

## Current Protocol Surface

### `ChannelCapabilities`

The live capability surface is defined in `packages/core/src/channel/types.ts` and currently includes:

- stream control: `streaming`, `cancel`, `resume`, `multiSession`
- host integration: `callbacks`, `needsFileIO`, `needsTerminal`, `needsPermission`
- output semantics: `structuredOutput`, `thinking`, `contentTypes`
- dynamic runtime features: `configurable`, `dynamicMcp`, `dynamicTools`
- adapter extensions: `extensions`

`AgentManager` stores the returned capabilities per agent and uses them to decide whether prompt execution should stay on the channel path or fall back to communicator-based execution.

### `ChannelHostServices`

The host service contract is also live in `packages/core/src/channel/types.ts`.

Core callbacks in active use:

- `sessionUpdate()` for out-of-band event delivery
- file / permission / terminal callbacks for ACP-backed routes
- `activityRecord()` and `activitySetSession()` for recording integration
- `executeTool()` / `invoke()` / VFS hooks reserved for richer adapter integrations

### `ChannelEvent`

The current event model is protocol-native and adapter-agnostic.

Implemented event families in active use today:

- text/thinking stream events: `agent_message_chunk`, `agent_thought_chunk`
- tool lifecycle events: `tool_call`, `tool_call_update`
- prompt lifecycle extensions: `x_prompt_start`, `x_prompt_end`
- terminal/result extensions: `x_result_success`, `x_result_error`
- recording passthrough: `x_activity_record`

`event-compat.ts` remains the single compatibility bridge between protocol-native events, legacy `StreamChunk`, and record entries.

---

## Compatibility Strategy

The migration is intentionally additive.

- Adapters SHOULD emit `StreamChunk` values with `chunk.event` populated
- Consumers that only understand the old four-variant stream shape may continue using `type`/`content`
- Recording always prefers native `ChannelEvent`, then falls back through `legacyChunkToChannelEvent()`
- `channelEventToStreamChunk()` exists only for event types with meaningful legacy display equivalents; unsupported events remain out-of-band via `sessionUpdate()`

This lets protocol-native adapters coexist with older consumers while reducing semantic loss over time.

---

## Adapter Matrix

### Claude SDK adapter

`@actant/channel-claude` is now treated as a native channel adapter.

Supported today:

- streaming prompt delivery
- cancellation
- resumable SDK session reuse
- dynamic MCP registration
- host tool registration bookkeeping
- native `ChannelEvent` emission from SDK messages
- callback bridge through `ChannelHostServices.sessionUpdate()` and `activitySetSession()`

### ACP adapter

`@actant/acp` remains the transport-heavy implementation for managed ACP backends.

Supported today:

- command/args/resolvePackage compatibility in connect options
- host callback injection for file IO / terminal / permissions
- recording callback decoration with activity session override support
- gateway / lease path reuse

---

## Recording Responsibilities

Recording is intentionally split by boundary.

- ACP callback-side recording captures backend-initiated callback traffic through `RecordingCallbackHandler`
- channel-side recording captures prompt stream output through `RecordingChannelDecorator`
- `RecordingChannelManager` owns the activity session override used to avoid duplicate accounting across shared service prompts

The rule of thumb is:

- callback traffic is recorded where ACP callbacks are intercepted
- prompt/event traffic is recorded where `ActantChannel.streamPrompt()` is consumed

---

## Regression Baseline

The migration is now guarded by:

- manager lifecycle unit coverage in `packages/core/src/manager/agent-manager.test.ts`
- scenario coverage in `packages/core/src/manager/agent-lifecycle-scenarios.test.ts`
- channel protocol compatibility coverage in `packages/core/src/channel/*.test.ts`
- ACP callback/session coverage in `packages/acp/src/__tests__/*.test.ts`
- endurance regression in `packages/core/src/manager/agent-manager.endurance.test.ts`

Required quick-check command after lifecycle or communication changes:

```bash
ENDURANCE_DURATION_MS=5000 pnpm test:endurance
```
