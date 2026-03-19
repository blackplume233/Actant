# Changelog v0.2.6

> v0.2.5 → v0.2.6 | 2026-02-27

## Features

- feat(core): heartbeat .heartbeat file convention + Pi baseUrl fix + plugin runtime RPC (#14, #255) (28438eb)
- feat(session): introduce stable conversationId for continuous conversation history (01c2e15)
- feat(core): implement six-plug ActantPlugin system + PluginHost (#14) (a10d8ba)
- feat(rest-api): add POST /v1/templates route for template creation (#252) (eca6610)
- feat(dashboard): orchestration UI, archetype system, and agent enhancements (316b242)
- feat(core): budget-aware agent lifecycle and template event auditing (b049bb6)
- feat(logo): deploy user-designed Nexus A logos to Wiki and Dashboard (affbc0c)
- feat(hub): replace placeholder components with kernel/auxiliary/spark template system (#204) (5448af1)
- feat(core): add structured log persistence and EventJournal (8c769ab)

## Bug Fixes

- fix(acp): add keepalive ping to prevent idle process exit on Windows (703d367)
- fix(chat): merge all employee session histories for continuous conversation (79f1690)
- fix(session): resolve session-not-found errors and improve session lifecycle (295a8c6)
- fix(shared): add internal.canvasUpdate/canvasClear/validateToken to RpcMethodMap (06fb76a)
- fix(core): replace require() with ES import in process-utils (c206c5e)
- fix(dashboard): remove unused imports (Bot, cn) caught by linter (13a2603)
- fix(daemon): process cleanup, signal handling, and Windows tree-kill (1aaa717)
- fix(rest-api,cli): error mapping, pagination validation, and dispatch UX (688b178)
- fix(core): template archetype/launchMode propagation and agent lifecycle (5912c25)

## Documentation

- docs(spec): update specs for conversationId, Windows keepalive, and QA patterns (4378213)
- docs(spec): add session-management spec and update frontend guidelines (822beff)
- docs(trellis): consolidate spec docs and add qa-fix command (7f23fa5)
- docs(planning): update phase4-employee-steps progress — 8/15 completed (5fa3b31)
- docs: update README and landing page for v0.2.5 (98f3c52)

## Refactor

- refactor(core): extract ContextProviders and template engine (#249) (f3308e3)

## Chore

- chore(trellis): sync issue cache - archive completed issues, pull new open issues (f130d11)
- chore: add QA reports, issue cache, and test artifacts (e453d0d)
- chore(journal): record session 28 鈥?#249 ContextProvider refactoring + QA regression (07b3b71)
- chore(journal): record session 27 — #228 archetype reclassification + v0.2.5 (ac271db)

## Merges

- docs: update api-contracts for PR #256 (conversationId in session RPC) (f99602a)
- merge: PR #256 - feat(session): stable conversationId + fix ACP keepalive on Windows (22afd20)
- docs: update spec for PR #254 (template.create + internal RPC types) (bbb8be1)
- merge: PR #254 - feat(rest-api): add POST /v1/templates + fix typecheck errors (ebbca71)
- docs: update spec for PR #253 (template events + SystemBudgetConfig) (4091252)
- merge: PR #253 - feat(dashboard): orchestration UI, budget-aware lifecycle, and template event auditing (95d3a2b)
- docs(spec): update api-contracts for PR #244 — pagination params and dispatch positional arg (ebd4c95)
- docs(spec): add template.launchMode field to config-spec for PR #243 (4ecf932)

