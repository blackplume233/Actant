# Product Roadmap

> 项目优先级与规划总览。与 Trellis Issues / Tasks / Milestones 对齐，作为「后续要做的事」的单一入口。
> 更新节奏：当前任务推进、Issue 状态变更或里程碑调整时同步更新本文。
> **Task 级 Todo**：在本文持续迭代当前任务的勾选清单，随开发进展更新 `[ ]` → `[x]`，完成一项勾一项。

---

## 项目愿景

构建一个**企业级 Agent 运行时平台**，支持多模式 Agent 启动、生命周期管理、标准协议通信和可插拔扩展体系。

**核心能力矩阵：**
- **Assembler**: 通过 Skills + Prompts + MCP 快速拼装 Agent
- **Launcher**: 多模式 Agent 启动（direct / one-shot / service）
- **Lifecycle**: 进程监控、心跳检测、崩溃恢复
- **Communication**: ACP Proxy（外部接入）、MCP Server（Agent 间通信）、External Spawn（自主管理）
- **Extension**: 插件体系（heartbeat / scheduler / memory）
- **Memory**: 实例记忆、跨实例共享、上下文分层

**协议分工：**
```
ACP:  人/应用 ←→ Agent     （交互协议：提问、回答、授权）
MCP:  Agent ←→ 工具/服务    （能力协议：调用工具、获取资源）

AgentCraft 同时扮演：
  • ACP Client（管理旗下 Agent）
  • MCP Server（向其他 Agent 暴露自身能力）
  • ACP Proxy（让外部客户端以标准 ACP 使用托管 Agent）
```

---

## MVP 目标

> **一句话**：用户通过 AgentCraft CLI 快速拼装一个包含 Skills、Prompts、MCP 的 Agent，激活为 Service Agent，并通过 CLI 与其交互。

**MVP 验收场景（端到端）：**
```
1. 用户编写/选择 agent template（引用 skills + prompts + MCP servers）
2. agentcraft agent create my-agent --template code-review-agent  → 创建 workspace，完整物化 domain context
3. agentcraft agent start my-agent                          → 以 service 模式启动 agent 后端
4. agentcraft agent chat my-agent                           → 进入 CLI 交互，发送 prompt 获取回复
5. agentcraft agent stop my-agent                           → 停止 agent
```

**MVP 排除项（Post-MVP）：**
- ACP Proxy（外部应用接入）→ Phase 3
- MCP Server（Agent 间通信）→ Phase 3
- Plugin 体系 → Phase 4
- Memory 系统 → Phase 5
- Web 管理界面、RESTful API 扩展

---

## 阶段划分

### Phase 1: 核心运行时 (Foundation) ✅ 已完成
**目标**: 稳定可靠的 Agent 启动、进程管理与外部 Spawn 支持
**成功标准**: 所有 LaunchMode 可正常启动、监控、终止；外部客户端可 resolve + spawn + attach

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #8 | ProcessWatcher：进程退出检测与心跳监控 | P0 | - | ✅ 完成 |
| #9 | LaunchMode 行为分化 | P0 | #8 | ✅ 完成 |
| #15 | agent.resolve / agent.attach / agent.detach API | P1 | #8, #9 | ✅ 完成 |
| #10 | one-shot 模式完整实现 | P1 | #8, #9 | ✅ 完成 |
| #11 | acp-service 崩溃重启策略 | P1 | #8 | ✅ 完成 |

---

### Phase 2: MVP — Agent 拼装与交互 (Assemble & Interact)
**目标**: 端到端的 Agent 拼装 → 激活 → 交互流程
**时间**: 当前 — 近期
**成功标准**: 用户可通过 CLI 拼装 agent（skills+prompts+MCP）、以 service 模式启动、通过 CLI 对话交互

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #23 | Domain Context 全链路打通 | **P0** | Phase 1 | ✅ 完成 |
| #24 | Domain 组件加载与 CLI 管理 | **P0** | #23 | ✅ 完成 |
| #12 | Daemon ↔ Agent 通信（ACP Client 简化版） | **P0** | Phase 1 | ✅ 完成 |
| #25 | CLI Agent 交互（chat / run） | **P0** | #12 | ✅ 完成 |
| #26 | MVP 端到端集成与示例模板 | **P0** | #23, #24, #25 | ✅ 完成 |

#### #23 Domain Context 全链路打通
> **现状**：DomainManagers（skill/prompt/mcp/workflow）已实现，但 AppContext 未注入到 ContextMaterializer，生产环境只写占位符。
>
> **目标**：模板中引用的 skills/prompts/MCP 在 agent create 时被完整物化到 workspace。

