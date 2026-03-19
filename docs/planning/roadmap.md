# Product Roadmap

> 项目优先级与规划总览。与 GitHub Issues 对齐，作为「后续要做的事」的单一入口。
> 更新节奏：任务推进、Issue 状态变更或里程碑调整时同步更新。
> **Task 级 Todo**：当前任务的勾选清单随开发进展更新 `[ ]` → `[x]`。

---

## 产品定位

**Actant = 上下文平台**，Agent 是消费上下文的一种方式。

> LLM 的行为 100% 由 context window 决定。管理上下文就是管理 Agent 的一切。

核心架构反转：将上下文管理从子功能提升为平台的核心抽象，Agent 服务降级为上下文的消费者和提供者。

**两层角色**：
1. **对外**：通过 MCP/VFS 向 External Agent（Cursor、Claude Code 等）暴露可浏览的上下文资源和可调用的工具。不替外部 Agent 做组装决定。
2. **对内**：Internal Agent 只固化最基本的 identity + rules，运行时通过 VFS 动态获取上下文。Internal Agent 对外暴露为 tool。

**交付形态基线**（不变）：
- **repo**：工作区承载层
- **service**：当前主交付形态（共享 runtime communication target）
- **employee**：service + 调度与自治能力的增强层

**协议分工**（不变）：
```
ACP:  人/应用 ←→ Agent     （交互协议）
MCP:  Agent ←→ 工具/服务    （能力协议）

Actant 同时扮演：
  • ACP Client（管理旗下 Agent）
  • MCP Server（向其他 Agent 暴露自身能力）
  • ACP Proxy（让外部客户端以标准 ACP 使用托管 Agent）
```

---

## Context-First 架构重构（已完成）

> **设计文档**：[context-first-multi-source-architecture.md](../design/context-first-multi-source-architecture.md)

### Phase A：工程清理与重构准备（v0.3.0 → v0.4.0 存档）— 预计 5-8 天

> **目标**：在当前 v0.3.0 基础上做充分清理，产出 v0.4.0 存档版本，确保重构前的代码基线干净可回溯。

- [x] **A-1 废弃代码清理**（2-3 天）：清除 18/20 处 `@deprecated`，删除 EventJournal / ContextMaterializer / Legacy proxy handlers / BackendDescriptor / AcpConnectionManagerLike 等。剩余 2 处（ActivityRecorder + HookInput）属 Phase B 范畴
- [x] **A-2 无效依赖清理**（0.5 天）：移除 `@actant/mcp-server` 对 `@actant/domain` 和 `@actant/source` 的幽灵依赖
- [x] **A-3 @actant/core 内聚性梳理**（1-2 天）：删除 `@actant/domain` 和 `@actant/source` 冗余包，9 个子目录标注 Phase B 迁移归属
- [x] **A-4 测试补强与质量基线**（1-2 天）：#238/#239/#240 已修复并关闭，新增 dispose 竞态测试。Coverage baseline: **Stmts 52.31% | Branch 42.97% | Funcs 54.83% | Lines 53.45%**（1315 tests / 114 files）
- [x] **A-5 版本存档**（0.5 天）：全部 14 package 升至 `0.4.0`，打 tag `v0.4.0` 作为重构前最后存档

### Phase B：Context-First 架构实施（v0.4.0 → v0.5.0）— 已完成

> **目标**：在 v0.4.0 干净基线上实施 Context-First Multi-Source 架构重构。

- [x] **B-0 ContextManager 骨架**（1-2 天）：创建 `@actant/context` 包，实现 ContextSource 接口 + ContextManager + MCP Server
- [x] **B-1 DomainContextSource**（2-3 天）：包装现有 SkillManager/PromptManager 为 VFS 投影，External Agent 可浏览
- [x] **B-2 AgentTemplate/Manager 增量**（1-2 天）：原地扩展 rules + toolSchema + ContextManager MCP 注入 + Agent → Tool 回注
- [x] **B-3 UnrealProjectSource**（3-5 天）：大型游戏项目上下文投影为 VFS
- [x] **B-4 现有系统桥接**（3-5 天）：MCP Server / Hub / CLI 切换到 ContextManager 架构
- [x] **B-5 重命名与旧模块标记**（2-3 天）：`@actant/core` → `@actant/agent-runtime`，旧上下文路径模块（SessionContextInjector / CoreContextProvider / CanvasContextProvider / VfsContextProvider）标记 `@deprecated`，保留迁移期共存
- [x] **B-6 版本发布**（1 天）：全部 package 升至 `0.5.0`，打 tag `v0.5.0`

