---
id: 280
title: "feat(spec): ACP-EX Steering/Follow-up mid-turn messaging [Pi-B2]"
status: closed
labels:
  - enhancement
  - acp
  - docs
  - "priority:P0"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#280"
closedAs: completed
createdAt: "2026-03-15T08:03:21Z"
updatedAt: "2026-03-18T06:39:15"
closedAt: "2026-03-18T06:36:51Z"
---

## Background

Through architectural comparison with [Pi Mono](https://github.com/badlogic/pi-mono), we identified that Pi's `Agent` core has a built-in **Steering/Follow-up dual-queue** mechanism, allowing users to inject messages during agent execution rather than only cancel + re-prompt.

## Motivation

ACP-EX currently has a simple `prompt()` + `cancel()` model:
- User wants to redirect mid-execution -> must cancel the entire prompt and re-send
- User wants to queue additional tasks after agent finishes -> must wait and manually send

Pi's steering/follow-up pattern solves this:
- **steering** = interrupt current tool execution, inject new instruction (e.g. "wait, don't continue that")
- **follow-up** = auto-append after agent completes (e.g. "after you finish this, also do that")

This is valuable for Dashboard Chat, CLI interaction, and Agent-to-Agent communication.

## Spec Changes

### Update `docs/design/channel-protocol/prompt-turn.md`
- [ ] Add `steer(sessionId, message)` method definition
- [ ] Add `followUp(sessionId, message)` method definition
- [ ] Add `SteeringMode` / `FollowUpMode` config (`"one-at-a-time"` | `"all"`)
- [ ] Update Prompt Turn sequence diagram with steering branch
- [ ] Add capability: `capabilities.steering`, `capabilities.followUp`

### Update `docs/design/channel-protocol/session-events.md`
- [ ] Add `x_steering_injected` event type
- [ ] Add `x_followup_queued` event type

### Update `docs/design/channel-protocol/session-config.md`
- [ ] Add well-known config keys: `steeringMode`, `followUpMode`

## Reference

Pi source: `packages/agent/src/agent.ts`
- `steer()` / `followUp()` methods
- `dequeueSteeringMessages()` / `dequeueFollowUpMessages()` consumption logic
- `SteeringMode: "all" | "one-at-a-time"` config

## Acceptance Criteria

- [ ] ACP-EX spec fully defines steer/followUp interfaces
- [ ] At least one adapter (ClaudeChannelAdapter) capability mapping is described
- [ ] Related to #279 unified communication layer

## Priority

P0 - Directly related to #279 unified communication layer convergence
