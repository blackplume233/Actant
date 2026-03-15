# Unified Communication Layer

> This document is the authoritative specification for Actant's communication model.
> It defines how `repo`, `service`, and `employee` instances expose runtime communication, how external and internal callers route requests, and how Actant presents a stable runtime facade even when the underlying backend is `claude-code` or another adapter.
> **If code or secondary docs conflict with this document on communication semantics, this document wins.**

---

## 1. Purpose and Scope

Actant historically accumulated multiple overlapping communication paths:

- `agent.prompt` for already-running ACP-backed agents
- `agent.run` for one-shot or direct prompt execution
- `proxy` for ACP-facing external clients
- session lease for Dashboard service chat
- backend-specific quirks such as `claude-code` ACP bridge behavior

That fragmentation created inconsistent expectations around what a running `service` means, whether `proxy` should connect to the shared service or create a fallback process, and whether internal agent-to-agent communication should follow the same model as external clients.

This spec establishes a single communication architecture with four goals:

1. `service` is the shared runtime communication target.
2. `proxy` defaults to lease semantics when the target service is already running.
3. Actant presents a stable external runtime facade; backend engines such as `claude-code` are internal adapters, not the public model.
4. External and internal agent communication share one communication model, with different transports but the same routing semantics.

---

## 2. Normative Principles

### 2.1 Control-plane first

Actant owns communication routing at the control plane.

- Callers target an **Actant agent runtime**, not a backend executable.
- Backends expose capabilities through adapters.
- `claude-code`, `pi`, or future runtimes are implementation details behind the Actant facade.

### 2.2 One communication model, many surfaces

CLI, Dashboard, ACP proxy, REST/RPC, and internal agent callers must resolve onto the same core communication concepts:

- runtime target
- route
- lease
- conversation
- readiness state
- prompt delivery

Surface-specific UX may differ, but routing semantics must stay aligned.

### 2.3 Service-first shared runtime

For `service` archetype, the default assumption is:

- there is one shared managed runtime per instance
- callers communicate with that managed runtime
- multi-client access is coordinated through leases and conversations
- ephemeral fallback is an exception path, not the default product story

### 2.4 Running implies communication-ready intent

A running `service` is not merely process-alive. It is expected to be communication-ready for its supported routes.

If the runtime is process-alive but not leasable or not prompt-capable, it is not fully ready and must not be described as healthy service runtime readiness.

### 2.5 Backend facade rule

Externally, users and clients interact with **Actant runtime semantics**:

- Actant service
- Actant lease
- Actant conversation
- Actant prompt route

They do not need to reason about `claude-code` session internals, bridge binaries, or backend-specific lifecycle quirks unless debugging an adapter issue.

---

## 3. Core Terms

| Term | Definition |
|------|------------|
| **Runtime target** | The communication destination selected by Actant routing. Usually an AgentInstance runtime. |
| **Shared runtime** | A managed runtime intended to serve multiple callers over time. `service` uses this model by default. |
| **Backend adapter** | The implementation bridge that maps Actant communication requests onto a backend such as `claude-code`. |
| **Lease** | A temporary caller-to-runtime binding used to coordinate access to a shared runtime while preserving conversation identity and routing metadata. |
| **Conversation** | A stable logical thread of interaction. It is caller-visible and can outlive individual ACP sessions or lease renewals. |
| **ACP session** | A backend/protocol session used internally for ACP communication. It is not the primary user-facing thread identity. |
| **Route** | The resolved communication path Actant chooses for a request, such as shared-service lease, direct ACP bridge, or one-shot run compatibility mode. |
| **Readiness** | The runtime's ability to accept communication through a given route, not just its process liveness. |

---

## 4. Communication Architecture

### 4.1 Layered model

```text
Caller Surface
  -> CLI / Dashboard / ACP Proxy / REST-RPC / Internal Agent Call
Communication Router
  -> target resolution / policy / readiness / lease routing / conversation routing
Runtime Facade
  -> Actant-managed agent runtime semantics
Backend Adapter
  -> claude-code / pi / future backend-specific bridge
Backend Process / Session
```

The communication router is the authoritative decision point.

It decides:

- whether the target is a shared managed runtime or an ephemeral/direct route
- whether a lease is required or may be synthesized
- whether the runtime is ready for prompt delivery
- which conversation ID should be attached or created
- which backend adapter should receive the final request

### 4.2 Router responsibilities

The router abstraction may be implemented across existing modules today, but the architecture contract is singular.

The router owns these decisions:

1. Resolve target instance and archetype.
2. Resolve communication policy defaults.
3. Check runtime readiness.
4. Select route.
5. Bind or create lease/conversation state as needed.
6. Deliver prompt or ACP session interaction through the backend adapter.
7. Return Actant-level result metadata.

