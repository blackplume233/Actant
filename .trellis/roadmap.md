# Product Roadmap

> 项目优先级与规划总览。与 Trellis Issues / Tasks / Milestones 对齐，作为「后续要做的事」的单一入口。
> 更新节奏：当前任务推进、Issue 状态变更或里程碑调整时同步更新本文。
> **Task 级 Todo**：在本文持续迭代当前任务的勾选清单，随开发进展更新 `[ ]` → `[x]`，完成一项勾一项。

---

## 项目愿景

构建一个**企业级 Agent 运行时平台**，支持多模式 Agent 启动、生命周期管理、标准协议通信和可插拔扩展体系。

**核心能力矩阵：**
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

## 阶段划分

### Phase 1: 核心运行时 (Foundation)
**目标**: 稳定可靠的 Agent 启动、进程管理与外部 Spawn 支持
**时间**: 当前 - 近期
**成功标准**: 所有 LaunchMode 可正常启动、监控、终止；外部客户端可 resolve + spawn + attach

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #8 | ProcessWatcher：进程退出检测与心跳监控 | P0 | - | ✅ 完成 |
| #9 | LaunchMode 行为分化 | P0 | #8 | ✅ 完成 |
| #15 | agent.resolve / agent.attach / agent.detach API | P1 | #8, #9 | ✅ 完成 |
| #10 | one-shot 模式完整实现 | P1 | #8, #9 | ✅ 完成 |
| #11 | acp-service 崩溃重启策略 | P1 | #8 | ✅ 完成 |

**Phase 1 依赖关系:**
```
#8 ProcessWatcher (基础)
 ├──→ #9 LaunchMode 行为分化
 │     ├──→ #15 resolve/attach/detach (外部 Spawn 支持)
 │     └──→ #10 one-shot 完整实现
 └──→ #11 acp-service 崩溃重启
```

---

### Phase 2: 通信与协议 (Connectivity)
**目标**: 标准协议接入 — 外部应用通过 ACP Proxy 接入，Agent 间通过 MCP Server 通信
**时间**: Phase 1 完成后
**成功标准**: ACP Proxy 可被任意 ACP Client spawn 使用；MCP Server 可被其他 Agent 调用

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #16 | ACP Proxy — 标准 ACP 协议网关 | P1 | #9, #15 | 待开始 |
| #12 | ACP 协议集成（Daemon 侧 ACP Client + agent.run/prompt） | P1 | #9 | 待开始 |
| #17 | MCP Server — Agent 间通信能力 | P2 | #12 | 待开始 |
| #5 | Template hot-reload on file change | P2 | - | 待开始 |

**Phase 2 依赖关系:**
```
#9 LaunchMode 行为分化 (来自 Phase 1)
 ├──→ #12 ACP 协议集成 (Daemon ↔ Agent 的 ACP 通信)
 │     └──→ #17 MCP Server (Agent-to-Agent, 依赖 agent.run/prompt)
 │
 └──→ #16 ACP Proxy (标准 ACP 网关, 依赖 #15 resolve/attach)

#5 Template hot-reload (独立)
```

---

### Phase 3: 扩展体系 (Extensibility)
**目标**: 可插拔的插件架构
**时间**: Phase 2 完成后
**成功标准**: Employee = acp-service + plugins，插件可独立开发/加载

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #13 | Plugin 体系设计（heartbeat/scheduler/memory 可插拔） | P2 | #8 | 待开始 |
| #14 | Agent 进程 stdout/stderr 日志收集 | P3 | - | 待开始 |

**Phase 3 关键设计:**
- Plugin 接口定义（生命周期钩子、配置解析）
- 核心插件集：heartbeat / scheduler / memory
- 插件加载器（本地文件 / 远程 registry）

---

### Phase 4: 记忆系统 (Memory)
**目标**: 分层记忆体系，支持长期记忆与跨实例共享
**时间**: Phase 3 完成后
**成功标准**: Agent 具备上下文感知、记忆检索、跨会话连贯性