- [x] AppContext 注入 `domainManagers` → ContextMaterializer 使用真实 managers
- [x] Skills → 完整内容写入 `AGENTS.md`（或 `.cursor/rules/`）
- [x] Prompts → 完整内容写入 `prompts/system.md`（支持变量插值）
- [x] MCP Servers → 完整配置写入 `.cursor/mcp.json` 或 `.claude/mcp.json`
- [x] Workflow → 完整内容写入 `.trellis/workflow.md`
- [x] 集成测试：从模板创建 agent，验证 workspace 内文件内容正确

#### #24 Domain 组件加载与 CLI 管理
> **目标**：支持从文件系统加载 skills/prompts/MCP/workflow 定义，CLI 可浏览管理。

- [x] `configs/` 目录规范：`configs/skills/`, `configs/prompts/`, `configs/mcp/`, `configs/workflows/`
- [x] Daemon 启动时自动扫描加载 configs/ 下的组件定义
- [x] 支持用户自定义 configs 目录（`--configs-dir`）
- [x] CLI 命令：`skill list` / `skill show <name>`
- [x] CLI 命令：`prompt list` / `prompt show <name>`
- [x] CLI 命令：`mcp list` / `mcp show <name>`
- [x] 提供示例内容：至少 2 个 skill + 1 个 prompt + 1 个 MCP 配置

#### #12 Daemon ↔ Agent 通信（ACP Client 简化版）
> **现状**：Daemon 可以启动/停止 agent 进程，但无法向 agent 发送消息或接收回复。
>
> **MVP 范围**：聚焦 `claude-code` 后端的 stdin/stdout 通信，实现 prompt→response 的基本流程。暂不实现完整 ACP 协议。

- [x] 定义 AgentCommunicator 接口（send prompt, receive response, streaming）
- [x] 实现 ClaudeCodeCommunicator：通过 claude-code CLI 的 pipe 模式通信
- [x] 实现 CursorCommunicator：通过 Cursor CLI `--pipe` 模式通信（如支持）
- [x] AgentManager 集成：`agent.run(name, prompt)` 和 `agent.chat(name)` API
- [x] RPC handler 注册新方法：`agent.run`, `agent.chat`
- [x] 错误处理：agent 未运行、通信超时、输出解析失败

#### #25 CLI Agent 交互（chat / run）
> **目标**：用户通过 CLI 与运行中的 agent 交互。

- [x] `agent run <name> --prompt "..."` — 发送单次任务，等待结果，输出后退出
- [x] `agent chat <name>` — 进入交互式对话模式（类 REPL）
- [x] 流式输出：实时显示 agent 回复
- [x] 对话历史：chat 模式下维护上下文
- [x] Ctrl+C 优雅退出 chat 模式（不停止 agent）

#### #26 MVP 端到端集成与示例模板
> **目标**：验证完整流程可用，提供开箱即用的示例。

- [x] 示例模板：`configs/templates/code-review-agent.json`（引用真实 skills/prompts/MCP）
- [x] Quick-start 文档更新（README 中添加 MVP 使用流程）
- [x] 端到端测试：template load → agent create → verify workspace → agent start → agent run → agent stop
- ~~`agentcraft init` 快速引导命令~~ → 移至长期目标（Phase 6+）

**Phase 2 依赖关系:**
```
Phase 1 (已完成)
 ├──→ #23 Domain Context 全链路打通
 │     └──→ #24 Domain 组件加载与 CLI 管理
 │           └──→ #26 MVP 端到端集成与示例
 │
 └──→ #12 Daemon ↔ Agent 通信 (ACP Client 简化版)
       └──→ #25 CLI Agent 交互 (chat / run)
             └──→ #26 MVP 端到端集成与示例
```

---