---

## Spec 清理状态（Phase A 准备工作）

> 全部 spec 文件已完成 Context-First 迁移预告标注（2026-03-18）。

| Spec 文件 | 修复内容 | 状态 |
|-----------|---------|------|
| `config-spec.md` | 修 typo + 补 `hostProfile` + Phase B 预告 | ✅ |
| `api-contracts.md` | 对齐错误码 + MockLauncher 标注 + Phase B 预告 | ✅ |
| `session-management.md` | RecordSystem 架构说明 | ✅ |
| `endurance-testing.md` | 对齐测试文件路径 + Phase B 预告 | ✅ |
| `vision.md` | 定位演进 + Context-First 方向 | ✅ |
| `agent-lifecycle.md` | custom 后端修正 + BackendDescriptor 迁移标注 | ✅ |
| `index.md` | 治理补充 + Phase B 影响清单 | ✅ |
| `communication-layer.md` | Phase B 包路径预告 | ✅ |

---

## 已完成里程碑

### Phase D-1 — Core Split: domain-context / source / context 三层拆分（2026-03-18）

> `@actant/agent-runtime` 拆分为 `@actant/domain-context`、`@actant/source` 三层包，ContextManager 升级为上下文全生命周期管理器。

- [x] D-1-0：`@actant/domain` → `@actant/domain-context`，搬入 domain managers / template / provider / permissions / version
- [x] D-1-1：创建 `@actant/source` 包（SourceManager + fetch 层 + SourceValidator）
- [x] D-1-2：升级 `@actant/context`，ContextManager 持有 SourceManager，新增 `syncSources()`
- [x] D-1-3：瘦身 `@actant/agent-runtime`，re-export 兼容层保持零 breaking change
- [x] D-1-4：全量验证 — 117 test files, 1320 tests all pass
- [x] D-1-5：更新 Roadmap 和文档

### Phase C — 迁移清理（2026-03-18）

> Phase B 标记的全部 @deprecated 模块已完成迁移和删除。

- [x] C-1：SessionContextInjector 删除 → AgentManager 内联 RulesContextProvider
- [x] C-2：CoreContextProvider 删除 → 由 template rules 替代
- [x] C-3：CanvasContextProvider 删除 → Canvas 不再注入
- [x] C-4：VfsContextProvider 删除 → ContextManager MCP Server 替代
- [x] C-5：ActivityRecorder → RecordSystem 全链路迁移
- [x] C-6：HookInput → HookEventBusInput 直接监听 HookEventBus

### v0.5.0 — Phase B Context-First 架构实施（2026-03-18）

> Phase B 全部完成。在 v0.4.0 干净基线上实施 Context-First Multi-Source 架构重构。

- [x] B-0：创建 `@actant/context` 包，ContextSource + ContextManager + VfsMountTarget 接口
- [x] B-1：DomainContextSource 包装 SkillManager/PromptManager/McpConfigManager/WorkflowManager/TemplateRegistry
- [x] B-2：AgentTemplate 扩展 rules/toolSchema，RulesContextProvider 注入系统提示，AgentStatusSource 通过 ContextManager 接入 VFS，Agent→Tool 回注（process:start → registerTool / process:stop → unregisterTool）
- [x] B-3：ProjectSource 抽象基类 + UnrealProjectSource 扫描 UE 项目结构投影为 VFS
- [x] B-4：AppContext/HubContextService/MCP Server Standalone 三端桥接 ContextManager
- [x] B-5：`@actant/core` → `@actant/agent-runtime` 全局重命名 + 旧上下文模块标记 @deprecated（SessionContextInjector / CoreContextProvider / CanvasContextProvider / VfsContextProvider）
- [x] B-6：全部 15 package 升至 0.5.0

### v0.4.0 — Phase A 工程清理与重构准备（2026-03-18）

> Phase A 全部完成。在 v0.3.0 基础上执行了全面工程清理，产出干净的重构基线。

- [x] A-1：清除 18/20 处 @deprecated（EventJournal / ContextMaterializer / proxy handlers / BackendDescriptor / AcpConnectionManagerLike 等）
- [x] A-2：移除 mcp-server 幽灵依赖
- [x] A-3：删除 `@actant/domain` 和 `@actant/source` 冗余包，9 个子目录标注 Phase B 迁移归属
- [x] A-4：修复并关闭 #238/#239/#240，Coverage baseline: Stmts 52.31% | Branch 42.97% | Funcs 54.83% | Lines 53.45%（1315 tests / 114 files）
- [x] A-5：全部 14 package 升至 0.4.0

