## Background

Pi Mono's `AgentLoopConfig` provides `beforeToolCall` / `afterToolCall` hooks that allow the host to intercept, block, or modify tool execution results. Actant ACP-EX currently only reports tool calls via events; the Host cannot intercept or modify tool execution.

## Motivation

- **Host-level security audit**: Host can block dangerous tool calls before execution
- **Result transformation**: Host can modify tool results before they return to LLM (e.g. redact sensitive info)
- **Policy enforcement**: Archetype-based tool restrictions at the protocol level, not just at adapter level
- **Agent App integration**: Agent Apps may need to intercept tool calls for custom workflows

## Spec Changes

### Update `docs/design/channel-protocol/tool-calls.md`
- [ ] Add `ChannelHostServices.beforeToolCall(context)` definition
- [ ] Add `ChannelHostServices.afterToolCall(context)` definition
- [ ] Define `BeforeToolCallResult` interface: `{ block?: boolean; reason?: string }`
- [ ] Define `AfterToolCallResult` interface: `{ content?: ...; isError?: boolean }`
- [ ] Define `BeforeToolCallContext` / `AfterToolCallContext` interfaces
- [ ] Add capability: `capabilities.toolHooks`

## Reference

Pi source: `packages/agent/src/types.ts`
- `BeforeToolCallContext` / `AfterToolCallContext`
- `BeforeToolCallResult` / `AfterToolCallResult`
- Block semantics: returning `{ block: true }` prevents execution, emits error result

## Acceptance Criteria

- [ ] ACP-EX spec fully defines beforeToolCall/afterToolCall host hooks
- [ ] Context and result interfaces defined
- [ ] Relationship with existing requestPermission flow documented

## Priority

P2 - Medium-term enhancement