### Phase 3: 通信 · 管理 · 构造 · 共享 · 调度 (Connectivity & Management)
**目标**: 标准协议接入、完整组件管理、差异化构造器、可共享生态体系、雇员型 Agent 持续调度
**时间**: 当前
**成功标准**: 组件完整 CRUD + Plugin 管理；不同后端差异化 workspace 构建；模板权限控制；Template/组件可通过 Source 分享 + 版本管理；雇员型 Agent 可被 Daemon 持续调度 + N8N 可选集成

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #16 | ACP Proxy — 标准 ACP 协议网关（基础版） | P1 | #9, #15 | ✅ 完成 |
| #35 | ACP Proxy + Chat — Direct Bridge 与 Session Lease 双模式 | P1 | #16 | ✅ 完成 |
| **#38** | **统一组件管理体系 — Skill / Prompt / Plugin 完整 CRUD** | **P1** | #23, #24 | ✅ 完成 |
|   #43 | └─ BaseComponentManager CRUD 增强 | P0 | - | ✅ 完成 |
|   #44 | └─ PluginManager + Schema + 示例 | P0 | #43 | ✅ 完成 |
|   #45 | └─ RPC Handlers + CLI 命令扩展 | P0 | #43, #44 | ✅ 完成 |
| **#39** | **Workspace 构造器 — 差异化后端构建** | **P1** | #38 | ✅ 完成 |
|   #46 | └─ BackendBuilder + CursorBuilder + ClaudeCodeBuilder | P0 | #44 | ✅ 完成 |
|   #47 | └─ WorkspaceBuilder Pipeline + 迁移 | P0 | #46 | ✅ 完成 |
| **#40** | **雇员型 Agent — 内置调度器 + N8N 集成** | **P1** | #37, #12, #11 | ✅ 完成 |
|   #48 | └─ TaskQueue + Dispatcher + ExecutionLog | P0 | - | ✅ 完成 |
|   #49 | └─ InputRouter + InputSources | P0 | #48 | ✅ 完成 |
|   #50 | └─ EmployeeScheduler + 集成 + CLI | P0 | #48, #49 | ✅ 完成 |
| #37 | 雇员型 Agent — 设计文档（原始设计） | ref | #12, #11 | 设计完成 |
| **#51** | **AgentTemplate 权限控制 — 对齐 Claude Code permissions** | **P1** | #39, #46 | ⬜ 待开始 |
| **#52** | **AgentTemplate 可通过 Source 分享 + Preset 支持** | **P1** | #38 | ⬜ 待开始 |
| **#53** | **可共享内容版本控制 — 组件/模板/预设版本管理** | **P1** | #38, #52 | ⬜ 待开始 |
| #17 | MCP Server — Agent 间通信能力 | P2 | #12 | 待开始 |
| #5 | Template hot-reload on file change | P2 | - | 待开始 |

#### #16 ACP Proxy — 标准 ACP 协议网关（基础版） ✅ 完成
> **实现内容**：
> - `@agentcraft/acp` 包：`AcpConnection`（封装 `@agentclientprotocol/sdk` ClientSideConnection + 子进程管理），`AcpConnectionManager`（连接池管理），`AcpCommunicator`（AgentCommunicator 适配）
> - `claude-code` 后端从 `claude --project-dir` 改为 `claude-agent-acp`（ACP stdio 通信）
> - `ProcessLauncher` 支持 ACP backends 保持 stdio pipes
> - `AgentManager` 集成 ACP：`startAgent` 建立连接，`stopAgent` 断开，`runPrompt` 优先 ACP，新增 `promptAgent`
> - `agent.prompt` RPC handler + CLI 命令
> - `proxy.connect/disconnect/forward` RPC handlers
> - `agentcraft proxy <name>` CLI 命令：对外 ACP Agent 接口，对内 RPC 转发

#### #35 ACP Proxy + Chat — Direct Bridge 与 Session Lease 双模式
> **架构决策**：废弃 ACP Gateway，支持两种连接模式。
>
> **模式 A — Direct Bridge**：Client 自己 spawn Agent 进程 + 持有 AcpConnection，进程随连接走。最简单，适合一次性使用。
>
> **模式 B — Session Lease（默认）**：Daemon 持有 Agent 进程和 AcpConnection，客户端租借 Session。零冷启动，多客户端可并发（独立 Session），session 可恢复。
>
> **核心原则**：
> - CWD 永远是 agent workspace
> - 1 Instance : 1 Process : N Sessions
> - agent chat / proxy 默认走 Session Lease，`--direct` 切换为 Direct Bridge

#### #38 统一组件管理体系 — Skill / Prompt / Plugin 完整 CRUD
> **目标**：增强 BaseComponentManager 支持完整 CRUD + import/export + 搜索过滤。新增 PluginManager 管理 Cloud Code 插件。
>
> - Skill/Prompt：add/update/remove + 持久化 + 导入导出
> - Plugin（Cloud Code）：完整 CRUD，支持 npm/file/config 三种安装方式
> - CLI：扩展 skill/prompt 管理命令 + 新增 plugin 全套命令
> - 模板 domainContext 支持 `plugins` 字段

#### #39 Workspace 构造器 — 面向不同后端的差异化构建
> **目标**：用 Strategy Pattern 重构 workspace 构建流程，取代当前硬编码的 ContextMaterializer。
>
> - `BackendBuilder` 接口：scaffold / materialize / inject-permissions / verify
> - `CursorBuilder`：`.cursor/rules/*.mdc` + `.cursor/mcp.json` + AGENTS.md
> - `ClaudeCodeBuilder`：`.claude/*` + CLAUDE.md + plugins.json
> - `CustomBuilder`：通过 template config 自定义路径
> - Pipeline：resolve → validate → scaffold → materialize → inject → verify