### v0.3.0 — CLI-first 自举宿主与 Hub 收口（2026-03-17）

> #296/#297 完成。以正式安装的 `actant` CLI 为第一控制面，`actant hub` 为官方入口。

- [x] 从 `@actant/core` 提取 project-context packages
- [x] 固化 `actant hub` / `acthub` 命名空间
- [x] 定义 `bootstrap` / `runtime` / `autonomous` 三层 profile
- [x] 默认不实例化 AgentService / Scheduler / 平台级 Kernel Agents
- [x] MCP 重定位为消费层入口
- [x] Build / type-check / lint / test 与 CLI 黑盒回归全通过

### v0.2.x — Phase 1-3 全量完成（2026-02）

| Phase | 核心成果 | 测试规模 |
|-------|---------|---------|
| **Phase 1: Foundation** | ProcessWatcher、LaunchMode 分化（direct/acp-bg/acp-svc/one-shot）、external spawn (resolve/attach/detach)、崩溃恢复（指数退避）、CliPrinter | 56 tests |
| **Phase 2: MVP** | Domain Context 全链路物化、组件加载 CLI、AgentCommunicator (pipe + ACP)、CLI chat/run、端到端模板示例 | 313 tests |
| **Phase 3: 通信/管理/构造/调度** | ACP Proxy + Session Lease、统一组件 CRUD (BaseComponentManager)、WorkspaceBuilder Pipeline (Cursor/ClaudeCode)、EmployeeScheduler + TaskQueue | 538 tests |

### Phase 4 部分成果（2026-02 ~ 03）

| 成果 | 说明 |
|------|------|
| Hook 事件体系 | Hook 三层架构 + EventBus + HookCategoryRegistry |
| Dashboard v2 | React SPA + REST API + SSE + Canvas |
| VFS Registry | #248 统一虚拟文件系统 + 挂载点管理 |
| 内置 MCP Server | VFS + RPC 网关架构，固定 6 工具 |
| Agent open + Pi 后端 | #134 前台 TUI + Pi backend integration |
| 耐久测试 | 5 个 endurance test 文件覆盖 lifecycle/RPC/ACP/REST/scheduler |

---

## 后续优先

按依赖关系与平台价值排序。**Phase A/B 已完成**，后续从 C 部分开始。

### A. Phase A — 工程清理与 v0.4.0 存档（✅ 已完成）

详见 [设计文档 §Phase A](../design/context-first-multi-source-architecture.md)。

| 顺序 | 子阶段 | 类型 | 预计 | 说明 |
|------|--------|------|------|------|
| 1 | A-1 废弃代码清理 | cleanup | 2-3 天 | 17 处 @deprecated 清零 |
| 2 | A-2 无效依赖清理 | cleanup | 0.5 天 | mcp-server 幽灵依赖 |
| 3 | A-3 core 内聚性梳理 | refactor | 1-2 天 | 消除跨包重复 + 标注迁移归属 |
| 4 | A-4 测试补强 | quality | 1-2 天 | 集成测试 + bug fix + coverage baseline |
| 5 | A-5 版本存档 | release | 0.5 天 | v0.4.0 tag |

### B. Phase B — Context-First 架构实施（✅ 已完成）

详见 [设计文档 §Phase B](../design/context-first-multi-source-architecture.md)。v0.5.0 已发布。

### C. Phase C — 迁移清理（✅ 已完成）

> Phase B 中标记为 `@deprecated` 的旧模块已全部迁移删除。

- [x] **C-1** SessionContextInjector 删除 → AgentManager 内联 RulesContextProvider，ContextProvider 接口保留给插件系统
- [x] **C-2** CoreContextProvider 删除 → 由 rules 字段 + RulesContextProvider 替代
- [x] **C-3** CanvasContextProvider 删除 → Canvas 不再注入，RPC 通道保留
- [x] **C-4** VfsContextProvider 删除 → Agent 通过 ContextManager MCP Server 访问 VFS
- [x] **C-5** ActivityRecorder → RecordSystem → ACP 包录制层已迁移到 RecordSystem
- [x] **C-6** HookInput → HookEventBusInput → EmployeeScheduler 直接监听 HookEventBus

### D-1. Phase D-1 — Core Split: domain-context / source / context 三层拆分（进行中）

> **目标**：将 `@actant/agent-runtime` 的职责按 domain-context / source / context 三层拆分，使 ContextManager 成为上下文全生命周期管理器。
> **关联 Issue**：#296（core 拆分评估）、#302（CRLF 修复）、#303（spec 文档同步）

