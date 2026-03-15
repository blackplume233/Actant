## Background

Two minor architectural observations from Pi Mono comparison that should be tracked.

## A4: CLI Command Layering

**Current**: `actant` binary has ~70 leaf commands, ~110 RPC handlers, 19 command groups.
**Pi**: 1 binary (`pi`), ~20 commands.

Actant is a platform (more commands are expected), but could benefit from:
- [ ] Distinguishing "daily commands" (agent create/start/stop/chat/prompt) from "admin commands" (template/skill/source/plugin/...)
- [ ] Alias system: `actant chat my-agent` instead of `actant agent chat my-agent`
- [ ] Not requiring 1:1 CLI-to-RPC mapping for every RPC method

## A6: Event System Layering

**Current**: 6 event mechanisms across 3 layers:
1. HookEventBus (core) - agent lifecycle hooks
2. ActionRunner (core) - hook-triggered actions
3. HookRegistry (core) - hook declaration registration
4. ChannelEvent (ACP-EX) - channel layer events
5. SessionUpdate (ACP compatible) - session notifications
6. ActivityRecord (api) - activity recording

**Proposed**: Document clear event layer hierarchy in ACP-EX spec:
- [ ] ChannelEvent = core event surface (what adapters emit)
- [ ] HookEventBus = platform-level lifecycle events (derived from ChannelEvents + internal state changes)
- [ ] ActivityRecord = recording/audit layer (consumes from ChannelEvents)

## Priority

P3 - Long-term improvements