Current code paths that collectively implement or must later consolidate this router include:

- `packages/cli/src/commands/proxy.ts`
- `packages/cli/src/commands/agent/prompt.ts`
- `packages/cli/src/commands/agent/chat.ts`
- `packages/core/src/manager/agent-manager.ts`
- `packages/api/src/handlers/agent-handlers.ts`
- session handlers and registry components referenced by `session-management.md`

---

## 5. Readiness Model

### 5.1 Readiness dimensions

A managed runtime may expose multiple readiness dimensions.

| Field | Meaning | Notes |
|------|---------|-------|
| `processAlive` | Backend process exists and is alive | Necessary but insufficient |
| `acpConnected` | Actant has an active ACP-capable connection to the managed runtime | Required for ACP-backed prompt delivery |
| `promptReady` | Runtime can accept prompt delivery through the selected route | Product-level readiness |
| `leasable` | Runtime can accept or resume lease-backed communication | Required for shared service chat/proxy |
| `conversationReady` | Runtime can continue or create conversation state for the selected caller | Usually derived from lease/session systems |
| `communicationReady` | Aggregate product signal indicating the runtime can serve its default route | Required for healthy running service |

### 5.2 Service readiness rule

For `service`, `status = running` is intended to imply `communicationReady = true` for the default route.

That means a healthy running service should normally satisfy:

- `processAlive = true`
- `acpConnected = true` when ACP-backed backend is used
- `promptReady = true`
- `leasable = true`
- `communicationReady = true`

If implementation cannot yet guarantee this, that gap is a runtime defect or incomplete implementation against this spec, not an alternative product definition.

### 5.3 Employee readiness rule

`employee` also uses managed communication, but its shared-runtime semantics are subordinate to scheduling and daemon ownership.

- direct user prompting may remain simpler than service lease flow
- internal runtime communication still maps to the same router vocabulary
- employee-specific scheduling does not justify a separate communication model

### 5.4 Repo readiness rule

`repo` is not a continuously shared managed runtime by default.

- on-demand ACP direct/open flows remain valid
- readiness is route-specific rather than shared-service specific
- `repo` does not imply lease-backed communication by default

---

## 6. Routes and Defaults

### 6.1 Canonical routes

| Route | Description | Typical usage |
|------|-------------|---------------|
| `service-lease` | Caller communicates with a running shared service runtime via lease semantics | Dashboard chat, ACP proxy to running service, future REST chat |
| `service-direct-bootstrap` | Caller requests communication to a service target that is not yet ready; Actant starts or restores the shared runtime, then continues via lease semantics | startup or recovery path |
| `direct-bridge` | Caller owns a direct ACP bridge to a dedicated process | repo flows, explicit isolation, compatibility/debug cases |
| `one-shot-run` | Caller requests a non-shared prompt execution path | task-style invocation, compatibility mode |
| `internal-lease` | Internal agent/runtime communication routed to shared service semantics | agent-to-agent requests into a service target |

### 6.2 Archetype defaults

| Archetype | Default communication target | Default route | Notes |
|-----------|------------------------------|---------------|------|
| `repo` | On-demand runtime for the requested interaction | `direct-bridge` or open/direct ACP | Not a shared lease-first target |
| `service` | Shared managed runtime | `service-lease` | Primary communication baseline |
| `employee` | Managed daemon-owned runtime | lease-compatible managed route | Same model, different product constraints |

### 6.3 Proxy default rule

For a **running service** target, `proxy` defaults to `service-lease` semantics.

Normative behavior:

- If the target agent is `service` and is communication-ready, `proxy <name>` should attach through lease semantics by default.
- Users may still request an explicit direct route when supported, but that is opt-in.
- Historical direct-bridge-first behavior for running services is superseded by this spec.

### 6.4 Run compatibility rule

`run` is not the primary communication surface for shared `service` runtimes.

Normative interpretation:

- `service` communication should primarily route through prompt/lease/session semantics.
- `agent.run` for `service` is either:
  - a compatibility mapping onto the unified communication router, or
  - a non-primary route with reduced guarantees.
- Product docs and contracts must not imply that `run` is the canonical path for long-lived shared service interaction.

### 6.5 Occupied-instance rule

When a service instance is already running, that is **not** an occupied-state error demanding default ephemeral duplication.

Instead:

- the running service is the intended communication target
- lease-backed sharing is the default resolution
- ephemeral fallback is reserved for explicit isolation strategies, unsupported lease scenarios, or archetypes/routes that require dedicated processes

---