- [x] **D-1-0** 重命名 `@actant/domain` → `@actant/domain-context`，搬入 domain managers / template / provider / permissions / version
- [x] **D-1-1** 创建 `@actant/source` 包，搬入 SourceManager + fetch 层 + SourceValidator（注入模式解耦 StepRegistry）
- [x] **D-1-2** 升级 `@actant/context`，ContextManager 持有 SourceManager，新增 `syncSources()` 能力
- [x] **D-1-3** 瘦身 `@actant/agent-runtime`，删除已搬出模块源码，保留 re-export 兼容层
- [x] **D-1-4** 全量验证：build / type-check / test (1320 tests) / lint — 全部通过
- [x] **D-1-5** 更新 Roadmap 和 Spec 文档

**包依赖图**（新架构）：
```
@actant/shared          ← 纯类型 + 工具
@actant/domain-context  ← Schemas + Managers + Registry + Provider + Permissions + Version
@actant/source          ← SourceManager + Fetch 层 + SourceValidator
@actant/vfs             ← 虚拟文件系统
@actant/context         ← ContextManager + ContextSources + Tool Registry + syncSources
@actant/agent-runtime   ← AgentInitializer + WorkspaceBuilder + Scheduler + Hooks + State + re-export 兼容层
```

### D-2. 架构重构后独立项

> 不受 Context-First 阻塞，或在 Phase B 完成后重新评估。

| 顺序 | Issue | 标题 | 状态 | 说明 |
|------|-------|------|------|------|
| 13 | #14 | Actant 系统级 Plugin 体系 | Phase B 后评估 | 在 ContextManager 架构上重新设计 |
| 14 | #122 | 调度器四模式增强 | 不受影响 | 已完成主链，剩 plugin wiring |
| 15 | #136 | Agent-to-Agent Email 通信 | 不受影响 | 异步协作范式 |
| 16 | #40 | Agent 工具权限管理 | 不受影响 | 平台安全边界 |
| 17 | #8 | Template hot-reload | 不受影响 | DX 增强 |
| 18 | #9 | Agent 进程日志收集 | 不受影响 | 可观测性 |

### E. Pi Mono 简洁哲学吸收（#291）