| Issue | 标题 | 优先级 | 依赖 | 状态 |
|-------|------|--------|------|------|
| #1 | Instance Memory Layer (Phase 1) | P3 | - | 待开始 |
| #2 | Memory Consolidation + Shared Memory (Phase 2) | P3 | #1 | 待开始 |
| #3 | Context Layers + ContextBroker (Phase 3) | P3 | #2 | 待开始 |
| #6 | OpenViking as optional MCP Server integration | P3 | #2 | 待开始 |

**Phase 4 演进路径:**
```
#1 Instance Memory (单实例记忆)
 └──→ #2 Memory Consolidation (跨实例共享)
       ├──→ #3 Context Layers (上下文分层)
       └──→ #6 OpenViking MCP (外部记忆源)
```

---

## 当前进行中 (Current)

Phase 1 全部完成（Issues #8, #9, #10, #11, #15 已关闭，质量改进 #20, #22 已关闭），准备进入 Phase 2。

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

### 耐久测试覆盖 — 持续验证能力

> 耐久测试随 Phase 同步演进，详见 `spec/endurance-testing.md`。

| Phase | 覆盖场景 | 状态 |
|-------|---------|------|
| **Phase 1** | E-LIFE 生命周期循环 · E-SVC 崩溃重启 · E-SHOT one-shot 清理 · E-EXT 外部 Spawn · E-DAEMON 恢复 · E-MIX 混合并发 · 各模式关停行为矩阵 | ✅ 已实现 (10 场景) |
| **Phase 2** | E-RPC 高频通信 · E-ACP Proxy 持续转发 · E-MCP Agent 间通信 | ⏳ 待实现 |
| **Phase 3+** | E-PLUG 插件加载卸载 · E-MEM 记忆系统持久性 | ⏳ 待实现 |

每个 Phase 的功能完成时，**必须**同步扩展对应的耐久测试场景。

---

## 后续优先 (Next Up)

按推进优先级排列。依赖关系用 `→` 标注。

### P0 — 近期必做 (Phase 1 核心)

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 1 | **#8** | ProcessWatcher：进程退出检测与心跳监控 | 无 | 所有 LaunchMode 的基础——定时检活、退出检测、事件回调 |
| 2 | **#9** | LaunchMode 行为分化 | #8 | startAgent 根据 launchMode 走不同启动/监控/终止路径 |

### P1 — 近期跟进 (Phase 1 完善 + Phase 2 核心)

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 3 | **#15** | agent.resolve / attach / detach API | #8, #9 | 外部 Spawn 支持：resolve 获取启动信息，attach/detach 注册状态 |
| 4 | **#10** | one-shot 模式完整实现 | #8, #9 | 任务传递、退出码收集、自动清理 ephemeral workspace |
| 5 | **#11** | acp-service 崩溃重启策略 | #8 | 指数退避重启、超限停止、daemon 重启恢复 |
| 6 | **#16** | ACP Proxy — 标准 ACP 协议网关 | #9, #15 | 外部 ACP Client 以标准协议接入托管 Agent |
| 7 | **#12** | ACP 协议集成 (Daemon ACP Client) | #9 | Daemon 作为 ACP Client 与 Agent 通信，支持 agent.run/prompt |

### P2 — 中期 (Phase 2-3)

| 顺序 | Issue | 标题 | 依赖 | 说明 |
|------|-------|------|------|------|
| 8 | **#17** | MCP Server — Agent 间通信能力 | #12 | 暴露 agentcraft_run_agent 等 MCP tools |
| 9 | **#13** | Plugin 体系设计 | #8 | 可插拔插件架构，Employee = acp-service + plugins |
| 10 | #5 | Template hot-reload on file change | 无 | Daemon 监听 template 变更自动 reload |

### P3 — 长期 (Phase 3-4)