## 7. External Communication Surfaces

### 7.1 CLI

CLI commands are surface adapters over the unified communication router.

Expected alignment:

- `agent prompt` -> shared runtime communication request
- `agent chat` -> conversational communication request
- `proxy` -> ACP-facing surface over the same route selection logic
- `agent run` -> one-shot or compatibility request, not the primary shared-service contract

### 7.2 Dashboard

Dashboard chat for `service` must use session/lease semantics consistent with this document and `session-management.md`.

Dashboard must treat a running service as:

- shared runtime target
- lease-backed conversational endpoint
- not merely a process status indicator

### 7.3 ACP proxy

The ACP proxy is an external protocol adapter, not an alternative product model.

For running services:

- default to lease-backed access
- preserve Actant conversation and lease semantics behind ACP adaptation
- present a stable ACP-facing runtime facade even if backend adapters vary internally

### 7.4 REST/RPC and future communication APIs

RPC methods such as `agent.prompt`, `session.*`, and any future `communication.request` surface must align to the same routing semantics.

A future explicit communication API is recommended if it helps consolidate:

- route selection
- readiness checks
- conversation identity
- shared service policy

But even before such an API exists, existing methods are governed by this unified model.

---

## 8. Internal Agent-to-Agent Communication

### 8.1 Unified model requirement

Internal agent-to-agent communication must not invent a separate conceptual model from external communication.

Whether the caller is:

- a human through CLI
- a dashboard client
- an IDE over ACP
- another Actant-managed agent

The same concepts apply:

- target runtime
- route
- lease or lease-equivalent binding
- conversation identity
- readiness
- backend adapter delivery

### 8.2 Internal route mapping

Internal communication may use different transports, such as Email, RPC, MCP, or future internal tools, but these are transport wrappers over the same communication router semantics.

For internal calls into `service`, the default target remains the shared runtime, not an ad hoc dedicated process.

### 8.3 Service sharing guarantee

A `service` exposed internally is still the same service exposed externally.

There is no separate “internal service communication model” and “external proxy communication model.” There is one service communication model with multiple surfaces.

---

## 9. Communication Policy Configuration

A forward contract for communication policy is authoritative even if some implementation fields are not fully wired yet.

### 9.1 `communicationPolicy`

`communicationPolicy` defines how a template or instance expects runtime communication to be routed.

| Field | Type | Meaning |
|------|------|---------|
| `sharingMode` | `"exclusive" | "shared" | "pooled"` | Whether callers share a runtime, require exclusivity, or may use a bounded pool |
| `defaultRoute` | `"lease" | "direct" | "run"` | Default communication route selection |
| `occupiedStrategy` | `"lease" | "queue" | "ephemeral" | "reject"` | What to do when an existing runtime is already serving requests |
| `promptTarget` | `"service" | "session" | "backend"` | Product-level target abstraction for prompt delivery |
| `maxInstances` | `number` | Upper bound for multi-instance service scaling |

### 9.2 Archetype guidance

Recommended defaults:

| Archetype | sharingMode | defaultRoute | occupiedStrategy | promptTarget |
|-----------|-------------|--------------|------------------|-------------|
| `repo` | `exclusive` | `direct` | `ephemeral` | `backend` |
| `service` | `shared` | `lease` | `lease` | `service` |
| `employee` | `shared` | `lease` | `queue` or `lease` | `service` |

### 9.3 Forward-authoritative rule

Even where implementation is incomplete, these fields are the intended contract and should be treated as spec-authoritative planned surfaces.

Secondary docs must mark missing implementation as a gap against this contract, not redefine the contract.

---

## 10. Backend Facade and Adapter Semantics

### 10.1 External identity

Actant is the runtime facade.

Externally stable concepts include:

- Actant service runtime
- Actant communication route
- Actant conversation
- Actant lease
- Actant readiness state

### 10.2 Internal identity

Backend engines are adapters.

Examples:

- `claude-code` is a managed primary backend adapter
- ACP bridge binaries are adapter implementation details
- backend capability quirks must be normalized by Actant wherever possible

### 10.3 Adapter contract

Backend adapters must expose enough capability metadata for the router to determine:

- whether managed ACP connection is available
- whether prompt delivery is supported
- whether the backend can satisfy service readiness guarantees
- whether special compatibility handling is needed

Backend capability limitations must not leak into user-facing semantics more than necessary.

---

## 11. QA Findings Resolved by This Spec

This document explicitly resolves the QA-observed ambiguities from `.trellis/tasks/03-14-qa-loop/qa-report-round1.md`.

### 11.1 `service + claude-code` and `run`

Observed gap:

