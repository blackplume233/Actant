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
- [ ] `agentcraft init` 快速引导命令（可选，交互式创建模板）

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

### Phase 3: 通信与协议 (Connectivity)
**目标**: 标准协议接入 — 外部应用通过 ACP Proxy 接入，Agent 间通过 MCP Server 通信
**时间**: MVP 完成后
**成功标准**: ACP Proxy 可被任意 ACP Client spawn 使用；MCP Server 可被其他 Agent 调用

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #16 | ACP Proxy — 标准 ACP 协议网关 | P1 | #9, #15 | 待开始 |
| #17 | MCP Server — Agent 间通信能力 | P2 | #12 | 待开始 |
| #5 | Template hot-reload on file change | P2 | - | 待开始 |

**Phase 3 依赖关系:**
```
Phase 2 #12 (来自 MVP)
 ├──→ #16 ACP Proxy (标准 ACP 网关, 依赖 #15 resolve/attach)
 └──→ #17 MCP Server (Agent-to-Agent, 依赖 agent.run/prompt)

#5 Template hot-reload (独立)
```

---

### Phase 4: 扩展体系 (Extensibility)
**目标**: 可插拔的插件架构
**时间**: Phase 3 完成后
**成功标准**: Employee = acp-service + plugins，插件可独立开发/加载

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #13 | Plugin 体系设计（heartbeat/scheduler/memory 可插拔） | P2 | #8 | 待开始 |
| #14 | Agent 进程 stdout/stderr 日志收集 | P3 | - | 待开始 |

**Phase 4 关键设计:**
- Plugin 接口定义（生命周期钩子、配置解析）
- 核心插件集：heartbeat / scheduler / memory
- 插件加载器（本地文件 / 远程 registry）

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

Phase 1 和 Phase 2 MVP 全部完成，当前聚焦 **Phase 3: 通信与协议**。

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

### P1 — Phase 3 通信协议

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 6 | **#16** | ACP Proxy — 标准 ACP 协议网关 | #9, #15 | 外部 ACP Client 以标准协议接入托管 Agent |
| 7 | **#17** | MCP Server — Agent 间通信能力 | #12 | 暴露 agentcraft_run_agent 等 MCP tools |
| 8 | #5 | Template hot-reload on file change | 无 | Daemon 监听 template 变更自动 reload |

### P2 — Phase 4 扩展

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 9 | **#13** | Plugin 体系设计 | #8 | 可插拔插件架构，Employee = acp-service + plugins |
| 10 | #14 | Agent 进程 stdout/stderr 日志收集 | 无 | 进程输出写入日志文件 + 可选实时查询 |

### P3 — Phase 5 记忆 & 长期

| 顺序 | Issue | 标题 | 说明 |
|------|-------|------|------|
| 11 | #1 | Instance Memory Layer | 实例级长期记忆 |
| 12 | #2 | Memory Consolidation + Shared Memory | 跨实例记忆整合 |
| 13 | #3 | Context Layers + ContextBroker | 上下文分层与代理 |
| 14 | #6 | OpenViking as optional MCP Server | 可选 MCP 集成 |
| 15 | #18 | ACP-Fleet 扩展协议 | 长期愿景：Daemon 升级为 ACP Server |

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
            Phase 2: MVP — Agent 拼装与交互  ← 当前
═══════════════════════════════════════════════════════════════

拼装线:
Phase 1 ──→ #23 Domain Context 全链路打通 (P0)
              └──→ #24 Domain 组件加载与 CLI 管理 (P0)
                    └──→ #26 MVP 端到端集成

交互线:
Phase 1 ──→ #12 Daemon ↔ Agent 通信 (P0)
              └──→ #25 CLI Agent 交互 chat/run (P0)
                    └──→ #26 MVP 端到端集成


═══════════════════════════════════════════════════════════════
                  Phase 3: 通信与协议
═══════════════════════════════════════════════════════════════

#12 (来自 MVP)
 ├──→ #16 ACP Proxy (P1)         ← 外部应用接入
 └──→ #17 MCP Server (P2)        ← Agent-to-Agent

#5 Template hot-reload (P2) — 独立


═══════════════════════════════════════════════════════════════
                  Phase 4: 扩展体系
═══════════════════════════════════════════════════════════════

#8 ProcessWatcher (来自 Phase 1)
 └──→ #13 Plugin 体系设计 (P2)
       ├──→ heartbeat 插件
       ├──→ scheduler 插件
       └──→ memory 插件 (连接 Phase 5)

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