#### #40 雇员型 Agent — 内置调度器 + N8N 集成
> **基于 #37 设计**，实现内置简单调度器 + 可选 N8N 集成。
>
> - 内置调度器：InputRouter → TaskQueue → TaskDispatcher
> - InputSources：Heartbeat / Cron（croner 库）/ Hook / Webhook
> - N8N 集成三模式：N8N→AgentCraft（Webhook）、AgentCraft→N8N（MCP）、双向
> - CLI：agent dispatch / agent tasks / agent logs / agent watch
> - 模板支持 `schedule` + `schedule.n8n` 配置字段

#### #51 AgentTemplate 权限控制 — 对齐 Claude Code permissions
> **目标**：模板作者可在 AgentTemplate 中声明工具权限、文件系统沙箱、网络策略，直接对齐 Claude Code 原生 `permissions` + `sandbox` 结构。
>
> - `permissions` 字段：allow / deny / ask 三级策略 + defaultMode + sandbox
> - 预设语法糖：`"permissive"` / `"standard"` / `"restricted"` / `"readonly"`
> - ContextMaterializer 根据 backendType 差异化物化（Claude Code 透传，Cursor 适配映射）
> - 向后兼容：未设 permissions 等同当前默认行为

#### #52 AgentTemplate 可通过 Source 分享 + Preset 支持
> **目标**：将 AgentTemplate 纳入 Source 可共享组件体系，用户可从远程 Source 安装模板。
>
> - FetchResult / PackageManifest / PresetDefinition 新增 templates 字段
> - SourceManagerDeps 新增 templateRegistry，注入/清除逻辑扩展
> - LocalSource / GitHubSource 扫描 `templates/` 目录
> - Preset 支持引用模板（installPreset 安装完整模板包）
> - CLI：`template install <package>@<name>` / `template export`

#### #53 可共享内容版本控制 — 组件/模板/预设版本管理
> **目标**：为所有可共享组件（Skill、Prompt、Workflow、McpServer、Plugin、Template、Preset）建立版本管理体系。
>
> - 基础层：所有组件类型新增 `version?: string` 字段
> - 引用层：组件引用支持版本约束语法（`name:^1.0.0`）
> - 同步层：syncSource 返回 SyncReport（added/updated/removed/breaking），大版本变更给出警告
> - 高级层（后续）：Lock 文件锁定 + 版本快照回滚

**Phase 3 依赖关系:**
```
Phase 2 (已完成)
 ├──→ #16 ACP Proxy 基础版 ✅
 │     └──→ #35 Proxy + Chat 双模式 ✅
 │
 ├──→ 管理线 (3a): #38 统一组件管理
 │     #43 BaseComponentManager CRUD
 │       └──→ #44 PluginManager + Schema
 │             └──→ #45 RPC + CLI
 │                   └──→ #38 完成 ✓
 │
 ├──→ 构造线 (3b): #39 Workspace 构造器 (依赖 3a #44)
 │     #46 BackendBuilder + CursorBuilder + ClaudeCodeBuilder
 │       └──→ #47 WorkspaceBuilder Pipeline + 迁移
 │       │     └──→ #39 完成 ✓
 │       └──→ #51 AgentTemplate 权限控制 (依赖 #46 BackendBuilder)
 │
 ├──→ 共享增强线 (3d): Source 体系完善 (依赖 3a #38)
 │     #52 AgentTemplate 可通过 Source 分享 + Preset 支持
 │       └──→ #53 可共享内容版本控制 — 组件/模板/预设版本管理
 │
 ├──→ 调度线 (3c): #40 雇员型 Agent (独立于 3a/3b)
 │     #48 TaskQueue + Dispatcher
 │       └──→ #49 InputRouter + Sources
 │             └──→ #50 Scheduler + 集成 + CLI
 │                   └──→ #40 完成 ✓
 │
 └──→ #17 MCP Server (Agent-to-Agent)

#5 Template hot-reload (独立)
```

---

### Phase 4: 扩展体系 (Extensibility)
**目标**: 可插拔的系统级插件架构，将调度组件 Plugin 化；权限管理
**时间**: Phase 3 完成后
**成功标准**: AgentCraft 系统级 Plugin 接口清晰，#40 的 Input 系统可重构为 Plugin 形态

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #13 | AgentCraft 系统级 Plugin 体系（heartbeat/scheduler/memory 可插拔） | P2 | #8, #40 | 待开始 |
| #14 | Agent 进程 stdout/stderr 日志收集 | P3 | - | 待开始 |
| #36 | Agent 工具权限管理机制设计 | P2 | - | 待开始 |

**Phase 4 关键设计:**
- AgentCraft 系统级 Plugin 接口（生命周期钩子、配置解析）— 区别于 #38 的 Agent 侧 Plugin
- #40 的 HeartbeatInput / CronInput / HookInput 重构为 Plugin 形态
- 插件加载器（本地文件 / 远程 registry）

