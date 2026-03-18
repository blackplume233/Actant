# 耐久测试规范 (Endurance Testing Specification)

> 耐久测试是 Actant 的**持续验证能力**——不是"跑得久的测试"，而是对系统在长期运行中正确性的结构化保障。
> 每个新功能**必须**同步扩展耐久覆盖。本文档定义覆盖矩阵、演进策略和维护规范。
> **若代码行为与本文档定义的覆盖目标不一致，优先更新耐久测试。**

> **实现状态**：**Phase 1（生命周期场景）已实现**；**Phase 2（RPC、ACP Gateway、REST Bridge）部分实现**；Phase 2（MCP）及 Phase 3+ 为计划扩展，标注为"待实现"。

---

## 1. 定位与三层测试体系

| 层级 | 文件约定 | 执行命令 | CI 频率 | 验证目标 |
|------|---------|---------|---------|---------|
| **单元测试** | `*.test.ts` | `pnpm test` | 每次提交 | 单步操作正确性 |
| **场景测试** | `*-scenarios.test.ts` | `pnpm test` | 每次提交 | 多步工作流状态机正确性 |
| **耐久测试** | `*.endurance.test.ts` | `pnpm test:endurance` | 按需 / 发版前 | 长时间运行下的状态一致性、资源稳定性 |

**关键区别**：场景测试验证"单次走完一个流程是否正确"；耐久测试验证"反复走同一个流程 N 次、持续 M 分钟后是否依然正确"。

---

## 2. 覆盖矩阵

### 2.1 Archetype-oriented baseline

在进入具体场景前，耐久测试应先按 archetype 建立基线理解。`repo -> service -> employee` 是平台管理深度递进模型，因此验证组织也应以此为总入口：

| Archetype | 平台定位 | 当前验证重点 | 基线期望 |
|-----------|---------|-------------|---------|
| `repo` | 工作区承载层 | materialize / state / open-oriented compatibility | 能稳定创建、保持 workspace 一致，不要求自治运行 |
| `service` | 当前主交付形态 | lifecycle / session / keepAlive / prompt API | 能稳定被动响应、持续运行、恢复会话与进程 |
| `employee` | 自治增强层 | scheduler / hook / conversation continuity / long-running autonomy | 在 service 基线之上增加持续调度与自治能力 |

> 解释：`service` 是当前产品与集成默认承载面，因此未来多数 runtime endurance 场景应先以 `service baseline` 建立，再判断哪些能力只属于 `employee` 增强层。`repo` 仍需要 baseline，但更多承担 workspace 与构造稳定性的验证入口。
>
> **#278 Slice 3 对应关系**：
> - C-08：已通过 archetype-oriented baseline 固定 `repo / service / employee` 验收主线，后续新增 endurance 资产不得只按 phase/feature 自由生长
> - C-02：通过把 `service` 明确为默认 runtime baseline，避免验证体系继续滑向 employee-first
> - C-05：通过将 workspace/materialize、runtime/session、autonomy/scheduler 分别映射到 repo / service / employee，明确 template 层与 platform runtime 层的验证边界

### 2.2 维度定义

耐久测试覆盖由两个正交维度组成：

- **场景维度** — 对应 `agent-lifecycle.md` 中定义的使用模式
- **验证维度** — 每个场景下必须检查的不变量

### 2.2 场景覆盖（随 Phase 演进扩展）

#### Phase 1: 核心运行时

| 场景 ID | 场景名称 | 覆盖内容 | 关停行为 |
|---------|---------|---------|---------|
| `E-LIFE` | 完整生命周期循环 | create → start → stop → start → stop → destroy，反复 | 显式 stop + destroy |
| `E-SVC` | acp-service 连续崩溃重启 | 随机崩溃 → 自动重启 → 退避 → 恢复 → 重置计数器 | 崩溃后自动重启；超限后 error |
| `E-SHOT` | one-shot 执行与清理 | 创建 → 运行 → 完成 → ephemeral 清理，反复 | 进程退出后自动销毁 |
| `E-EXT` | 外部 Spawn 完整流程 | resolve → attach → crash/detach → cleanup，交替 ephemeral/persistent | 由调用方 detach 决定 |
| `E-DAEMON` | Daemon 重启恢复 | Daemon 反复崩溃重启，验证 acp-service 恢复、direct 不恢复 | Daemon dispose → 新 Daemon 恢复 |
| `E-MIX` | 混合并发操作 | 多 Agent、多模式、随机 create/start/stop/crash/destroy | 各模式各自关停逻辑 |

#### Phase 2: 通信与协议（部分实现）

