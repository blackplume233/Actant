# Thinking Guides

> **Purpose**: Expand your thinking to catch things you might not have considered.

---

## Why Thinking Guides?

**Most bugs and tech debt come from "didn't think of that"**, not from lack of skill:

- Didn't think about what happens at layer boundaries → cross-layer bugs
- Didn't think about code patterns repeating → duplicated code everywhere
- Didn't think about agent lifecycle edge cases → orphaned processes
- Didn't think about composability → rigid, non-reusable components

These guides help you **ask the right questions before coding**.

---

## Available Guides

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md) | Identify patterns and reduce duplication | When you notice repeated patterns |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | Think through data flow across layers | Features spanning CLI ↔ Core ↔ ACP/MCP/API |
| [Cross-Platform Guide](./cross-platform-guide.md) | Ensure Linux/macOS/Windows compatibility | Any feature touching IPC, signals, file paths, or process management |

### Design References (Mid-term)

| Design Doc | Purpose | Status |
|------------|---------|--------|
| [Memory Layer & Agent Evolution](../../../docs/design/memory-layer-agent-evolution.md) | Instance memory, cross-session learning, Template evolution | Draft — Mid-term |
| [Hub Agent Kernel (#204)](https://github.com/blackplume233/Actant/issues/204) | Platform-level agents, Asset System, `ac://` URI namespace | Active — Phase 4+ |

---

## Actant-Specific Thinking Triggers

### When to Think About Self-Bootstrapping (Actant-First Development)

- [ ] 需要获取技能（skill）、提示词（prompt）、工作流（workflow）
- [ ] 需要了解当前可用的 Agent 实例或 Daemon 状态
- [ ] 需要查询 Actant 支持哪些 RPC 方法
- [ ] 正在开发 Actant 自身的功能，考虑是否可以通过 Actant 来辅助

→ **首先尝试通过 Actant MCP 获取**（VFS read/list），如果失败则：
1. 分析失败原因（Daemon 未启动？RPC 未注册？VFS 源未挂载？）
2. 创建 Bug Issue 记录问题
3. 临时回退到本地文件系统获取数据
4. 后续修复 Actant 使其能提供该能力

**关键路径**：

```
vfs_list /              → 发现所有挂载点
vfs_read /skills/_catalog.json  → 获取技能目录
vfs_read /daemon/rpc-catalog.json → 发现可用 RPC 方法
actant({ method, params })     → 执行任意 daemon 操作
```

**自举心态**：开发过程中持续思考——「这个操作能否让 Actant 提供？」「这个信息能否通过 VFS 暴露？」「这个重复动作能否变成一个 Actant 技能？」

→ See [Quality Guidelines — Actant-First 自举开发模式](../backend/quality-guidelines.md#actant-first-自举开发模式)

### When to Think About MCP Tool Surface

- [ ] 添加新的 Daemon 能力（RPC handler）
- [ ] 考虑是否需要新的 MCP 工具
- [ ] 外部 Agent（Cursor、Claude）需要访问 Actant 数据

→ **不要添加新的 MCP 工具。** 遵循 VFS + RPC 网关架构：
- 读操作 → 创建新的 VFS 源并挂载（工具数保持 6 个不变）
- 写/动作操作 → 通过 `actant` RPC 网关调用（已有 RPC handler 自动可用）
- 自描述 → `vfs_read /daemon/rpc-catalog.json` 自动反映所有注册的 RPC 方法

```
工具数 = 5 (VFS) + 1 (RPC gateway) = 6，永不膨胀
新增能力 → 挂载 VFS 源 或 注册 RPC handler → 零新工具
```

### When to Think About Agent Lifecycle

- [ ] Feature involves starting or stopping agents
- [ ] Feature changes agent state (running, stopped, crashed)
- [ ] Feature adds a new launch mode or communication path
- [ ] Long-running agent needs to survive manager restart

→ Consider: What happens on failure? How do we clean up? What state needs persisting?

### When to Think About Composability

- [ ] Adding a new Domain Context component (skill, workflow, MCP)
- [ ] Adding or modifying a backend definition
- [ ] Creating a new Agent Template
- [ ] Modifying how components are referenced or resolved
- [ ] Adding plugin capabilities (memory, scheduler)

→ Consider: Is this reusable across templates? Is it referenced by name? Can it be swapped? If it's a backend, is the data serializable (no functions) and distributable via actant-hub?

### When to Think About Agent Evolution

- [ ] Feature involves Agent session lifecycle (start/stop)
- [ ] Feature changes what gets materialized into workspace
- [ ] Feature adds new instance-level persistent state
- [ ] Feature involves cross-instance or cross-session data

→ Read [Memory Layer Design](../../../docs/design/memory-layer-agent-evolution.md)

### When to Think About Cross-Layer Issues

- [ ] Feature touches CLI ↔ Core ↔ API boundaries
- [ ] Data format changes between layers
- [ ] Agent communicates via ACP or MCP
- [ ] External client (Unreal/Unity) consumes agent output

→ Read [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md)

### When to Think About External Protocol Alignment

- [ ] Upgrading `@agentclientprotocol/sdk` to a new version
- [ ] Modifying ACP type definitions or session handling
- [ ] Updating `docs/reference/acp-interface-reference.md`
- [ ] Adding new ACP message types or tool call structures

→ Cross-check against the official ACP schema: https://agentclientprotocol.com/protocol/schema
→ See [Quality Guidelines — ACP 类型漂移](../backend/quality-guidelines.md#common-mistake-acp-类型定义与官方-schema-漂移)

### When to Think About Code Reuse

- [ ] You're writing similar code to something that exists
- [ ] You see the same pattern repeated 3+ times
- [ ] You're adding a new field to multiple places
- [ ] **You're modifying any constant or config**
- [ ] **You're creating a new utility/helper function** ← Search first!

→ Read [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md)

### When to Think About Asset Management

- [ ] Feature involves persisting data beyond a single session
- [ ] Feature creates files, directories, or processes that outlive the Agent
- [ ] Feature involves human-delegated resources (Docker containers, working dirs, configs)
- [ ] Feature touches the `ac://` URI namespace or memory layers
- [ ] Feature involves cleanup/disposal of long-lived resources

→ Consider: Is this a managed asset? Does it need a `ac://` URI? What's the retention policy? Who owns it (human, Agent, system)? What happens when the owning Agent is destroyed?

→ Read [Hub Agent Kernel Design (#204)](https://github.com/blackplume233/Actant/issues/204) — Asset System section

**Key insight**: Actant follows an "everything is a file" philosophy. All managed entities — memories, Docker containers, working directories, processes, configs — are unified under the `ac://` URI scheme and managed by the Curator agent. When adding any persistent resource, think about how it fits into this asset model.

### When to Think About ACP Layer Boundaries

- [ ] Feature intercepts or transforms Agent 的 fs read/write 请求
- [ ] Feature needs Agent to access non-physical paths (virtual URIs like `ac://`)
- [ ] Feature adds new callback types to `ClientCallbackHandler`
- [ ] Feature modifies `ClientCallbackRouter` routing logic
- [ ] Feature changes what the ACP "workspace" (cwd) means

→ Consider: ACP 是瘦传输层，不应包含业务语义。扩展 Agent 可访问的资源时，在 `ClientCallbackRouter` 做前缀分发（唯一瓶颈点），实际解析注入自 Core 层。不要在 `localReadTextFile` 中处理——那只覆盖无 lease 模式。

→ Read [Cross-Layer Thinking Guide — ACP Client Callback 层的职责边界](./cross-layer-thinking-guide.md#acp-client-callback-层的职责边界)
→ See Issue [#209](https://github.com/blackplume233/Actant/issues/209)

### When to Think About Platform-Level Agent Design

- [ ] Feature provides a cross-cutting capability used by multiple Agents
- [ ] Feature could be delegated to a specialized platform Agent instead of inline code
- [ ] Feature involves self-healing, self-monitoring, or autonomous maintenance
- [ ] Feature relates to human interaction patterns (CLI replacement, onboarding)

→ Consider: Does this belong in the kernel (Steward/Maintainer/Curator), auxiliary (Updater/Scavenger/Researcher/Onboarder), or userspace? Should humans interact with this directly or through the Steward?

**Key architecture**: Platform agents form three layers — Kernel (always-on, default), Auxiliary (on-demand), and Spark (contributor-only self-evolution). Avoid adding application-level concerns (code review, testing) to kernel agents; those belong in userspace templates.

### When to Think About Dynamic Context Injection

- [ ] Feature provides a new capability (tool, resource, context) to Agent processes
- [ ] Feature needs to inject MCP servers or system prompts at session startup
- [ ] Feature adds a new subsystem that agents should be aware of
- [ ] Feature extends what data/tools are available during an ACP session

→ Consider: Should this register a `ContextProvider` with `SessionContextInjector`? Does it need a new MCP tool on the built-in MCP server? Should it inject system prompt additions?

**Key pattern**: New agent capabilities follow the `ContextProvider` → `SessionContextInjector` → ACP `session/new` pipeline:
1. Register a `ContextProvider` in `AppContext` initialization
2. The provider's `collect()` returns `{ mcpServers?, systemContextAdditions? }`
3. `SessionContextInjector.prepare()` aggregates all providers
4. `AgentManager.startAgent()` passes the result to ACP connection

**Gotcha**: The built-in MCP server (`packages/mcp-server`) communicates back to the Daemon via `ACTANT_SOCKET` environment variable. If you add a new MCP tool, it must use the `RpcClient` to call daemon RPC methods — the tool itself runs in a separate process.

→ See [SessionContextInjector](../../packages/core/src/context-injector/session-context-injector.ts), [AppContext CanvasProvider registration](../../packages/api/src/services/app-context.ts)

### When to Think About Encoding / i18n on Windows

- [ ] Feature passes CJK (Chinese/Japanese/Korean) text as CLI arguments
- [ ] Feature creates or edits GitHub issues/PRs with non-ASCII titles
- [ ] Feature redirects CLI output to files on Windows
- [ ] Feature runs `.sh` scripts via `bash` on Windows
- [ ] Feature uses `gh` CLI with Chinese content in PowerShell

→ Consider: PowerShell's default encoding (CP936/GBK) silently corrupts UTF-8 non-ASCII arguments. Use Python subprocess or write to file + `--body-file` instead of inline arguments. Verify results after `gh` operations.

→ Read [Cross-Platform Guide — gh CLI 中文参数 Mojibake](./cross-platform-guide.md#common-mistake-gh-cli-中文参数在-powershell-中被静默损坏mojibake)

### When to Think About CLI ↔ API Parity

- [ ] Adding a new CLI command
- [ ] Changing command arguments or output format
- [ ] Adding a new feature to the API

→ Consider: Does the CLI command have an API equivalent? Do they share the same underlying logic?

### When to Think About REST API Surface

- [ ] Adding a new RPC handler to the Daemon
- [ ] Changing RPC method signatures or behavior
- [ ] Adding a new feature that external systems (n8n, IM bots) might need
- [ ] Modifying existing REST API routes or response shapes

→ Consider: Has the route been added to `@actant/rest-api`'s route files? Is the OpenAPI summary in `server.ts` updated? Does the Dashboard's `lib/api.ts` need updating?

**Key architecture**: All external HTTP access goes through `@actant/rest-api`. The package translates RESTful routes to Daemon RPC calls via `RpcBridge`. New RPC methods should get corresponding REST endpoints. The Dashboard mounts this handler internally and adds static file serving on top.

→ See [API Contracts §4A](../api-contracts.md#4a-rest-apiactantrest-api), `packages/rest-api/src/routes/`

### When to Think About Concept Layer Separation

- [ ] Feature involves `plugin` — is it agent-side (workspace) or actant-side (PluginHost)?
- [ ] Feature involves `schedule` / `memory` / `contextInjection` — is it template declaration or platform runtime?
- [ ] Feature involves `domainContext` — does it cross into platform runtime behavior?
- [ ] Documentation mentions a capability — is it described at the right layer?

→ Consider: Actant 的配置体系区分 **template/domain-context layer** 和 **platform/runtime-services layer**。混淆这两层是概念漂移的主要来源。

```text
Template / Domain-Context Layer
  Skill · Prompt · MCP · Workflow · agent-side Plugin
  → 声明 Agent 引用什么组件

Platform / Runtime-Services Layer
  AgentManager · PluginHost · Scheduler · ContextInjector · ActantChannel
  → 决定声明如何被物化、启动、调度、恢复和注入
```

**Gotcha**: `domainContext.plugins` 中的 plugin 是 agent-side 扩展（workspace 内），`PluginHost` 管理的是 actant-side system plugin（平台 runtime 级），名字相同但层级完全不同。

→ See `docs/wiki/reference/architecture.md` Platform Conceptual Model

### When to Think About Document Governance

- [ ] Referencing a design doc or planning doc — is it still current baseline?
- [ ] Auto-generated wiki doc contains outdated narrative
- [ ] New feature narrative conflicts with established governance baseline
- [ ] Historical document is being cited as current design authority

→ Consider: Historical docs without explicit status markers will **silently define current concepts**. Every design doc should have one of these statuses:

| Status | Meaning |
|--------|---------|
| **Current** | Active baseline, code must conform |
| **Partially Valid** | Some sections still useful, but superseded in parts |
| **Historical** | Preserved for evolution context, not for current decisions |
| **Superseded** | Replaced by a newer document (link to replacement) |

**Convention**: When auto-generated docs (e.g. `generated: true` wiki pages) conflict with governance baselines from spec, **governance takes precedence**. Switch `generated` to `false` and update manually.

---

## Pre-Modification Rule (CRITICAL)

> **Before changing ANY value, ALWAYS search first!**

```bash
rg "value_to_change" .
```

This single habit prevents most "forgot to update X" bugs.

---

## How to Use This Directory

1. **Before coding**: Skim the relevant thinking guide
2. **During coding**: If something feels repetitive or complex, check the guides
3. **After bugs**: Add new insights to the relevant guide (learn from mistakes)

---

## Contributing

Found a new "didn't think of that" moment? Add it to the relevant guide.

---

**Core Principle**: 30 minutes of thinking saves 3 hours of debugging.