**Plugin 类型说明：**
```
Agent-side Plugin (#38, Phase 3):
  Agent workspace 中的能力扩展（Claude Code plugin、Cursor Extension 等）
  由 PluginManager 管理，通过 BackendBuilder 物化到 workspace

AgentCraft-side Plugin (#13, Phase 4):
  AgentCraft Daemon 的系统级扩展（HeartbeatMonitor、Scheduler、MemoryLayer 等）
  由 Plugin 接口定义生命周期钩子
```

---

### Phase 5: 记忆系统 (Memory)
**目标**: 分层记忆体系，支持长期记忆与跨实例共享
**时间**: Phase 4 完成后
**成功标准**: Agent 具备上下文感知、记忆检索、跨会话连贯性

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #1 | Instance Memory Layer (Phase 1) | P3 | - | 待开始 |
| #2 | Memory Consolidation + Shared Memory (Phase 2) | P3 | #1 | 待开始 |
| #3 | Context Layers + ContextBroker (Phase 3) | P3 | #2 | 待开始 |
| #6 | OpenViking as optional MCP Server integration | P3 | #2 | 待开始 |

**Phase 5 演进路径:**
```
#1 Instance Memory Layer (单实例记忆)
 └──→ #2 Memory Consolidation (跨实例共享)
       ├──→ #3 Context Layers (上下文分层)
       └──→ #6 OpenViking MCP (外部记忆源)
```

---

## 当前进行中 (Current)

Phase 1、Phase 2 MVP、Phase 3 核心三线（3a/3b/3c）全部完成。当前聚焦 **Phase 3 剩余增强项**（#51 权限控制、#52 Source 分享、#53 版本控制）和 **Phase 4 扩展体系**。

**已完成线**：
- ✅ 管理线 (3a): #43 → #44 → #45 → #38 完成
- ✅ 构造线 (3b): #46 → #47 → #39 完成
- ✅ 调度线 (3c): #48 → #49 → #50 → #40 完成

**待推进**：
- #51 AgentTemplate 权限控制（依赖 #39 已完成）
- #52 AgentTemplate 可通过 Source 分享（依赖 #38 已完成）
- #53 可共享内容版本控制（依赖 #52）

详细 TODO 跟踪见：`.trellis/phase3-todo.md`
详细设计见：`docs/design/mvp-next-design.md`

### Phase 1 完成总结

| 功能 | 实现内容 |
|------|---------|
| ProcessWatcher | 定时轮询 PID 存活检测、退出事件回调、与 AgentManager 集成 |
| LaunchMode 分化 | Handler 模式：direct/acp-background/acp-service/one-shot 各有独立的退出行为和恢复策略 |
| 外部 Spawn | resolve/attach/detach 完整 API + RPC handler + CLI 命令，支持 metadata 传递 |
| One-shot 模式 | autoDestroy 自动销毁、ephemeral workspace 策略、WorkspacePolicy 类型系统 |
| 崩溃重启 | 指数退避 RestartTracker、最大重试限制、daemon 重启恢复、稳定期自动重置计数器 |
| CLI 输出层 | CliPrinter 抽象层替代 console.log，支持可注入输出、便于测试和格式切换 |
| CLI 测试覆盖 | 56 个单元测试覆盖 printer/formatter/error-presenter/rpc-client/repl/commands |

### Phase 2 MVP 完成总结

| 功能 | 实现内容 |
|------|---------|
| Domain Context 全链路 | AppContext 注入 DomainManagers，configs/ 自动加载，完整物化到 workspace |
| 组件加载与 CLI 管理 | skill/prompt/mcp 的 RPC handlers + CLI list/show 命令 |
| Agent 通信 | AgentCommunicator 接口、ClaudeCodeCommunicator (pipe模式)、CursorCommunicator (stub) |
| CLI 交互 | `agent run` 单次任务 + `agent chat` 交互模式 + agent.run RPC handler |
| 端到端集成 | 示例模板 (code-review-agent)、Quick-start 文档、MVE E2E 集成测试 (6 场景) |
| 示例内容 | 2 skills + 1 prompt + 1 MCP + 1 workflow + 1 template |
| 测试覆盖 | 313 tests across 29 files (从 290 增长到 313) |

### Phase 3 进展总结（核心三线全部完成）

