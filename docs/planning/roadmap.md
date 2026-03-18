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

## 当前最高优先：Context-First 架构重构

> **设计文档**：[context-first-multi-source-architecture.md](../design/context-first-multi-source-architecture.md)

### Phase A：工程清理与重构准备（v0.3.0 → v0.4.0 存档）— 预计 5-8 天

> **目标**：在当前 v0.3.0 基础上做充分清理，产出 v0.4.0 存档版本，确保重构前的代码基线干净可回溯。

- [ ] **A-1 废弃代码清理**（2-3 天）：清零全部 17 处 `@deprecated`，删除 EventJournal / ActivityRecorder / MockLauncher / ContextMaterializer / Legacy proxy handlers 等已被替代的代码
- [ ] **A-2 无效依赖清理**（0.5 天）：移除 `@actant/mcp-server` 对 `@actant/domain` 和 `@actant/source` 的未使用依赖
- [ ] **A-3 @actant/core 内聚性梳理**（1-2 天）：消除 core 内部 domain/source/vfs 子目录与独立包的重复定义，为每个子模块标注 Phase B 迁移归属
- [ ] **A-4 测试补强与质量基线**（1-2 天）：补充各 archetype 端到端集成测试，修复 #238/#239/#240 已知 bugs，记录 coverage baseline
- [ ] **A-5 版本存档**（0.5 天）：全部 package 升至 `0.4.0`，打 tag `v0.4.0` 作为重构前最后存档

### Phase B：Context-First 架构实施（v0.4.0 → v0.5.0）— 预计 12-20 天

> **目标**：在 v0.4.0 干净基线上实施 Context-First Multi-Source 架构重构。

- [ ] **B-0 ContextManager 骨架**（1-2 天）：创建 `@actant/context` 包，实现 ContextSource 接口 + ContextManager + MCP Server
- [ ] **B-1 DomainContextSource**（2-3 天）：包装现有 SkillManager/PromptManager 为 VFS 投影，External Agent 可浏览
- [ ] **B-2 AgentTemplate/Manager 增量**（1-2 天）：原地扩展 rules + toolSchema + ContextManager MCP 注入 + Agent → Tool 回注
- [ ] **B-3 UnrealProjectSource**（3-5 天）：大型游戏项目上下文投影为 VFS
- [ ] **B-4 现有系统桥接**（3-5 天）：MCP Server / Hub / CLI 切换到 ContextManager 架构
- [ ] **B-5 重命名与旧模块收缩**（2-3 天）：`@actant/core` → `@actant/agent-runtime`，删除被 ContextManager 替代的模块
- [ ] **B-6 版本发布**（1 天）：全部 package 升至 `0.5.0`，打 tag `v0.5.0`

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

按依赖关系与平台价值排序。**Phase A/B 为当前最高优先**。

### A. Phase A — 工程清理与 v0.4.0 存档（🔥 当前）

详见 [设计文档 §Phase A](../design/context-first-multi-source-architecture.md)。

| 顺序 | 子阶段 | 类型 | 预计 | 说明 |
|------|--------|------|------|------|
| 1 | A-1 废弃代码清理 | cleanup | 2-3 天 | 17 处 @deprecated 清零 |
| 2 | A-2 无效依赖清理 | cleanup | 0.5 天 | mcp-server 幽灵依赖 |
| 3 | A-3 core 内聚性梳理 | refactor | 1-2 天 | 消除跨包重复 + 标注迁移归属 |
| 4 | A-4 测试补强 | quality | 1-2 天 | 集成测试 + bug fix + coverage baseline |
| 5 | A-5 版本存档 | release | 0.5 天 | v0.4.0 tag |

### B. Phase B — Context-First 架构实施

详见 [设计文档 §Phase B](../design/context-first-multi-source-architecture.md)。

| 顺序 | 子阶段 | 类型 | 预计 | 说明 |
|------|--------|------|------|------|
| 6 | B-0 ContextManager 骨架 | new pkg | 1-2 天 | `@actant/context`：ContextSource + ContextManager + MCP Server |
| 7 | B-1 DomainContextSource | feature | 2-3 天 | SkillManager/PromptManager → VFS 投影 |
| 8 | B-2 AgentTemplate 增量 | enhance | 1-2 天 | rules + toolSchema + ContextManager MCP 注入 + Agent→Tool 回注 |
| 9 | B-3 UnrealProjectSource | feature | 3-5 天 | 大型游戏项目上下文投影 |
| 10 | B-4 系统桥接 | migrate | 3-5 天 | MCP Server / Hub / CLI 切换 + 通信层适配 |
| 11 | B-5 重命名与模块收缩 | refactor | 2-3 天 | `@actant/core` → `@actant/agent-runtime` |
| 12 | B-6 版本发布 | release | 1 天 | v0.5.0 tag |

### C. 架构重构后独立项

> 不受 Context-First 阻塞，或在 Phase B 完成后重新评估。

| 顺序 | Issue | 标题 | 状态 | 说明 |
|------|-------|------|------|------|
| 13 | #14 | Actant 系统级 Plugin 体系 | Phase B 后评估 | 在 ContextManager 架构上重新设计 |
| 14 | #122 | 调度器四模式增强 | 不受影响 | 已完成主链，剩 plugin wiring |
| 15 | #136 | Agent-to-Agent Email 通信 | 不受影响 | 异步协作范式 |
| 16 | #40 | Agent 工具权限管理 | 不受影响 | 平台安全边界 |
| 17 | #8 | Template hot-reload | 不受影响 | DX 增强 |
| 18 | #9 | Agent 进程日志收集 | 不受影响 | 可观测性 |

### D. Pi Mono 简洁哲学吸收（#291）

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

### E. 长期方向

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
| #285 core 拆分评估 | Phase B-5 直接执行 `@actant/core` → `@actant/agent-runtime` |
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
| `@actant/core` 过度膨胀 | Phase B 迁移复杂度 | Phase A-3 先梳理内聚性，标注迁移归属 |
| ContextManager 边界模糊 | 架构退化为新的 god object | 判定标准：ContextManager 不知道 Agent 是什么，所有接口 agent-agnostic |
| VFS 运行时开销 | Internal Agent 性能 | VFS 读取为内存操作；LLM 思考时间远大于 VFS 延迟；可在 ContextManager 层缓存 |
| 大型 UE 项目扫描延迟 | B-3 可用性 | 渐进式加载 + 缓存 + 按需投影 |
| ACP 协议标准演进 | 通信层兼容性 | ActantChannel 自有协议层隔离，ACP 仅作外部适配器 |
| 旧 `BackendDescriptor` 残留 | Phase A 清理遗漏 | A-1 强制清零所有 @deprecated |

---

## 维护说明

- **当前进行中**：顶部 Phase A/B 的勾选清单即为实时状态。
- **Task 级 Todo**：随开发推进勾选 `[ ]` → `[x]`。
- **后续优先**：从 Issue 列表提炼，前 5 项为共识下一步。
- 新增/关闭 Issue 或完成 Task 后同步更新本表。
- **历史详情**：Phase 1-3 的详细 checklist 已归入 git 历史（v0.3.0 前的 roadmap 版本），如需查看可 `git log -- docs/planning/roadmap.md`。