| 场景 ID | 场景名称 | 覆盖内容 | 关停行为 |
|---------|---------|---------|---------|
| `E-RPC` | RPC 高频通信 | 连续 RPC 调用，验证无连接泄漏、无状态漂移 | 正常关闭连接 |
| `E-RPC-CHURN` | RPC 连接抖动 | 请求/回复循环，连接反复建立/断开 | 正常关闭 |
| `E-RPC-DROP` | RPC 中途断开 | 请求进行中连接断开 | 抛出错误，无泄漏 |
| `E-RPC-TIMEOUT` | RPC 超时负载 | 服务端不响应，验证超时行为 | 超时抛出 |
| `E-ACP` | ACP Proxy 持续转发 | Proxy 长时间转发消息，验证 Agent 状态同步；**必须包含空闲期存活验证**（见注） | Proxy 断开后 Agent 状态正确 |
| `E-ACP-RECONNECT` | ACP Gateway 重连 | 反复 connect/disconnect，验证 terminal 清理 | disconnectUpstream 清理 |
| `E-ACP-DISCONNECT` | ACP 显式断开 | 每次连接后显式 disconnectUpstream | 无资源泄漏 |
| `E-ACP-LEAK` | ACP 资源泄漏检测 | N 次循环后验证 handle/listener 无累积 | 无泄漏 |
| `E-BRIDGE-UNAVAIL` | REST Bridge 不可用 | daemon 不可达时 ping 行为 | 返回 false |
| `E-BRIDGE-TIMEOUT` | REST Bridge 超时 | 服务端不响应时的超时 | 抛出错误 |
| `E-BRIDGE-DEGRADED` | REST Bridge 降级 | 服务端中途关闭连接 | 抛出错误 |
| `E-MCP` | Agent 间 MCP 通信 | Agent A 反复通过 MCP 委派任务给 Agent B | one-shot Agent 自动清理 |

> **`E-ACP` 实现注意**：测试中必须包含 >10s 的空闲窗口（两次 prompt 之间无活动），并验证 acp-background Agent 子进程在此期间保持存活（`INV-ALIVE`）。这覆盖了 Windows Named Pipe 空闲退出 bug 的回归。详见 `guides/cross-platform-guide.md §Windows Named Pipe Idle Exit`。

#### Phase 3+: 扩展体系（待实现）

| 场景 ID | 场景名称 | 覆盖内容 |
|---------|---------|---------|
| `E-PLUG` | 插件加载/卸载循环 | 反复加载和卸载插件，验证无状态泄漏 |
| `E-MEM` | 记忆系统持久性 | 长时间写入/读取记忆，验证一致性 |

### 2.3 验证不变量

每个耐久测试在循环结束后**必须**检查以下不变量（适用的子集）：

| 不变量 ID | 名称 | 检查内容 |
|-----------|------|---------|
| `INV-DISK` | 磁盘/缓存一致 | `readInstanceMeta(disk)` 的 status 与 `manager.getAgent()` 的 status 一致 |
| `INV-CLEAN` | 资源清理完整 | 已销毁的 Agent 不存在于磁盘、缓存、watcher 中 |
| `INV-STATUS` | 状态值合法 | 所有 Agent 的 status 属于定义的有效值集合 |
| `INV-COUNT` | 缓存计数准确 | `manager.size` 等于实际存活 Agent 数量 |
| `INV-PID` | PID 无残留 | stopped/error/created 状态的 Agent 没有 PID |
| `INV-OWNER` | 所有权正确 | external 进程 detach 后 ownership 重置为 managed |
| `INV-CONV` | 对话记录不碎片化 | employee Agent 历次重启后 `conversationId` 保持不变，activity 目录中只有一个 `.jsonl` 文件，不随重启产生新文件 |
| `INV-ALIVE` | ACP 子进程保活 | acp-background Agent 在两次 prompt 之间的空闲期（>5s）不自动退出；Windows 上依赖 keepalive 机制（`AcpConnection.startKeepalive`）|

---

## 3. 关停策略矩阵

每种 LaunchMode 的关停行为必须在耐久测试中持续验证：

| LaunchMode | 正常关停 | 进程崩溃 | 超限崩溃 | Daemon 重启 |
|------------|---------|---------|---------|------------|
| `direct` | stop → stopped | watcher 检测 → stopped | — | 恢复为 stopped（不自动重启） |
| `acp-background` | stop → stopped | watcher 检测 → stopped | — | 恢复为 stopped |
| `acp-service` | stop → stopped | watcher → restart (退避) | → error | 恢复为 running（自动重启） |
| `one-shot` | 进程退出 → auto-destroy | 进程退出 → auto-destroy | — | 恢复为 stopped |
| External attach | detach → stopped | watcher → crashed | — | — |

---

## 4. 演进规范

### 4.1 新功能 → 耐久覆盖联动

每当引入影响以下维度的新功能时，**必须**同步扩展耐久测试：