> 通过与 [Pi Mono](https://github.com/badlogic/pi-mono) 的架构对比识别的优化方向。Phase B 完成后按优先级继续推进。

| 优先级 | Issue | 标题 | 状态 |
|--------|-------|------|------|
| P0 | #280 | ACP-EX Steering/Follow-up mid-turn messaging | open |
| P1 | #281 | ACP-EX Session Branching and Fork | open |
| P1 | #282 | ACP-EX Context Compaction | open |
| P2 | #283 | ACP-EX Tool Hooks | open |
| P2 | #284 | ACP-EX Design Principles | open |
| P2 | #285 | Evaluate @actant/core package split | **被 Phase B 取代** |
| P2 | #286 | AgentManager slim-down | open |
| P2 | #288 | Subsystem hot-pluggable architecture | open |
| P2 | #289 | Platform Session vs Backend Session | open |
| P3 | #287 | Agent App registration-based API | open |
| P3 | #290 | CLI command layering | open |

### F. 长期方向

| 顺序 | Issue | 标题 | 说明 |
|------|-------|------|------|
| 19 | #10 | Instance Memory Layer | 实例级长期记忆 |
| 20 | #11 | Memory Consolidation + Shared | 跨实例记忆整合 |
| 21 | #12 | Context Layers + ContextBroker | 可能合并入 ContextManager |
| 22 | #20 | OpenViking MCP Server | 可选 MCP 集成 |
| 23 | #17 | ACP-Fleet 扩展协议 | Daemon → ACP Server |

---

## 被 Phase B 取代/合并的旧项

| 原项 | 处理方式 |
|------|---------|
| #279 统一通信层 | Phase B-4 桥接阶段处理通信层适配 |
| #285 core 拆分评估 | Phase B-5 重命名 + Phase D-1 三层拆分完成 |
| #14 Plugin 体系 | Phase B 后在 ContextManager 架构上重新设计 |
| #133 env provider | 核心已完成，仅剩文档同步 |

---

## 耐久测试覆盖

> 详见 `spec/endurance-testing.md`。

| Phase | 状态 | 文件 |
|-------|------|------|
| Phase 1 (lifecycle) | ✅ 10 场景 | `agent-manager.endurance.test.ts` |
| Phase 2 (RPC) | ✅ | `rpc-transport.endurance.test.ts` |
| Phase 2 (ACP) | ✅ | `gateway-lifecycle.endurance.test.ts` |
| Phase 2 (REST) | ✅ | `rpc-bridge.endurance.test.ts` |
| Phase 4 (scheduler) | ✅ | `scheduler.endurance.test.ts` |
| Phase 4+ (plugin/email/memory) | ⏳ 待建 | — |

---

## 已完成 Issue 索引

| Issue | 标题 | 完成日期 | 所属阶段 |
|-------|------|---------|---------|
| #22 | ProcessWatcher | 2026-02-20 | Phase 1 |
| #23 | LaunchMode 行为分化 | 2026-02-20 | Phase 1 |
| #24 | one-shot 模式 | 2026-02-20 | Phase 1 |
| #25 | acp-service 崩溃重启 | 2026-02-20 | Phase 1 |
| #26 | resolve/attach/detach | 2026-02-20 | Phase 1 |
| #5 | CLI 测试覆盖 | 2026-02-20 | Phase 1 质量 |
| #6 | CliPrinter 结构化输出 | 2026-02-20 | Phase 1 质量 |
| #21 | 配置结构文档化 | 2026-02-20 | Phase 1 准备 |
| #19 | Real Agent Launcher | 2026-02-20 | Phase 1 准备 |
| #112 | Domain Context 全链路 | 2026-02-20 | Phase 2 |
| #113 | 组件加载与 CLI | 2026-02-20 | Phase 2 |
| #13 | Daemon ↔ Agent 通信 | 2026-02-20 | Phase 2 |
| #114 | CLI chat/run | 2026-02-20 | Phase 2 |
| #115 | 端到端集成 | 2026-02-20 | Phase 2 |
| #15 | ACP Proxy 基础版 | 2026-02-20 | Phase 3 |
| #18 | Proxy + Chat 双模式 | 2026-02-20 | Phase 3 |
| #94 | BaseComponentManager CRUD | 2026-02-21 | Phase 3a |
| #97 | PluginManager + Schema | 2026-02-21 | Phase 3a |
| #98 | RPC/CLI 命令扩展 | 2026-02-21 | Phase 3a |
| #99 | BackendBuilder 差异化 | 2026-02-21 | Phase 3b |
| #100 | WorkspaceBuilder Pipeline | 2026-02-21 | Phase 3b |
| #101 | TaskQueue + Dispatcher | 2026-02-21 | Phase 3c |
| #102 | InputRouter + Sources | 2026-02-21 | Phase 3c |
| #103 | EmployeeScheduler | 2026-02-22 | Phase 3c |
| #134 | agent open + interactionModes | 2026-03 | Phase 4 |
| #296 | project-context packages 提取 | 2026-03-17 | Phase 4 |
| #297 | CLI-first Hub 收口 | 2026-03-17 | Phase 4 |

---

## 技术债务与风险

| 风险项 | 影响 | 缓解措施 |
|--------|------|---------|
| ContextManager 边界模糊 | 架构退化为新的 god object | 判定标准：ContextManager 不知道 Agent 是什么，所有接口 agent-agnostic |
| VFS 运行时开销 | Internal Agent 性能 | VFS 读取为内存操作；LLM 思考时间远大于 VFS 延迟；可在 ContextManager 层缓存 |
| 大型 UE 项目扫描延迟 | B-3 可用性 | 渐进式加载 + 缓存 + 按需投影 |
| ACP 协议标准演进 | 通信层兼容性 | ActantChannel 自有协议层隔离，ACP 仅作外部适配器 |
| ~~新旧上下文路径共存~~ | ~~迁移期维护成本~~ | ✅ Phase C 已完成，全部 @deprecated 已清除 |
| ~~ActivityRecorder 深耦合 ACP~~ | ~~C-5 清理复杂度~~ | ✅ 已迁移到 RecordSystem |

---

## 维护说明

- **当前进行中**：Phase D-1 Core Split 已完成，Phase D-2 独立项 + Phase E Pi Mono 吸收待推进。
- **Task 级 Todo**：随开发推进勾选 `[ ]` → `[x]`。
- **后续优先**：Phase D-2 独立项 → Phase E Pi Mono 吸收 → Phase F 长期方向。
- 新增/关闭 Issue 或完成 Task 后同步更新本表。
- **历史详情**：Phase 1-3 的详细 checklist 已归入 git 历史（v0.3.0 前的 roadmap 版本），如需查看可 `git log -- docs/planning/roadmap.md`。