| 子阶段 | 功能 | 实现内容 |
|--------|------|---------|
| 协议线 | ACP 包 (`@agentcraft/acp`) | `AcpConnection`、`AcpConnectionManager`、`AcpCommunicator`、Proxy + Chat 双模式 |
| 3a 管理 | 统一组件管理体系 | `BaseComponentManager` CRUD 增强 + `PluginManager` + Plugin RPC/CLI 全套命令 |
| 3b 构造 | Workspace 构造器 | `BackendBuilder` 接口 + `CursorBuilder` + `ClaudeCodeBuilder` + `WorkspaceBuilder` Pipeline + `AgentInitializer` 迁移 |
| 3c 调度 | 雇员型 Agent 调度器 | `TaskQueue` + `TaskDispatcher` + `ExecutionLog` + `InputRouter` (Heartbeat/Cron/Hook) + `EmployeeScheduler` + Schedule RPC/CLI |
| 测试 | 538 tests / 49 files | 全量通过，从 313 tests (Phase 2) 增长到 538 tests |

### 耐久测试覆盖 — 持续验证能力

> 耐久测试随 Phase 同步演进，详见 `spec/endurance-testing.md`。

| Phase | 覆盖场景 | 状态 |
|-------|---------|------|
| **Phase 1** | E-LIFE 生命周期循环 · E-SVC 崩溃重启 · E-SHOT one-shot 清理 · E-EXT 外部 Spawn · E-DAEMON 恢复 · E-MIX 混合并发 · 各模式关停行为矩阵 | ✅ 已实现 (10 场景) |
| **Phase 2 MVP** | E-CTX domain context 物化 · E-CHAT CLI 交互流 · E-E2E 端到端流程 | ⏳ 待实现 |
| **Phase 3** | E-RPC 高频通信 · E-ACP Proxy 持续转发 · E-MCP Agent 间通信 | ⏳ 待实现 |
| **Phase 4+** | E-PLUG 插件加载卸载 · E-MEM 记忆系统持久性 | ⏳ 待实现 |

每个 Phase 的功能完成时，**必须**同步扩展对应的耐久测试场景。

---

## 后续优先 (Next Up)

按推进优先级排列。依赖关系用 `→` 标注。

### P0 — MVP 必做 (Phase 2 核心)

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 1 | **#23** | Domain Context 全链路打通 | Phase 1 | AppContext 注入 domainManagers，skills/prompts/MCP 完整物化到 workspace |
| 2 | **#12** | Daemon ↔ Agent 通信 (ACP Client 简化版) | Phase 1 | claude-code/cursor 后端的 stdin/stdout 通信，prompt→response 基本流程 |
| 3 | **#24** | Domain 组件加载与 CLI 管理 | #23 | configs/ 目录加载，skill/prompt/mcp 的 CLI 浏览命令，示例内容 |
| 4 | **#25** | CLI Agent 交互 (chat / run) | #12 | `agent run` 单次任务 + `agent chat` 交互模式 + 流式输出 |
| 5 | **#26** | MVP 端到端集成与示例模板 | #23-25 | 示例模板 + Quick-start 文档 + E2E 测试 |

### P1 — Phase 3 通信 · 管理 · 构造 · 调度

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 6 | **#16** | ACP Proxy — 基础版 | #9, #15 | ✅ **已完成** |
| 7 | **#38** | **统一组件管理体系 — Skill/Prompt/Plugin CRUD** | #23, #24 | BaseComponentManager 增强 + PluginManager + CLI 扩展 |
| 8 | **#39** | **Workspace 构造器 — 差异化后端构建** | #38 | BackendBuilder strategy + CursorBuilder/ClaudeCodeBuilder |
| 9 | **#40** | **雇员型 Agent — 内置调度器 + N8N 集成** | #11, #12, #37 | TaskQueue + InputRouter + Scheduler + N8N Bridge |
| 10 | **#35** | **Proxy + Chat — Direct Bridge 与 Session Lease 双模式** | #16 | Session Lease（默认）+ Direct Bridge，废弃 Gateway |
| 11 | **#51** | **AgentTemplate 权限控制** | #39, #46 | 对齐 Claude Code permissions + sandbox，动态生成后端配置 |
| 12 | **#52** | **AgentTemplate 可通过 Source 分享** | #38 | Source/Preset 支持 Template，TemplateRegistry 注入 |
| 13 | **#53** | **可共享内容版本控制** | #38, #52 | 组件 version 字段 + SyncReport + 版本约束语法 |
| 14 | **#17** | MCP Server — Agent 间通信能力 | #12 | 暴露 agentcraft_run_agent 等 MCP tools |
| 15 | #5 | Template hot-reload on file change | 无 | Daemon 监听 template 变更自动 reload |

### P2 — Phase 4 扩展

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 11 | **#13** | Plugin 体系设计 | #8, #37 | 可插拔插件架构，#37 Input 系统重构为 Plugin |
| 12 | #36 | Agent 工具权限管理机制 | 无 | 模板级/实例级权限控制 |
| 13 | #14 | Agent 进程 stdout/stderr 日志收集 | 无 | 进程输出写入日志文件 + 可选实时查询 |

### P3 — Phase 5 记忆 & 长期

