# Product Roadmap

> 项目优先级与规划总览。与 Trellis Issues / Tasks / Milestones 对齐，作为「后续要做的事」的单一入口。
> 更新节奏：当前任务推进、Issue 状态变更或里程碑调整时同步更新本文。
> **Task 级 Todo**：在本文持续迭代当前任务的勾选清单，随开发进展更新 `[ ]` → `[x]`，完成一项勾一项。

### 当前最高优先：Context-First 架构重构准备与实施

> **设计文档**：[context-first-multi-source-architecture.md](../design/context-first-multi-source-architecture.md)
>
> **核心方向**：将上下文管理从子功能提升为平台的核心抽象。Agent 服务降级为上下文的消费者和提供者。
> Actant = 上下文平台，Agent 是消费上下文的一种方式。
>
> **两大阶段**：
> - **Phase A**（v0.3.0 → v0.4.0）：工程清理与重构准备，产出存档版本
> - **Phase B**（v0.4.0 → v0.5.0）：Context-First 架构实施

#### Phase A：工程清理与重构准备（v0.3.0 → v0.4.0 存档）— 预计 5-8 天

- [ ] **A-1 废弃代码清理**（2-3 天）：清零全部 17 处 `@deprecated`，删除 EventJournal / ActivityRecorder / MockLauncher / ContextMaterializer / Legacy proxy handlers 等已被替代的代码
- [ ] **A-2 无效依赖清理**（0.5 天）：移除 `@actant/mcp-server` 对 `@actant/domain` 和 `@actant/source` 的未使用依赖
- [ ] **A-3 @actant/core 内聚性梳理**（1-2 天）：消除 core 内部 domain/source/vfs 子目录与独立包的重复定义，为每个子模块标注 Phase B 迁移归属
- [ ] **A-4 测试补强与质量基线**（1-2 天）：补充各 archetype 端到端集成测试，修复 #238/#239/#240 已知 bugs，记录 coverage baseline
- [ ] **A-5 版本存档**（0.5 天）：全部 package 升至 `0.4.0`，打 tag `v0.4.0` 作为重构前最后存档

#### Phase B：Context-First 架构实施（v0.4.0 → v0.5.0）— 预计 12-20 天

- [ ] **B-0 ContextManager 骨架**（1-2 天）：创建 `@actant/context` 包，实现 ContextSource 接口 + ContextManager + MCP Server
- [ ] **B-1 DomainContextSource**（2-3 天）：包装现有 SkillManager/PromptManager 为 VFS 投影，External Agent 可浏览
- [ ] **B-2 AgentTemplate/Manager 增量**（1-2 天）：原地扩展 rules + toolSchema + ContextManager MCP 注入 + Agent → Tool 回注
- [ ] **B-3 UnrealProjectSource**（3-5 天）：大型游戏项目上下文投影为 VFS
- [ ] **B-4 现有系统桥接**（3-5 天）：MCP Server / Hub / CLI 切换到 ContextManager 架构
- [ ] **B-5 重命名与旧模块收缩**（2-3 天）：`@actant/core` → `@actant/agent-runtime`，删除被 ContextManager 替代的模块
- [ ] **B-6 版本发布**（1 天）：全部 package 升至 `0.5.0`，打 tag `v0.5.0`

---

### 已完成：#296 / #297 CLI-first 自举宿主与 Hub 收口（2026-03-17）

> 目标：让**正式安装的 `actant` CLI**成为 Actant 自举的第一控制面，以 `actant hub ...` 作为官方入口，在单宿主进程上提供 project-context-first 的 bootstrap surface。默认 profile 只加载 host kernel + hub core，不默认启用 `AgentService`。

- [x] **#296 已完成**：从 `@actant/core` 提取 project-context 相关 packages，作为轻宿主 / Hub 分层的先行 groundwork
- [x] **#297 收口**：明确 Project-level DomainContext、作用域边界与 reactive sync 接受线
- [x] 固化 `actant hub ...` 为官方自举命名空间
- [x] 提供 `acthub ...` 等价别名，但不形成第二套语义
- [x] `hub` 命令自动复用或拉起单个轻量 host，而不是创建第二个 daemon
- [x] 定义 `bootstrap` profile：host kernel + hub core + project context + source/config loader + 只读 VFS
- [x] 明确默认不实例化 `AgentService`、Scheduler、平台级 Kernel Agents
- [x] 明确 Agent Runtime 为可注册框架，但服务按需懒激活
- [x] 将 MCP 重定位为消费层入口，而不是 bootstrap owner
- [x] 通过 build / type-check / lint / test 与定向 CLI 黑盒回归验证自举主线
- [x] 完成本轮主线收口，使其可作为后续自举基线

### Pi Mono 简洁哲学吸收（2026-03-15，#291 总入口）