| 顺序 | Issue | 标题 | 说明 |
|------|-------|------|------|
| 11 | #14 | Agent 进程 stdout/stderr 日志收集 | 进程输出写入日志文件 + 可选实时查询 |
| 12 | #1 | Instance Memory Layer (Phase 1) | 实例级长期记忆 |
| 13 | #2 | Memory Consolidation + Shared Memory (Phase 2) | 跨实例记忆整合 |
| 14 | #3 | Context Layers + ContextBroker (Phase 3) | 上下文分层与代理 |
| 15 | #6 | OpenViking as optional MCP Server | 可选 MCP 集成 |
| 16 | #18 | ACP-Fleet 扩展协议 | 长期愿景：AgentCraft API 对齐 ACP 标准，Daemon 升级为 ACP Server |

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

---

## 完整依赖关系图

```
═══════════════════════════════════════════════════════════════
                        Phase 1: 核心运行时
═══════════════════════════════════════════════════════════════

#8 ProcessWatcher (P0)
 ├──→ #9 LaunchMode 行为分化 (P0)
 │     ├──→ #15 resolve/attach/detach (P1) ─→ [Phase 2] #16 ACP Proxy
 │     ├──→ #10 one-shot 完整实现 (P1)
 │     │
 │     └──→ [Phase 2] #12 ACP 协议集成 (P1)
 │                          └──→ [Phase 2] #17 MCP Server (P2)
 │
 ├──→ #11 acp-service 崩溃重启 (P1)
 └──→ [Phase 3] #13 Plugin 体系 (P2)


═══════════════════════════════════════════════════════════════
                        Phase 2: 通信与协议
═══════════════════════════════════════════════════════════════

#9 + #15 (来自 Phase 1)
 └──→ #16 ACP Proxy (P1)         ← 外部应用接入
      (workspace 隔离 + 环境穿透)

#9 (来自 Phase 1)
 └──→ #12 ACP 协议集成 (P1)      ← Daemon 侧 ACP Client
       └──→ #17 MCP Server (P2)  ← Agent-to-Agent

#5 Template hot-reload (P2) — 独立


═══════════════════════════════════════════════════════════════
                        Phase 3: 扩展体系
═══════════════════════════════════════════════════════════════

#8 ProcessWatcher (来自 Phase 1)
 └──→ #13 Plugin 体系设计 (P2)
       ├──→ heartbeat 插件
       ├──→ scheduler 插件
       └──→ memory 插件 (连接 Phase 4)

#14 日志收集 (P3) — 独立


═══════════════════════════════════════════════════════════════
                        Phase 4: 记忆系统
═══════════════════════════════════════════════════════════════

#1 Instance Memory Layer (P3)
 └──→ #2 Memory Consolidation + Shared Memory (P3)
       ├──→ #3 Context Layers + ContextBroker (P3)
       └──→ #6 OpenViking MCP Server (P3)


═══════════════════════════════════════════════════════════════
                   Phase 5: ACP-Fleet 标准化 (长期愿景)
═══════════════════════════════════════════════════════════════

#12 + #16 (来自 Phase 2)
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
| ACP 协议标准演进 | Phase 2 全部功能 | 关注 ACP spec 更新，保持 Proxy 协议适配层可替换 |
| Plugin 接口稳定性 | Phase 3+ 生态 | 设计时预留版本号，支持向后兼容 |
| Memory 存储选型 | Phase 4 性能 | 先实现内存存储，再考虑持久化方案 |
| ACP Proxy 环境穿透安全性 | Phase 2 | 外部客户端环境请求需要权限控制 |

---

## 维护说明

- **当前进行中**：与 `task.sh list` 一致，仅保留当前主动开发的任务。
- **Task 级 Todo**（持续迭代）：
  - 随开发推进在本文件中勾选完成项（`[ ]` → `[x]`），完成一项勾一项。
  - 当前任务完成后：将「后续优先」中下一项提为当前任务，从其 Issue body 抄写 Task 级 Todo。
- **后续优先**：从 Issue 列表提炼，保证前 3–5 项为共识的下一步。
- 新增/关闭 Issue 或完成 Task 后同步更新本表。