| 影响维度 | 需要新增/修改的耐久场景 |
|---------|---------------------|
| 新的 LaunchMode 或修改现有模式语义 | 新增专属关停行为场景 + 更新 `E-MIX` |
| 新的通信协议/通道（ACP/MCP/RPC） | 新增持续通信场景 |
| 状态机新增转换路径 | 更新受影响的场景 + `INV-STATUS` |
| 新的 ProcessOwnership 模式 | 新增 attach/detach 循环场景 |
| 插件/扩展系统 | 新增加载/卸载循环场景 |
| 持久化存储变更 | 更新 `INV-DISK` 检查 |
| **对话 ID / 活动记录逻辑变更** | 更新 `INV-CONV`：验证 employee conversationId 跨重启不变，activity 目录无碎片文件 |
| **ACP 子进程保活机制变更** | 更新 `INV-ALIVE`：验证 acp-background 在空闲期（>10s）不退出，Windows 上 keepalive 写入可观测 |

### 4.2 维护清单

在开发工作流（workflow.md）的 Code Quality Checklist 中新增：

```
耐久测试同步（功能变更时必选）:
- [ ] 新增/修改的功能是否影响覆盖矩阵中的场景？
- [ ] 已有耐久测试是否因接口变更需要适配？
- [ ] 新场景的不变量检查是否完整？
- [ ] `pnpm test:endurance` 在 ENDURANCE_DURATION_MS=5000 下通过？
```

### 4.3 版本号标记

耐久测试文件顶部注释标注当前覆盖的 Phase：

```typescript
/**
 * Endurance coverage: Phase 1 (lifecycle, crash-restart, ext-spawn)
 * Next expansion: Phase 2 (RPC, ACP Proxy, MCP communication)
 */
```

---

## 5. 执行策略

### 5.1 命令

```bash
# 默认 30 秒/测试（CI 快速验证）
pnpm test:endurance

# 开发中快速回归
ENDURANCE_DURATION_MS=5000 pnpm test:endurance

# 发版前完整验证（10 分钟/测试）
ENDURANCE_DURATION_MS=600000 pnpm test:endurance

# 深度浸泡测试（1 小时）
ENDURANCE_DURATION_MS=3600000 pnpm test:endurance
```

### 5.2 何时执行

| 触发条件 | 建议时长 | 必须/建议 |
|---------|---------|---------|
| 功能开发完成提交前 | 5s 快速回归 | **必须** |
| Phase 里程碑完成 | 10 分钟 | **必须** |
| 发版前 | 30-60 分钟 | **必须** |
| 修改核心状态管理代码 | 5-10 分钟 | **建议** |
| CI nightly | 10 分钟 | **建议** |

### 5.3 统计输出

每个耐久测试结束后**必须**输出统计摘要，格式：

```
[endurance] <场景名>: <操作计数> in <elapsed>ms
```

用于跟踪吞吐量趋势——如果同样时长内操作次数显著下降，可能存在性能退化。

---

## 6. 文件结构

```
packages/
  core/src/manager/
    agent-manager.endurance.test.ts      ← Phase 1: 核心生命周期 ✅
  shared/src/rpc/__tests__/
    rpc-transport.endurance.test.ts      ← Phase 2: RPC 传输 ✅
  acp/src/__tests__/
    gateway-lifecycle.endurance.test.ts  ← Phase 2: ACP Gateway ✅
  rest-api/src/__tests__/
    rpc-bridge.endurance.test.ts         ← Phase 2: REST RPC Bridge ✅
  core/src/scheduler/
    scheduler.endurance.test.ts          ← Phase 4: Scheduler 多输入源 ✅
  api/src/
    rpc-endurance.test.ts                ← Phase 2: RPC 通信（待建）
  core/src/plugin/
    plugin-host.endurance.test.ts        ← Phase 4: Plugin 生命周期（待建）
  core/src/email/
    email-hub.endurance.test.ts          ← Phase 4: Email 投递（待建）
  agent-memory/store-<backend>/
    memory-store.endurance.test.ts       ← Phase 5: Memory 存储（待建，后端待定）
```

> **⚠️ Phase B 迁移预告**：Context-First 重构后，`packages/core/` 下的测试文件将随包拆分迁移到 `packages/agent-runtime/` 或 `packages/context/`。迁移时须同步更新上表路径。

---

## 7. Phase 4 耐久测试场景 🚧

> 以下场景随 Phase 4 各 Step 逐步实施。
> 组织原则：先满足 `repo / service / employee` baseline，再在对应 baseline 上叠加平台能力验证。换言之，`E-PLUG`、`E-SCHED`、`E-EMAIL`、`E-MEM` 都不应脱离 archetype baseline 单独设计。

### E-PLUG — Plugin 生命周期稳定性

**目标**: 验证平台插件能力在长时间运行中稳定，且明确区分 service baseline 与 employee enhancement。对于未来 actant-side PluginHost，应验证其不会与现有 agent-side plugin definition 语义混淆。