- QA found `service + claude-code` supported `start, proxy` but not `run` as expected.

Spec resolution:

- `run` is not the primary shared-service communication path.
- Shared service communication is defined through prompt/lease/session semantics.
- If `run` remains available, it should be documented as compatibility or mapped behavior, not the core service contract.

### 11.2 Proxy fallback on running service

Observed gap:

- QA saw `proxy` entering occupied -> ephemeral fallback for a running service.

Spec resolution:

- Running service is the intended shared communication target.
- Lease-first routing replaces ephemeral fallback as the default behavior.
- Ephemeral duplication becomes an exception path.

### 11.3 Running without communication readiness

Observed gap:

- Runtime status could indicate running while communication expectations were still unmet.

Spec resolution:

- Service running is intended to imply communication-ready default routing.
- Readiness must include prompt and lease viability, not just process liveness.

### 11.4 Backend-specific leakage

Observed gap:

- Current behavior exposes `claude-code` capability quirks too directly in the product story.

Spec resolution:

- Actant is the external runtime facade.
- Backend behavior is normalized through the adapter and router layers.

---

## 12. Code Mapping and Implementation Follow-up

The following files are the primary implementation surfaces that must ultimately conform to this spec:

- `packages/cli/src/commands/proxy.ts`
- `packages/cli/src/commands/agent/prompt.ts`
- `packages/cli/src/commands/agent/chat.ts`
- `packages/core/src/manager/agent-manager.ts`
- `packages/api/src/handlers/agent-handlers.ts`
- `packages/core/src/initializer/archetype-defaults.ts`
- runtime session/lease modules referenced by `.trellis/spec/session-management.md`

### 12.1 Unified TUI Surface (`@actant/tui`)

所有 CLI 交互式聊天界面统一使用 `@actant/tui` 包（基于 `@mariozechner/pi-tui`），替代原有 `node:readline` + 手写 ANSI 方案。

| 组件 | 职责 |
|------|------|
| `ActantChatView` | 高层聊天视图：Editor（用户输入）+ Markdown（助手响应）+ Loader（等待状态）组合 |
| `StreamingMarkdown` | 从 `StreamChunk` 流式增量渲染 Markdown 内容 |
| `ProcessTerminal` | 生产环境终端适配（`process.stdin/stdout`） |
| `VirtualTerminal` | 测试用无头终端（`@xterm/headless`），详见 `quality-guidelines.md §TUI Testing` |

**已迁移的 CLI 入口**:

- `packages/channel-claude/src/bin/test-chat.ts` — ACP-EX test TUI
- `packages/cli/src/commands/agent/chat.ts` — `actant agent chat` 命令（daemon / direct-bridge 双路径）

**架构规则**:
- 新增交互式 CLI 聊天功能必须使用 `ActantChatView`，禁止 `readline.createInterface()`
- `@actant/tui` 仅依赖 `@actant/core`（`StreamChunk` 类型）和 `@mariozechner/pi-tui`，不引入 CLI 或 API 层的耦合
- 主题和样式集中在 `packages/tui/src/theme.ts`，各消费方不应自行硬编码终端样式

> 引入于 #279 Phase 1。协议设计详见 [ACP-EX](../../docs/design/channel-protocol/README.md)。

Expected future implementation work includes:

1. Consolidate route selection into an explicit communication router abstraction.
2. Make running `service` map to communication readiness, not only process liveness.
3. Make `proxy` default to lease when targeting a running service.
4. Align `agent.prompt`, Dashboard chat, and internal agent-to-agent requests to one route model.
5. Normalize backend capability handling under Actant facade semantics.

---

## 13. Acceptance and Verification

### 13.1 Documentation acceptance

This spec update is accepted only if the following remain consistent:

- `.trellis/spec/index.md`
- `.trellis/spec/agent-lifecycle.md`
- `.trellis/spec/api-contracts.md`
- `.trellis/spec/config-spec.md`
- `docs/planning/roadmap.md`
- architecture source/stage docs that describe the runtime facade

### 13.2 Runtime acceptance targets

After implementation catches up, the system must verify at least:

1. `service` start implies communication readiness for the default route.
2. `agent.prompt` works against a running service runtime.
3. `proxy` defaults to lease for a running service.
4. Dashboard chat uses session/lease semantics for service.
5. Internal agent-to-agent communication resolves through the same communication layer concepts.

### 13.3 Regression focus

Future QA should explicitly detect regressions in:

- occupied service instances incorrectly spawning ephemeral fallbacks by default
- running service states that are not prompt-ready or leasable
- proxy/chat behavior diverging from Dashboard/session semantics
- backend adapter quirks leaking into user-facing contract language