| 顺序 | Issue | 标题 | 说明 |
|------|-------|------|------|
| 14 | #1 | Instance Memory Layer | 实例级长期记忆 |
| 15 | #2 | Memory Consolidation + Shared Memory | 跨实例记忆整合 |
| 16 | #3 | Context Layers + ContextBroker | 上下文分层与代理 |
| 17 | #6 | OpenViking as optional MCP Server | 可选 MCP 集成 |
| 18 | #18 | ACP-Fleet 扩展协议 | 长期愿景：Daemon 升级为 ACP Server |

---

## 已完成

| Issue | 标题 | 完成日期 | 所属阶段 |
|-------|------|---------|---------|
| #8 | ProcessWatcher：进程退出检测与心跳监控 | 2026-02-20 | Phase 1 |
| #9 | LaunchMode 行为分化 | 2026-02-20 | Phase 1 |
| #10 | one-shot 模式完整实现 | 2026-02-20 | Phase 1 |
| #11 | acp-service 崩溃重启策略 | 2026-02-20 | Phase 1 |
| #15 | agent.resolve / attach / detach API — 外部 Spawn 支持 | 2026-02-20 | Phase 1 |
| #20 | CLI 包测试覆盖率为零 — 补充单元测试 | 2026-02-20 | Phase 1 (质量) |
| #22 | CLI 包 console.log 违反质量规范 — 引入 CliPrinter 结构化输出层 | 2026-02-20 | Phase 1 (质量) |
| #7 | 审查与文档化：配置结构与对外接口 + Workflow 约定 | 2026-02-20 | Phase 1 (准备) |
| #4 | Real Agent Launcher implementation | 2026-02-20 | Phase 1 (准备) |
| #23 | Domain Context 全链路打通 | 2026-02-20 | Phase 2 MVP |
| #24 | Domain 组件加载与 CLI 管理 | 2026-02-20 | Phase 2 MVP |
| #12 | Daemon ↔ Agent 通信 (ACP Client 简化版) | 2026-02-20 | Phase 2 MVP |
| #25 | CLI Agent 交互 (chat / run) | 2026-02-20 | Phase 2 MVP |
| #26 | MVP 端到端集成与示例模板 | 2026-02-20 | Phase 2 MVP |
| #16 | ACP Proxy — 标准 ACP 协议网关 | 2026-02-20 | Phase 3 |
| #35 | ACP Proxy + Chat — Direct Bridge 与 Session Lease 双模式 | 2026-02-20 | Phase 3 |
| #43 | BaseComponentManager CRUD 增强 | 2026-02-21 | Phase 3a |
| #44 | PluginManager + Schema + 示例 | 2026-02-21 | Phase 3a |
| #45 | RPC Handlers + CLI 命令扩展 | 2026-02-21 | Phase 3a |
| #46 | BackendBuilder + CursorBuilder + ClaudeCodeBuilder | 2026-02-21 | Phase 3b |
| #47 | WorkspaceBuilder Pipeline + AgentInitializer 迁移 | 2026-02-21 | Phase 3b |
| #48 | TaskQueue + TaskDispatcher + ExecutionLog | 2026-02-21 | Phase 3c |
| #49 | InputRouter + HeartbeatInput + CronInput + HookInput | 2026-02-21 | Phase 3c |
| #50 | EmployeeScheduler + AgentManager 集成 + CLI | 2026-02-22 | Phase 3c |

---

## 完整依赖关系图

