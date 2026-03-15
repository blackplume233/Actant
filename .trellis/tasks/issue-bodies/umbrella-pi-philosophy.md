## Summary

Absorb [Pi Mono](https://github.com/badlogic/pi-mono)'s simplicity philosophy into Actant's ACP-EX protocol and architecture. This is an umbrella issue tracking all related work items identified through deep architectural comparison.

Pi's Agent core is ~400 lines with a "minimal core, hooks out" philosophy. Actant's `AgentManager` is ~1234 lines with 20 submodules in `@actant/core`. This initiative brings Pi's design discipline into Actant at two levels: **protocol semantics** (ACP-EX spec) and **architecture refactoring** (code structure).

## Key Principles from Pi

1. **Minimal Core, Hooks Out** — Only `prompt()` is REQUIRED; everything else is capability-gated optional
2. **Steering/Follow-up** — Mid-turn messaging instead of cancel + re-prompt
3. **Session as First-Class Citizen** — Branching, compaction, tree navigation
4. **Tool Hooks** — `beforeToolCall`/`afterToolCall` for host-level interception
5. **Extension Simplicity** — Registration-based API, not class inheritance
6. **Core Does Less** — Features that aren't universally needed become optional subsystems

## Spec Updates (Protocol Layer)

| Priority | Issue | Title |
|----------|-------|-------|
| **P0** | #280 | [ACP-EX Steering/Follow-up mid-turn messaging](https://github.com/blackplume233/Actant/issues/280) |
| P1 | #281 | [ACP-EX Session Branching and Fork](https://github.com/blackplume233/Actant/issues/281) |
| P1 | #282 | [ACP-EX Context Compaction for long-running sessions](https://github.com/blackplume233/Actant/issues/282) |
| P2 | #283 | [ACP-EX Tool Hooks - beforeToolCall/afterToolCall](https://github.com/blackplume233/Actant/issues/283) |
| P2 | #284 | [ACP-EX Design Principles and Custom Message Types](https://github.com/blackplume233/Actant/issues/284) |

## Architecture Refactoring (Code Layer)

| Priority | Issue | Title |
|----------|-------|-------|
| P2 | #285 | [Evaluate @actant/core package split](https://github.com/blackplume233/Actant/issues/285) |
| P2 | #286 | [AgentManager slim-down and CommunicationRouter extraction](https://github.com/blackplume233/Actant/issues/286) |
| P2 | #288 | [Subsystem hot-pluggable architecture](https://github.com/blackplume233/Actant/issues/288) |
| P2 | #289 | [Platform Session vs Backend Session ownership model](https://github.com/blackplume233/Actant/issues/289) |
| P3 | #287 | [Agent App registration-based developer API](https://github.com/blackplume233/Actant/issues/287) |
| P3 | #290 | [CLI command layering and event system hierarchy](https://github.com/blackplume233/Actant/issues/290) |

## Execution Order

```
Phase 1 (with #279):  #280 Steering/Follow-up
Phase 2 (post #279):  #281 Branching + #282 Compaction + #289 Session ownership
Phase 3 (mid-term):   #283 Tool Hooks + #284 Principles + #285 Core split + #286 Manager refactor + #288 Subsystem
Phase 4 (long-term):  #287 Agent App API + #290 CLI/Events
```

## Acceptance Criteria

- [ ] All P0 issues completed
- [ ] All P1 issues completed
- [ ] ACP-EX spec documents updated with steering, branching, compaction semantics
- [ ] At least one P2 architecture issue (core split or manager refactor) evaluation completed

## Related

- #279 Unified Communication Layer Convergence (parent initiative)
- [Pi Mono repository](https://github.com/badlogic/pi-mono) (reference architecture)