| 维度 | 设计 |
|------|------|
| 操作 | 启动 PluginHost（3 个 Plugin），反复触发 tick 循环 |
| 注入故障 | 随机让某 Plugin tick 抛异常 / 超时 |
| 不变量 | (1) 单 Plugin 异常不影响其他 Plugin 的 tick (2) consecutiveFailures 计数准确 (3) 无内存泄漏 (4) stop/dispose 全部幂等 |
| 统计 | tick 总次数、隔离成功次数、平均 tick 延迟 |

### E-HEART — Heartbeat `.heartbeat` 文件演进

**目标**: 验证 HeartbeatInput 在连续多次心跳后，`.heartbeat` 文件被 Agent 正确读取和更新，内容持续演进。

| 维度 | 设计 |
|------|------|
| 操作 | 创建 Employee Agent（10s 心跳），连续运行 ≥10 次心跳，收集 `.heartbeat` 文件快照 |
| 不变量 | (1) `.heartbeat` 文件由 `seedHeartbeatFile()` 正确创建 (2) 每次心跳的 prompt 为 `DEFAULT_HEARTBEAT_PROMPT`（不含用户 prompt） (3) `.heartbeat` 文件内容在多次心跳后有变化（Agent 实际写回） (4) 种子内容不覆盖已有文件 |
| 统计 | 心跳总次数、LLM 成功调用次数、`.heartbeat` 文件更新次数、平均心跳耗时 |

> **经验教训（2026-02-27 QA）**：首次 E2E 测试需确保 Pi 后端的 `baseUrl` 正确透传，否则所有心跳会静默返回空结果（任务状态仍为 "completed"）。建议验证首次心跳的 LLM 响应非空后再开始计数。

### E-SCHED — Scheduler 多输入源压力

**目标**: 验证 EmployeeScheduler 在 Heartbeat + Cron + DelayInput + EmailInput 同时运行时的正确性。该场景属于 `employee baseline` 之上的增强验证，不应用来替代 `service` 的基础 runtime endurance。

> **#122 当前进度**：`DelayInput` 与通过 MCP / RPC 动态注册的 schedule source 已具备实现基线；在此基础上，E-SCHED 后续应至少覆盖 `schedule.wait` / `schedule.cron` / `schedule.cancel` 产生的动态 source 生命周期与取消语义。

| 维度 | 设计 |
|------|------|
| 操作 | 同时注册 4 种 InputSource，高频产生任务 |
| 不变量 | (1) TaskQueue 不丢任务 (2) 任务按优先级排序 (3) InputRouter 分发无竞态 (4) cancel 后输入源停止 |
| 统计 | 任务入队总数、处理总数、最大队列深度、平均调度延迟 |

### E-EMAIL — Email 投递可靠性

**目标**: 验证 EmailHub 在大量并发 send/reply 下的消息投递可靠性，并明确其作为平台 capability 可被 service / employee 消费，但自治投递与输入路由主要在 employee enhancement 层验证。

| 维度 | 设计 |
|------|------|
| 操作 | N 个 Agent 互相发送 Email，混合在线/离线状态 |
| 不变量 | (1) 消息不丢失（sent = delivered + pending） (2) 线程归组正确 (3) 持久化与内存状态一致 |
| 统计 | 消息总数、投递成功率、离线队列峰值、平均投递延迟 |

### E-MEM — Memory 存储稳定性

**目标**: 验证 MemoryStore 实现在大量 recall/navigate/browse 下的稳定性和正确性。（存储后端待定）Memory 是平台 capability，应先确认 service baseline 下的可用性，再验证 employee / autonomous flows 中的持续使用表现。

| 维度 | 设计 |
|------|------|
| 操作 | 批量写入 MemoryRecord，并发执行 recall/navigate/browse |
| 不变量 | (1) recall 返回结果的 score 单调递减 (2) navigate URI 精确匹配 (3) browse 结果集无遗漏 (4) SQL 参数化无注入 |
| 统计 | 写入条数、查询总次数、平均查询延迟、存储文件大小 |

### E-HOOK — 事件总线吞吐

**目标**: 验证 HookEventBus 在高频 emit 下的事件分发正确性和性能。

| 维度 | 设计 |
|------|------|
| 操作 | 注册 20+ Workflow hooks，高频 emit 混合事件 |
| 不变量 | (1) 每个匹配的 listener 都被调用 (2) listener 异常不影响其他 listener (3) 无事件丢失 |
| 统计 | emit 总次数、listener 调用总次数、平均分发延迟 |

---

## 变更约定

> 对本文档定义的覆盖矩阵、不变量或演进规范进行变更时，须同步更新对应的耐久测试代码，在同一次提交中完成。