```
═══════════════════════════════════════════════════════════════
                        Phase 1: 核心运行时  ✅
═══════════════════════════════════════════════════════════════

#8 ProcessWatcher (P0) ✅
 ├──→ #9 LaunchMode 行为分化 (P0) ✅
 │     ├──→ #15 resolve/attach/detach (P1) ✅
 │     ├──→ #10 one-shot 完整实现 (P1) ✅
 │     │
 │     └──→ [Phase 2 MVP] #12 ACP Client 简化版
 │     └──→ [Phase 2 MVP] #23 Domain Context 全链路
 │
 ├──→ #11 acp-service 崩溃重启 (P1) ✅
 └──→ [Phase 4] #13 Plugin 体系 (P2)


═══════════════════════════════════════════════════════════════
              Phase 2: MVP — Agent 拼装与交互  ✅
═══════════════════════════════════════════════════════════════

拼装线:
Phase 1 ──→ #23 Domain Context 全链路打通 (P0) ✅
              └──→ #24 Domain 组件加载与 CLI 管理 (P0) ✅
                    └──→ #26 MVP 端到端集成 ✅

交互线:
Phase 1 ──→ #12 Daemon ↔ Agent 通信 (P0) ✅
              └──→ #25 CLI Agent 交互 chat/run (P0) ✅
                    └──→ #26 MVP 端到端集成 ✅


═══════════════════════════════════════════════════════════════
       Phase 3: 通信 · 管理 · 构造 · 调度  ← 当前
═══════════════════════════════════════════════════════════════

协议线:
#12 (来自 MVP)
 ├──→ #16 ACP Proxy 基础版 (P1) ✅
 │     └──→ #35 Proxy + Chat 双模式 (P1)
 │           Session Lease（默认）+ Direct Bridge（--direct）
 │
 └──→ #17 MCP Server (P2) ← Agent-to-Agent

管理线:
#23/#24 (来自 MVP)
 └──→ #38 统一组件管理体系 (P1)
       Skill/Prompt CRUD + PluginManager + import/export
       ├──→ #39 Workspace 构造器 (P1)
       │     BackendBuilder strategy: Cursor/ClaudeCode/Custom
       │     scaffold → materialize → inject → verify
       │     └──→ #51 AgentTemplate 权限控制 (P1)
       │           对齐 Claude Code permissions + sandbox
       │
       └──→ 共享增强线:
             #52 AgentTemplate 可通过 Source 分享 (P1)
               └──→ #53 可共享内容版本控制 (P1)
                     组件/模板/预设版本管理 + SyncReport

调度线:
#11/#12 (来自 Phase 1/2)
 └──→ #40 雇员型 Agent + 调度器 + N8N (P1)
       ← #37 设计文档
       InputRouter → TaskQueue → TaskDispatcher
       Heartbeat / Cron / Hook / Webhook / N8N Bridge

#5 Template hot-reload (P2) — 独立


═══════════════════════════════════════════════════════════════
                  Phase 4: 扩展体系
═══════════════════════════════════════════════════════════════

#8 ProcessWatcher (来自 Phase 1)
 └──→ #13 AgentCraft 系统级 Plugin 体系 (P2)
       ├──→ #40 Input 系统 Plugin 化 (重构)
       ├──→ memory 插件 (连接 Phase 5)
       └──→ 自定义插件加载器

#36 Agent 工具权限管理 (P2) — 独立
#14 日志收集 (P3) — 独立


═══════════════════════════════════════════════════════════════
                  Phase 5: 记忆系统
═══════════════════════════════════════════════════════════════

#1 Instance Memory Layer (P3)
 └──→ #2 Memory Consolidation + Shared Memory (P3)
       ├──→ #3 Context Layers + ContextBroker (P3)
       └──→ #6 OpenViking MCP Server (P3)


═══════════════════════════════════════════════════════════════
               Phase 6: ACP-Fleet 标准化 (长期愿景)
═══════════════════════════════════════════════════════════════

#12 + #16 (来自 Phase 2-3)
 └──→ #18 ACP-Fleet 扩展协议 (P4)
       ├──→ Daemon 升级为 ACP Server
       ├──→ fleet/* 命名空间标准化
       ├──→ ACP Proxy 简化为 transport shim
       └──→ ACP-Fleet Extension Spec 发布
```

---

## 四种外部接入模式（参见 spec/api-contracts.md §9）

```
控制权谱系：
AgentCraft 全权 ◄──────────────────────────────────► 调用方全权

 agent.run       ACP Proxy      Self-spawn+Attach    纯 resolve
 (#12)           (#16)          (#15)                (#15)
 Daemon 管一切    Daemon 管,      调用方管进程,         只要 workspace,
                 Proxy 转发 ACP  attach 注册状态       不注册
```

---

## 技术债务与风险

| 风险项 | 影响 | 缓解措施 |
|--------|------|---------|
| ProcessWatcher 跨平台兼容性 | Phase 1 全部功能 | 优先实现 Linux/macOS，Windows 使用兼容层 |
| claude-code pipe 模式稳定性 | MVP 交互功能 | 优先调研 claude-code SDK/CLI 通信方式，预留 fallback |
| ACP 协议标准演进 | Phase 3 全部功能 | 关注 ACP spec 更新，保持 Proxy 协议适配层可替换 |
| Plugin 接口稳定性 | Phase 4+ 生态 | 设计时预留版本号，支持向后兼容 |
| Memory 存储选型 | Phase 5 性能 | 先实现内存存储，再考虑持久化方案 |

---

## 维护说明

- **当前进行中**：与 `task.sh list` 一致，仅保留当前主动开发的任务。
- **Task 级 Todo**（持续迭代）：
  - 随开发推进在本文件中勾选完成项（`[ ]` → `[x]`），完成一项勾一项。
  - 当前任务完成后：将「后续优先」中下一项提为当前任务，从其 Issue body 抄写 Task 级 Todo。
- **后续优先**：从 Issue 列表提炼，保证前 3–5 项为共识的下一步。
- 新增/关闭 Issue 或完成 Task 后同步更新本表。