> **Umbrella Issue**: [#291 - Absorb Pi Mono simplicity philosophy into ACP-EX and architecture](https://github.com/blackplume233/Actant/issues/291)
>
> 通过与 [Pi Mono](https://github.com/badlogic/pi-mono) 的深度架构对比，识别出 ACP-EX 协议缺失的底层语义和 Actant 架构可优化的方向。按 P0-P3 分阶段推进。

**P0 — 与 #279 同步**

| Issue | 标题 | 优先级 | 状态 |
|-------|------|--------|------|
| #280 | ACP-EX Steering/Follow-up mid-turn messaging | P0 | open |

**P1 — #279 后优先实现**

| Issue | 标题 | 优先级 | 状态 |
|-------|------|--------|------|
| #281 | ACP-EX Session Branching and Fork | P1 | open |
| #282 | ACP-EX Context Compaction for long-running sessions | P1 | open |

**P2 — 中期架构改造**

| Issue | 标题 | 优先级 | 状态 |
|-------|------|--------|------|
| #283 | ACP-EX Tool Hooks - beforeToolCall/afterToolCall | P2 | open |
| #284 | ACP-EX Design Principles and Custom Message Types | P2 | open |
| #285 | Evaluate @actant/core package split | P2 | open |
| #286 | AgentManager slim-down and CommunicationRouter extraction | P2 | open |
| #288 | Subsystem hot-pluggable architecture | P2 | open |
| #289 | Platform Session vs Backend Session ownership model | P2 | open |

**P3 — 长期方向**

| Issue | 标题 | 优先级 | 状态 |
|-------|------|--------|------|
| #287 | Agent App registration-based developer API | P3 | open |
| #290 | CLI command layering and event system hierarchy | P3 | open |

---

构建一个**企业级 AI Agent 底层平台**，支持 Agent 的组装、工作区物化、运行时管理、标准协议通信和可插拔扩展体系，并在其上承载 Agent App、SOP 自动化、CI 任务代理与外部引擎集成。

**核心能力矩阵：**
- **Assembler**: 通过 Skills + Prompts + MCP + Workflow 组织模板与 Domain Context
- **Launcher**: 多模式 Agent 启动与 archetype-aware 交付（repo / service / employee）
- **Lifecycle**: 进程监控、会话管理、keepAlive、崩溃恢复
- **Communication**: ActantChannel（Actant 自有通信层）、ACP Proxy（外部 IDE 接入）、Claude Agent SDK / Pi SDK（backend adapter）、MCP Server（Agent 间通信）、External Spawn（自主管理）
- **Extension**: 平台插件、调度、Hook、记忆等自治能力挂载
- **Memory**: 实例记忆、跨实例共享、上下文分层

**交付形态基线：**
- **repo**：工作区承载层，适合人工协作或外部工具接管
- **service**：当前主交付形态，适合作为 CLI / API / App / SOP / CI 的默认承载面
- **employee**：在 service 之上叠加调度与自治能力的增强层

**协议分工：**
```
ACP:  人/应用 ←→ Agent     （交互协议：提问、回答、授权）
MCP:  Agent ←→ 工具/服务    （能力协议：调用工具、获取资源）

Actant 同时扮演：
  • ACP Client（管理旗下 Agent）
  • MCP Server（向其他 Agent 暴露自身能力）
  • ACP Proxy（让外部客户端以标准 ACP 使用托管 Agent）
```

---

## MVP 目标

> **一句话**：用户通过 Actant CLI 快速拼装一个包含 Skills、Prompts、MCP 的 Agent，激活为 Service Agent，并通过 CLI 与其交互。

**MVP 验收场景（端到端）：**
```
1. 用户编写/选择 agent template（引用 skills + prompts + MCP servers）
2. actant agent create my-agent --template code-review-agent  → 创建 workspace，完整物化 domain context
3. actant agent start my-agent                          → 以 service 模式启动 agent 后端
4. actant agent chat my-agent                           → 进入 CLI 交互，发送 prompt 获取回复
5. actant agent stop my-agent                           → 停止 agent
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
| #22 | ProcessWatcher：进程退出检测与心跳监控 | P0 | - | ✅ 完成 |
| #23 | LaunchMode 行为分化 | P0 | #22 | ✅ 完成 |
| #26 | agent.resolve / agent.attach / agent.detach API | P1 | #22, #23 | ✅ 完成 |
| #24 | one-shot 模式完整实现 | P1 | #22, #23 | ✅ 完成 |
| #25 | acp-service 崩溃重启策略 | P1 | #22 | ✅ 完成 |

---

### Phase 2: MVP — Agent 拼装与交互 (Assemble & Interact)
**目标**: 端到端的 Agent 拼装 → 激活 → 交互流程
**时间**: 当前 — 近期
**成功标准**: 用户可通过 CLI 拼装 agent（skills+prompts+MCP）、以 service 模式启动、通过 CLI 对话交互

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #112 | Domain Context 全链路打通 | **P0** | Phase 1 | ✅ 完成 |
| #113 | Domain 组件加载与 CLI 管理 | **P0** | #112 | ✅ 完成 |
| #13 | Daemon ↔ Agent 通信（ACP Client 简化版） | **P0** | Phase 1 | ✅ 完成 |
| #114 | CLI Agent 交互（chat / run） | **P0** | #13 | ✅ 完成 |
| #115 | MVP 端到端集成与示例模板 | **P0** | #112, #113, #114 | ✅ 完成 |

#### #112 Domain Context 全链路打通
> **现状**：DomainManagers（skill/prompt/mcp/workflow）已实现，但 AppContext 未注入到 ContextMaterializer，生产环境只写占位符。
>
> **目标**：模板中引用的 skills/prompts/MCP 在 agent create 时被完整物化到 workspace。

- [x] AppContext 注入 `domainManagers` → ContextMaterializer 使用真实 managers
- [x] Skills → 完整内容写入 `AGENTS.md`（或 `.cursor/rules/`）
- [x] Prompts → 完整内容写入 `prompts/system.md`（支持变量插值）
- [x] MCP Servers → 完整配置写入 `.cursor/mcp.json` 或 `.claude/mcp.json`
- [x] Workflow → 完整内容写入 `.trellis/workflow.md`
- [x] 集成测试：从模板创建 agent，验证 workspace 内文件内容正确

#### #113 Domain 组件加载与 CLI 管理
> **目标**：支持从文件系统加载 skills/prompts/MCP/workflow 定义，CLI 可浏览管理。

- [x] `configs/` 目录规范：`configs/skills/`, `configs/prompts/`, `configs/mcp/`, `configs/workflows/`
- [x] Daemon 启动时自动扫描加载 configs/ 下的组件定义
- [x] 支持用户自定义 configs 目录（`--configs-dir`）
- [x] CLI 命令：`skill list` / `skill show <name>`
- [x] CLI 命令：`prompt list` / `prompt show <name>`
- [x] CLI 命令：`mcp list` / `mcp show <name>`
- [x] 提供示例内容：至少 2 个 skill + 1 个 prompt + 1 个 MCP 配置

#### #13 Daemon ↔ Agent 通信（ACP Client 简化版）
> **现状**：Daemon 可以启动/停止 agent 进程，但无法向 agent 发送消息或接收回复。
>
> **MVP 范围**：聚焦 `claude-code` 后端的 stdin/stdout 通信，实现 prompt→response 的基本流程。暂不实现完整 ACP 协议。

- [x] 定义 AgentCommunicator 接口（send prompt, receive response, streaming）
- [x] 实现 ClaudeCodeCommunicator：通过 claude-code CLI 的 pipe 模式通信
- [x] 实现 CursorCommunicator：通过 Cursor CLI `--pipe` 模式通信（如支持）
- [x] AgentManager 集成：`agent.run(name, prompt)` 和 `agent.chat(name)` API
- [x] RPC handler 注册新方法：`agent.run`, `agent.chat`
- [x] 错误处理：agent 未运行、通信超时、输出解析失败

#### #114 CLI Agent 交互（chat / run）
> **目标**：用户通过 CLI 与运行中的 agent 交互。

- [x] `agent run <name> --prompt "..."` — 发送单次任务，等待结果，输出后退出
- [x] `agent chat <name>` — 进入交互式对话模式（类 REPL）
- [x] 流式输出：实时显示 agent 回复
- [x] 对话历史：chat 模式下维护上下文
- [x] Ctrl+C 优雅退出 chat 模式（不停止 agent）

#### #115 MVP 端到端集成与示例模板
> **目标**：验证完整流程可用，提供开箱即用的示例。

- [x] 示例模板：`configs/templates/code-review-agent.json`（引用真实 skills/prompts/MCP）
- [x] Quick-start 文档更新（README 中添加 MVP 使用流程）
- [x] 端到端测试：template load → agent create → verify workspace → agent start → agent run → agent stop
- ~~`actant init` 快速引导命令~~ → 移至长期目标（Phase 6+）

**Phase 2 依赖关系:**
```
Phase 1 (已完成)
 ├──→ #112 Domain Context 全链路打通
 │     └──→ #113 Domain 组件加载与 CLI 管理
 │           └──→ #115 MVP 端到端集成与示例
 │
 └──→ #13 Daemon ↔ Agent 通信 (ACP Client 简化版)
       └──→ #114 CLI Agent 交互 (chat / run)
             └──→ #115 MVP 端到端集成与示例
```

---

### Phase 3: 通信 · 管理 · 构造 · 共享 · 调度 (Connectivity & Management)
**目标**: 标准协议接入、完整组件管理、差异化构造器、可共享生态体系、雇员型 Agent 持续调度
**时间**: 当前
**成功标准**: 组件完整 CRUD + Plugin 管理；不同后端差异化 workspace 构建；模板权限控制；Template/组件可通过 Source 分享 + 版本管理；雇员型 Agent 可被 Daemon 持续调度 + N8N 可选集成

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #15 | ACP Proxy — 标准 ACP 协议网关（基础版） | P1 | #23, #26 | ✅ 完成 |
| #18 | ACP Proxy + Chat — Direct Bridge 与 Session Lease 双模式 | P1 | #15 | ✅ 完成 |
| **#43** | **统一组件管理体系 — Skill / Prompt / Plugin 完整 CRUD** | **P1** | #112, #113 | ✅ 完成 |
|   #94 | └─ BaseComponentManager CRUD 增强 | P0 | - | ✅ 完成 |
|   #97 | └─ PluginManager + Schema + 示例 | P0 | #94 | ✅ 完成 |
|   #98 | └─ RPC Handlers + CLI 命令扩展 | P0 | #94, #97 | ✅ 完成 |
| **#45** | **Workspace 构造器 — 差异化后端构建** | **P1** | #43 | ✅ 完成 |
|   #99 | └─ BackendBuilder + CursorBuilder + ClaudeCodeBuilder | P0 | #97 | ✅ 完成 |
|   #100 | └─ WorkspaceBuilder Pipeline + 迁移 | P0 | #99 | ✅ 完成 |
| **#47** | **雇员型 Agent — 内置调度器 + N8N 集成** | **P1** | #41, #13, #25 | ✅ 完成 |
|   #101 | └─ TaskQueue + Dispatcher + ExecutionLog | P0 | - | ✅ 完成 |
|   #102 | └─ InputRouter + InputSources | P0 | #101 | ✅ 完成 |
|   #103 | └─ EmployeeScheduler + 集成 + CLI | P0 | #101, #102 | ✅ 完成 |
| #41 | 雇员型 Agent — 设计文档（原始设计） | ref | #13, #25 | ✅ 已关闭（实现通过 #47 交付） |
| ~~#104~~ | ~~AgentTemplate 权限控制 — 对齐 Claude Code permissions~~ | P1 | #45, #99 | 已关闭（推迟到后续 Phase） |
| ~~#105~~ | ~~AgentTemplate 可通过 Source 分享 + Preset 支持~~ | P1 | #43 | 已关闭（推迟到后续 Phase） |
| ~~#106~~ | ~~可共享内容版本控制 — 组件/模板/预设版本管理~~ | P1 | #43, #105 | 已关闭（推迟到后续 Phase） |
| #16 | MCP Server — Agent 管理能力暴露（可选 MCP 接入） | **P4** | #13 | 长期保留 |
| #8 | Template hot-reload on file change | P2 | - | 待开始 → Phase 4 |

#### #15 ACP Proxy — 标准 ACP 协议网关（基础版） ✅ 完成
> **实现内容**：
> - `@actant/acp` 包：`AcpConnection`（封装 `@agentclientprotocol/sdk` ClientSideConnection + 子进程管理），`AcpConnectionManager`（连接池管理），`AcpCommunicator`（AgentCommunicator 适配）
> - `claude-code` 后端从 `claude --project-dir` 改为 `claude-agent-acp`（ACP stdio 通信）
> - `ProcessLauncher` 支持 ACP backends 保持 stdio pipes
> - `AgentManager` 集成 ACP：`startAgent` 建立连接，`stopAgent` 断开，`runPrompt` 优先 ACP，新增 `promptAgent`
> - `agent.prompt` RPC handler + CLI 命令
> - `proxy.connect/disconnect/forward` RPC handlers
> - `actant proxy <name>` CLI 命令：对外 ACP Agent 接口，对内 RPC 转发

#### #18 ACP Proxy + Chat — Direct Bridge 与 Session Lease 双模式
> **当前校正说明（2026-03-14）**：历史实现曾以 Direct Bridge 叙事为主，但当前规范已改为 **running service => lease-first shared runtime**。Direct Bridge 保留为兼容/显式隔离路径，不再作为运行中 `service` 的默认产品语义。
>
> **设计校正目标**：把 proxy/chat/prompt/session/Dashboard/internal communication 统一到同一 communication layer，而不是继续分别修补单点行为。
>
> - `service` 是共享 runtime communication target
> - `proxy` 对运行中的 service 默认 lease-first
> - `running` 应趋向 communication-ready，而不是仅 process-alive
> - `run` 对 service 属于兼容路径，不是主契约

#### #43 统一组件管理体系 — Skill / Prompt / Plugin 完整 CRUD
> **目标**：增强 BaseComponentManager 支持完整 CRUD + import/export + 搜索过滤。新增 PluginManager 管理 Cloud Code 插件。
>
> - Skill/Prompt：add/update/remove + 持久化 + 导入导出
> - Plugin（Cloud Code）：完整 CRUD，支持 npm/file/config 三种安装方式
> - CLI：扩展 skill/prompt 管理命令 + 新增 plugin 全套命令
> - 模板 domainContext 支持 `plugins` 字段

#### #45 Workspace 构造器 — 面向不同后端的差异化构建
> **目标**：用 Strategy Pattern 重构 workspace 构建流程，取代当前硬编码的 ContextMaterializer。
>
> - `BackendBuilder` 接口：scaffold / materialize / inject-permissions / verify
> - `CursorBuilder`：`.cursor/rules/*.mdc` + `.cursor/mcp.json` + AGENTS.md
> - `ClaudeCodeBuilder`：`.claude/*` + CLAUDE.md + plugins.json
> - `CustomBuilder`：通过 template config 自定义路径
> - Pipeline：resolve → validate → scaffold → materialize → inject → verify

#### #47 雇员型 Agent — 内置调度器 + N8N 集成
> **基于 #41 设计**，实现内置简单调度器 + 可选 N8N 集成。
>
> - 内置调度器：InputRouter → TaskQueue → TaskDispatcher
> - InputSources：Heartbeat / Cron（croner 库）/ Hook / Webhook
> - N8N 集成三模式：N8N→Actant（Webhook）、Actant→N8N（MCP）、双向
> - CLI：agent dispatch / agent tasks / agent logs / agent watch
> - 模板支持 `schedule` + `schedule.n8n` 配置字段

#### ~~#104 AgentTemplate 权限控制~~ (已关闭，推迟)
> 模板权限控制、Source 分享、版本管理三项已推迟到后续 Phase。设计方案保留在各 GitHub Issue body 中。

#### ~~#105 AgentTemplate 可通过 Source 分享~~ (已关闭，推迟)

#### ~~#106 可共享内容版本控制~~ (已关闭，推迟)

**Phase 3 依赖关系:**
```
Phase 2 (已完成)
 ├──→ #15 ACP Proxy 基础版 ✅
 │     └──→ #18 Proxy + Chat 双模式 ✅
 │
 ├──→ 管理线 (3a): #43 统一组件管理
 │     #94 BaseComponentManager CRUD
 │       └──→ #97 PluginManager + Schema
 │             └──→ #98 RPC + CLI
 │                   └──→ #43 完成 ✓
 │
 ├──→ 构造线 (3b): #45 Workspace 构造器 (依赖 3a #97)
 │     #99 BackendBuilder + CursorBuilder + ClaudeCodeBuilder
 │       └──→ #100 WorkspaceBuilder Pipeline + 迁移
 │       │     └──→ #45 完成 ✓
 │       └──→ #104 AgentTemplate 权限控制 (依赖 #99 BackendBuilder)
 │
 ├──→ 共享增强线 (3d): Source 体系完善 (依赖 3a #43)
 │     #105 AgentTemplate 可通过 Source 分享 + Preset 支持
 │       └──→ #106 可共享内容版本控制 — 组件/模板/预设版本管理
 │
 ├──→ 调度线 (3c): #47 雇员型 Agent (独立于 3a/3b)
 │     #101 TaskQueue + Dispatcher
 │       └──→ #102 InputRouter + Sources
 │             └──→ #103 Scheduler + 集成 + CLI
 │                   └──→ #47 完成 ✓
 │
 └──→ #16 MCP Server (Agent-to-Agent)

#8 Template hot-reload (独立)
```

---

### Phase 4: 自治 Agent 平台 (Hook · Plugin · 强化 · 通信)
**目标**: 把 Actant 从“可拼装、可运行的 Agent 系统”推进为“以 service 为主交付、以 employee 为自治增强层”的底层平台
**时间**: Phase 3 完成后（当前）
**当前状态**: 基础设施已部分落地，但产品叙事、Plugin 边界与平台层次仍需统一
**成功标准**: Hook / Workflow 事件体系可在系统层、实例层、运行时层稳定工作；PluginHost 成为 actant-side 的系统级扩展统一入口；调度、初始化、上下文注入、协作、记忆等能力围绕平台底座收敛；Dashboard / REST API / SSE 能持续反映自治运行状态

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| **#297** | **Project-level DomainContext / 作用域 / reactive sync 收口** | **P0** | #296 | 🔥 **当前最高优先** |
| **#296** | **从 core 提取 project-context packages** | **P0** | - | ✅ 已完成（2026-03-17） |
| **#279** | **统一通信层与 Runtime Facade 收敛 — ActantChannel + Claude Agent SDK** | **P1** | 自举宿主主线稳定后 | 📋 作为支撑架构继续推进 |
| **#135** | **Workflow 重定义为 Hook Package — 事件驱动自动化** | **P1** | #47 | ✅ 基础已完成，后续与 Plugin Core 继续整合 |
| **#14** | **Actant 系统级 Plugin 体系（heartbeat/scheduler/memory 可插拔）** | **P1** | #22, #47 | 📋 待自举宿主与 Hub 边界稳定后推进 |
| #122 | Employee/Service Mode 完善 / 调度增强 | P2 | #14, #210, #211 | 📋 待开始 |
| **#134** | **agent open + interactionModes — 前台 TUI** | **P2** | - | ✅ 已完成 |
| **#133** | **环境变量作为默认 provider 配置** | **P2** | - | 📋 待开始 |
| **#136** | **Agent-to-Agent Email 通信 — CLI/API/Email 异步范式** | **P2** | #122 后收益更高 | 📋 待开始 |
| #37 | Initializer: extensible Agent init framework | P1 | #14（集成后收益更高） | 📋 待开始 |
| #40 | Agent 工具权限管理机制设计 | P2 | - | 待开始 |
| #9 | Agent 进程 stdout/stderr 日志收集 | P3 | - | 待开始 |
| #128 | spawn EINVAL 友好错误提示 | P2 | - | 待开始 |
| #8 | Template hot-reload on file change | P2 | - | 待开始 |
| #38 | Template: Endurance Test Agent | P2 | #37 | 待开始 |
| #16 | MCP Server — Agent 管理能力暴露（可选 MCP 接入） | **P4** | #13 | 长期保留 |

**Phase 4 已有基础**：
- Hook 类型体系、Hook EventBus、Hook Package 基础已完成
- Dashboard 已从最小监控扩展为 React SPA + REST API + SSE + 事件流
- 动态上下文注入与内置 MCP Server 已打通，Canvas 能力已可用
- `#296` 已为轻宿主 / Hub 分层拆出 project-context 相关包
- `#297` 已完成收口：`actant hub` / `acthub`、`bootstrap` profile、Hub Core、MCP 收口、正式安装链均已落地
- `agent open`、Pi 后端、ToolRegistry 硬化等外围能力已补齐

**推荐推进顺序**：
1. **项目回顾审查与稳定性修复**：在 CLI-first 自举主线已落地的基础上做更广范围的回归与问题收敛
2. **#279 统一通信层收敛**：作为支撑架构继续推进 `ActantChannel` / `ClaudeAgentSdkAdapter` / `@actant/acp` 外部适配器化
3. 以 #14 Plugin Core 作为平台底座
4. 在 #14 之上推进 #122 调度增强、#37 Initializer、#133 env provider，再推进 #136 Email 与 Memory 深化

**#135 Hook 三层架构：**
```
Layer 1: Actant 系统层（全局事件）
  agent:created / agent:destroyed / agent:modified
  actant:start / actant:stop / source:updated / cron:<expr>
  → Actant-level Workflow 监听

Layer 2: AgentInstance（作用域绑定）
  不产生独立事件，而是绑定 scope
  Instance-level Workflow 绑定到特定实例，监听其 Layer 3 事件

Layer 3: 进程 / Session 运行时事件
  process:start / process:stop / process:crash / process:restart
  session:start / session:end
  prompt:before / prompt:after / error / idle
  → 由 Instance-level Workflow 按实例 scope 监听
```

**#136 Agent-to-Agent Email 范式（CLI/API 优先）：**
```
通信通道:
  P1 CLI:      actant email send/inbox/reply/threads
  P1 RPC:      email.send / email.inbox / email.reply (JSON-RPC via IPC)
  P4 MCP:      actant_send_email 等 (可选, #16)

架构:
  CLI / RPC ──→ Actant Daemon ──→ Email Hub
                                    ├── 路由 + 投递 + 持久化
                                    ├── 雇员 Agent → EmailInput → TaskQueue → 主 Session
                                    └── 普通 Agent → 新进程处理 → 自动回复
```

**Plugin 类型说明：**
```
Agent-side Plugin (#43, Phase 3):
  Agent workspace 中的能力扩展（Claude Code plugin、Cursor Extension 等）
  由 PluginManager 管理，通过 BackendBuilder 物化到 workspace

Actant-side Plugin (#14, Phase 4):
  Actant Daemon 的系统级扩展（HeartbeatMonitor、Scheduler、MemoryLayer 等）
  由 Plugin 接口定义生命周期钩子
```

---

### Phase 5: 记忆系统 (Memory)
**目标**: 分层记忆体系，支持长期记忆与跨实例共享
**时间**: Phase 4 完成后
**成功标准**: Agent 具备上下文感知、记忆检索、跨会话连贯性

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #10 | Instance Memory Layer (Phase 1) | P3 | - | 待开始 |
| #11 | Memory Consolidation + Shared Memory (Phase 2) | P3 | #10 | 待开始 |
| #12 | Context Layers + ContextBroker (Phase 3) | P3 | #11 | 待开始 |
| #20 | OpenViking as optional MCP Server integration | P3 | #11 | 待开始 |

**Phase 5 演进路径:**
```
#10 Instance Memory Layer (单实例记忆)
 └──→ #11 Memory Consolidation (跨实例共享)
       ├──→ #12 Context Layers (上下文分层)
       └──→ #20 OpenViking MCP (外部记忆源)
```

---

## 当前进行中 (Current)

Phase 1-3 全部完成。Phase 4 基础设施已部分落地（8/15 Steps）。#296/#297 CLI-first 自举主线已完成。

**当前最高优先：Context-First 架构重构**——通过 Phase A（工程清理）和 Phase B（架构实施）将 Actant 从 Agent 平台重构为**上下文平台**。详见设计文档 [context-first-multi-source-architecture.md](../design/context-first-multi-source-architecture.md)。

**当前产品定位演进：**
- Actant = **上下文平台**，Agent 是消费上下文的一种方式（Context-First 反转）
- `ContextManager` 是平台的核心抽象，管理所有上下文源（Domain / Agent / Project / Runtime）
- 对外通过 MCP/VFS 暴露可浏览的上下文资源和可调用的工具
- 对内 Internal Agent 只固化 identity + rules，运行时动态获取其他上下文
- `repo -> service -> employee` 管理模型不变，但 Agent 不再是唯一的顶层概念

**当前主线任务**：
- 🔥 **Phase A：工程清理与 v0.4.0 存档**（当前执行中）
  - [ ] A-1 废弃代码清理（17 处 @deprecated）
  - [ ] A-2 无效依赖清理（mcp-server 幽灵依赖）
  - [ ] A-3 @actant/core 内聚性梳理（消除与独立包的重复）
  - [ ] A-4 测试补强与质量基线（集成测试 + bug fix + coverage）
  - [ ] A-5 版本存档（v0.4.0 tag）
- 📋 **Phase B：Context-First 架构实施**（Phase A 完成后启动）
  - B-0 ContextManager 骨架 → B-1 DomainContextSource → B-2 AgentTemplate 增量 → B-3 UnrealProjectSource → B-4 系统桥接 → B-5 重命名与模块收缩 → B-6 v0.5.0 发布

**已完成主线**：
- ✅ Phase 1 Foundation：ProcessWatcher、LaunchMode 分化、external spawn、one-shot、acp-service 崩溃恢复
- ✅ Phase 2 MVP：Domain Context 全链路、组件加载与 CLI 管理、Daemon ↔ Agent 通信、CLI chat/run、端到端模板示例
- ✅ Phase 3 协议/管理/构造/调度：ACP Proxy + Session Lease、统一组件管理、WorkspaceBuilder 差异化构造、EmployeeScheduler + TaskQueue
- ✅ Phase 4 部分：Hook 基础、Dashboard v2、VFS、Capability-driven backend、`agent open`、Pi 后端、#296/#297 CLI-first 自举

**被 Phase B 取代/合并的原 Phase 4 未完成项**：
- #279 统一通信层 → Phase B-4 桥接阶段中处理通信层适配
- #14 Plugin 体系 → Phase B 完成后重新评估
- #122 调度增强、#136 Email 通信 → 保留，不受重构影响
- #133 env provider → 已完成核心，仅剩文档同步
- `03-11-capability-backend-runtime`、`03-11-issue276-daemon-socket-normalization` → 合并入 Phase A 清理

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
| 协议线 | ACP 包 (`@actant/acp`) | `AcpConnection`、`AcpConnectionManager`、`AcpCommunicator`、Proxy + Chat 双模式 |
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

按依赖关系与平台价值排序。当前最高优先是 **Context-First 架构重构**（Phase A + Phase B）。

### A. Phase A — 工程清理与 v0.4.0 存档（🔥 当前执行中）

详见 [context-first-multi-source-architecture.md §迁移计划 Phase A](../design/context-first-multi-source-architecture.md)。

| 顺序 | 子阶段 | 类型 | 预计 | 说明 |
|------|--------|------|------|------|
| 1 | **A-1 废弃代码清理** | cleanup | 2-3 天 | 清零全部 17 处 `@deprecated`：EventJournal、ActivityRecorder、MockLauncher、ContextMaterializer、Legacy proxy handlers 等 |
| 2 | **A-2 无效依赖清理** | cleanup | 0.5 天 | 移除 mcp-server 的 `@actant/domain`、`@actant/source` 幽灵依赖 |
| 3 | **A-3 @actant/core 内聚性梳理** | refactor | 1-2 天 | 消除 core 内部 domain/source/vfs 子目录与独立包的重复定义，标注 Phase B 迁移归属 |
| 4 | **A-4 测试补强与质量基线** | quality | 1-2 天 | 各 archetype 端到端集成测试 + 修复 #238/#239/#240 + coverage baseline |
| 5 | **A-5 版本存档** | release | 0.5 天 | 全部 package 升至 `0.4.0`，打 tag `v0.4.0` |

### B. Phase B — Context-First 架构实施（Phase A 完成后启动）

详见 [context-first-multi-source-architecture.md §迁移计划 Phase B](../design/context-first-multi-source-architecture.md)。

| 顺序 | 子阶段 | 类型 | 预计 | 说明 |
|------|--------|------|------|------|
| 6 | **B-0 ContextManager 骨架** | new package | 1-2 天 | 创建 `@actant/context`：ContextSource 接口 + ContextManager + MCP Server |
| 7 | **B-1 DomainContextSource** | feature | 2-3 天 | 包装 SkillManager/PromptManager 为 VFS 投影 |
| 8 | **B-2 AgentTemplate/Manager 增量** | enhancement | 1-2 天 | rules + toolSchema + ContextManager MCP 注入 + Agent→Tool 回注 |
| 9 | **B-3 UnrealProjectSource** | feature | 3-5 天 | 大型游戏项目上下文投影 |
| 10 | **B-4 现有系统桥接** | migration | 3-5 天 | MCP Server / Hub / CLI 切换 + #279 通信层适配 |
| 11 | **B-5 重命名与旧模块收缩** | refactor | 2-3 天 | `@actant/core` → `@actant/agent-runtime` + 删除被替代模块 |
| 12 | **B-6 版本发布** | release | 1 天 | 全部 package 升至 `0.5.0`，打 tag `v0.5.0` |

### C. 架构重构后继续推进的独立项

> 以下项不受 Context-First 重构阻塞，或在 Phase B 完成后重新评估。

| 顺序 | Issue | 标题 | 状态 | 说明 |
|------|-------|------|------|------|
| 13 | **#14** | Actant 系统级 Plugin 体系 | Phase B 后评估 | 在 ContextManager 架构上重新设计 Plugin 边界 |
| 14 | **#122** | 调度器四模式增强 | 不受影响 | 已完成主链，仅剩 plugin wiring / 可观测性补强 |
| 15 | **#136** | Agent-to-Agent Email 通信 | 不受影响 | 异步协作范式 |
| 16 | #40 | Agent 工具权限管理 | 不受影响 | 平台安全与权限边界 |
| 17 | #8 | Template hot-reload | 不受影响 | DX 增强 |
| 18 | #9 | Agent 进程日志收集 | 不受影响 | 可观测性补强 |

### D. 长期方向

| 顺序 | Issue | 标题 | 说明 |
|------|-------|------|------|
| 19 | #10 | Instance Memory Layer | 实例级长期记忆 |
| 20 | #11 | Memory Consolidation + Shared Memory | 跨实例记忆整合 |
| 21 | #12 | Context Layers + ContextBroker | 上下文分层与代理（可能合并入 ContextManager） |
| 22 | #20 | OpenViking as optional MCP Server | 可选 MCP 集成 |
| 23 | #17 | ACP-Fleet 扩展协议 | 长期愿景：Daemon 升级为 ACP Server |

---

## 已完成

| Issue | 标题 | 完成日期 | 所属阶段 |
|-------|------|---------|---------|
| #22 | ProcessWatcher：进程退出检测与心跳监控 | 2026-02-20 | Phase 1 |
| #23 | LaunchMode 行为分化 | 2026-02-20 | Phase 1 |
| #24 | one-shot 模式完整实现 | 2026-02-20 | Phase 1 |
| #25 | acp-service 崩溃重启策略 | 2026-02-20 | Phase 1 |
| #26 | agent.resolve / attach / detach API — 外部 Spawn 支持 | 2026-02-20 | Phase 1 |
| #5 | CLI 包测试覆盖率为零 — 补充单元测试 | 2026-02-20 | Phase 1 (质量) |
| #6 | CLI 包 console.log 违反质量规范 — 引入 CliPrinter 结构化输出层 | 2026-02-20 | Phase 1 (质量) |
| #21 | 审查与文档化：配置结构与对外接口 + Workflow 约定 | 2026-02-20 | Phase 1 (准备) |
| #19 | Real Agent Launcher implementation | 2026-02-20 | Phase 1 (准备) |
| #112 | Domain Context 全链路打通 | 2026-02-20 | Phase 2 MVP |
| #113 | Domain 组件加载与 CLI 管理 | 2026-02-20 | Phase 2 MVP |
| #13 | Daemon ↔ Agent 通信 (ACP Client 简化版) | 2026-02-20 | Phase 2 MVP |
| #114 | CLI Agent 交互 (chat / run) | 2026-02-20 | Phase 2 MVP |
| #115 | MVP 端到端集成与示例模板 | 2026-02-20 | Phase 2 MVP |
| #15 | ACP Proxy — 标准 ACP 协议网关 | 2026-02-20 | Phase 3 |
| #18 | ACP Proxy + Chat — Direct Bridge 与 Session Lease 双模式 | 2026-02-20 | Phase 3 |
| #94 | BaseComponentManager CRUD 增强 | 2026-02-21 | Phase 3a |
| #97 | PluginManager + Schema + 示例 | 2026-02-21 | Phase 3a |
| #98 | RPC Handlers + CLI 命令扩展 | 2026-02-21 | Phase 3a |
| #99 | BackendBuilder + CursorBuilder + ClaudeCodeBuilder | 2026-02-21 | Phase 3b |
| #100 | WorkspaceBuilder Pipeline + AgentInitializer 迁移 | 2026-02-21 | Phase 3b |
| #101 | TaskQueue + TaskDispatcher + ExecutionLog | 2026-02-21 | Phase 3c |
| #102 | InputRouter + HeartbeatInput + CronInput + HookInput | 2026-02-21 | Phase 3c |
| #103 | EmployeeScheduler + AgentManager 集成 + CLI | 2026-02-22 | Phase 3c |

---

## 完整依赖关系图

```
═══════════════════════════════════════════════════════════════
                        Phase 1: 核心运行时  ✅
═══════════════════════════════════════════════════════════════

#22 ProcessWatcher (P0) ✅
 ├──→ #23 LaunchMode 行为分化 (P0) ✅
 │     ├──→ #26 resolve/attach/detach (P1) ✅
 │     ├──→ #24 one-shot 完整实现 (P1) ✅
 │     │
 │     └──→ [Phase 2 MVP] #13 ACP Client 简化版
 │     └──→ [Phase 2 MVP] #112 Domain Context 全链路
 │
 ├──→ #25 acp-service 崩溃重启 (P1) ✅
 └──→ [Phase 4] #14 Plugin 体系 (P2)


═══════════════════════════════════════════════════════════════
              Phase 2: MVP — Agent 拼装与交互  ✅
═══════════════════════════════════════════════════════════════

拼装线:
Phase 1 ──→ #112 Domain Context 全链路打通 (P0) ✅
              └──→ #113 Domain 组件加载与 CLI 管理 (P0) ✅
                    └──→ #115 MVP 端到端集成 ✅

交互线:
Phase 1 ──→ #13 Daemon ↔ Agent 通信 (P0) ✅
              └──→ #114 CLI Agent 交互 chat/run (P0) ✅
                    └──→ #115 MVP 端到端集成 ✅


═══════════════════════════════════════════════════════════════
       Phase 3: 通信 · 管理 · 构造 · 调度  ← 当前
═══════════════════════════════════════════════════════════════

协议线:
#13 (来自 MVP)
 ├──→ #15 ACP Proxy 基础版 (P1) ✅
 │     └──→ #18 Proxy + Chat 双模式 (P1)
 │           Session Lease（默认）+ Direct Bridge（--direct）
 │
 └──→ #16 MCP Server (P4) ← 可选 MCP 接入，长期保留

管理线:
#112/#113 (来自 MVP)
 └──→ #43 统一组件管理体系 (P1)
       Skill/Prompt CRUD + PluginManager + import/export
       ├──→ #45 Workspace 构造器 (P1)
       │     BackendBuilder strategy: Cursor/ClaudeCode/Custom
       │     scaffold → materialize → inject → verify
       │     └──→ #104 AgentTemplate 权限控制 (P1)
       │           对齐 Claude Code permissions + sandbox
       │
       └──→ 共享增强线:
             #105 AgentTemplate 可通过 Source 分享 (P1)
               └──→ #106 可共享内容版本控制 (P1)
                     组件/模板/预设版本管理 + SyncReport

调度线:
#25/#13 (来自 Phase 1/2)
 └──→ #47 雇员型 Agent + 调度器 + N8N (P1)
       ← #41 设计文档
       InputRouter → TaskQueue → TaskDispatcher
       Heartbeat / Cron / Hook / Webhook / N8N Bridge

#8 Template hot-reload (P2) — 独立


═══════════════════════════════════════════════════════════════
         Phase 4: 自治 Agent 平台 (Hook · Plugin · 强化 · 通信)
═══════════════════════════════════════════════════════════════

Hook/Workflow 线:
#47 EmployeeScheduler (来自 Phase 3c)
 └──→ #135 Workflow 重定义为 Hook Package (P1)
       Hook 三层架构: Actant 系统层 / Instance scope / Process·Session 运行时
       schema + event bus + action runner (shell/builtin/agent)
       └──→ #47 CronInput/HookInput 统一到 Workflow

Plugin 线:
#22 ProcessWatcher (来自 Phase 1)
 └──→ #14 Actant 系统级 Plugin 体系 (P1)
       ├──→ #47 Input 系统 Plugin 化 (重构)
       ├──→ memory 插件 (连接 Phase 5)
       └──→ 自定义插件加载器

雇员强化线:
#134 agent open + interactionModes (P2) — 前台 TUI
#133 环境变量 provider 配置 (P2) — DX
#37 Extensible Initializer (P1) → #38 Endurance Test Agent (P2)
#128 spawn EINVAL 友好提示 (P2)

Agent-to-Agent 通信线:
#136 Agent-to-Agent Email 通信 (P2) — 无硬性前置依赖
      CLI: actant email send/inbox/reply
      RPC: email.send / email.inbox (JSON-RPC)
      EmailHub: 路由 + 投递 + 持久化 + 跨时间线
      (可选增强: #10 Memory 做持久化)

#16 MCP Server (P4) — 可选 MCP 接入，长期保留
#40 Agent 工具权限管理 (P2) — 独立
#8 Template hot-reload (P2) — 独立
#9 日志收集 (P3) — 独立


═══════════════════════════════════════════════════════════════
                  Phase 5: 记忆系统
═══════════════════════════════════════════════════════════════

#10 Instance Memory Layer (P3)
 └──→ #11 Memory Consolidation + Shared Memory (P3)
       ├──→ #12 Context Layers + ContextBroker (P3)
       └──→ #20 OpenViking MCP Server (P3)


═══════════════════════════════════════════════════════════════
               Phase 6: ACP-Fleet 标准化 (长期愿景)
═══════════════════════════════════════════════════════════════

#13 + #15 (来自 Phase 2-3)
 └──→ #17 ACP-Fleet 扩展协议 (P4)
       ├──→ Daemon 升级为 ACP Server
       ├──→ fleet/* 命名空间标准化
       ├──→ ACP Proxy 简化为 transport shim
       └──→ ACP-Fleet Extension Spec 发布
```

---

## 四种外部接入模式（参见 spec/api-contracts.md §9）

```
控制权谱系：
Actant 全权 ◄──────────────────────────────────► 调用方全权

 agent.run       ACP Proxy      Self-spawn+Attach    纯 resolve
 (#13)           (#15)          (#26)                (#26)
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
