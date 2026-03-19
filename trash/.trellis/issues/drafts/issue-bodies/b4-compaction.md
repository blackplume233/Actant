## Background

Pi Mono has built-in context compaction: long sessions can auto/manually compress old messages to keep context window usable. Actant ACP-EX currently defines no context compression semantics.

## Motivation

- **Service agent long-running**: service-mode agents may run for hours/days, conversation history exceeds context window
- **Dashboard long conversations**: users interact with service through Dashboard for extended periods
- **Cost control**: reduce tokens sent to LLM

## Spec Changes

### Update `docs/design/channel-protocol/session-config.md`
- [ ] Add well-known config key: `compaction`
- [ ] Define `CompactionPolicy` interface:
  ```typescript
  interface CompactionPolicy {
    mode: "auto" | "manual" | "off";
    threshold?: number;
    strategy?: "summarize" | "truncate" | "custom";
  }
  ```
- [ ] Add `compact(sessionId, options?)` method definition (Optional)
- [ ] Add capability: `capabilities.compaction`

### Update `docs/design/channel-protocol/session-events.md`
- [ ] Add `x_compaction_start` event type
- [ ] Add `x_compaction_complete` event type (with `{ before: number, after: number }` token stats)

## Reference

Pi source:
- `/compact [prompt]` manual compaction with custom instructions
- Auto compaction: triggers on context overflow (recover and retry) or approaching limit (proactive)
- Full history preserved in JSONL; compaction only affects content sent to LLM

## Acceptance Criteria

- [ ] ACP-EX spec fully defines CompactionPolicy and compact() interface
- [ ] Event types defined
- [ ] Auto/manual mode behavior differences described

## Priority

P1 - Implement after #279, related to session branching
