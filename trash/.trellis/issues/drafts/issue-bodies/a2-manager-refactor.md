## Background

Pi's `Agent` class is ~400 lines with 13 public methods, focused on state + event emission. Actant's `AgentManager` is ~1234 lines with 23+ methods, simultaneously handling instance CRUD, process lifecycle, communication routing, session management, context injection, and budget management.

## Current AgentManager Responsibilities (too many)

1. Instance CRUD (create/destroy)
2. Process lifecycle (start/stop/restart)
3. Communication routing (prompt/stream -> channel -> backend adapter)
4. Session management (resolve/attach/detach)
5. Context injection (SessionContextInjector integration)
6. Budget management (SystemBudget integration)

## Proposed Refactoring

Split into three focused components following Pi's layering:

1. **AgentManager (slim)** - Only instance CRUD + lifecycle + state queries
   - Pi equivalent: `Agent` state management
2. **CommunicationRouter (new)** - Extracted from `communication-layer.md` spec, handles route decisions, lease management, readiness checks
   - This is already specified but not implemented as a standalone component
3. **ChannelOrchestrator (enhanced ActantChannelManager)** - Prompt orchestration, streaming management, steering/follow-up queues
   - Pi equivalent: `AgentLoop`

## Expected Outcome

- AgentManager LOC drops 30%+
- CommunicationRouter becomes the single authority for route decisions (currently scattered across cli/proxy.ts, cli/prompt.ts, cli/chat.ts, core/agent-manager.ts, api/agent-handlers.ts)
- Clear separation matches the communication-layer.md spec architecture

## Acceptance Criteria

- [ ] AgentManager refactored to under 800 lines
- [ ] CommunicationRouter exists as explicit abstraction
- [ ] All route decision code consolidated into router
- [ ] Existing tests pass after refactoring

## Priority

P2 - Medium-term, after #279 channel abstraction stabilizes

## Reference

Pi: `Agent` (~400 LOC) + `AgentLoop` (separate module) + `streamSimple` (LLM API)
