# 耐久测试规范 (Endurance Testing Specification)

> 耐久测试是 Actant 的**持续验证能力**——不是"跑得久的测试"，而是对系统在长期运行中正确性的结构化保障。
> 每个新功能**必须**同步扩展耐久覆盖。本文档定义覆盖矩阵、演进策略和维护规范。
> **若代码行为与本文档定义的覆盖目标不一致，优先更新耐久测试。**

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

### 2.1 维度定义

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

#### Phase 2: 通信与协议（待实现）

| 场景 ID | 场景名称 | 覆盖内容 | 关停行为 |
|---------|---------|---------|---------|
| `E-RPC` | RPC 高频通信 | 连续 RPC 调用，验证无连接泄漏、无状态漂移 | 正常关闭连接 |
| `E-ACP` | ACP Proxy 持续转发 | Proxy 长时间转发消息，验证 Agent 状态同步 | Proxy 断开后 Agent 状态正确 |
| `E-MCP` | Agent 间 MCP 通信 | Agent A 反复通过 MCP 委派任务给 Agent B | one-shot Agent 自动清理 |

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
    agent-manager.endurance.test.ts      ← Phase 1: 核心生命周期
  api/src/
    rpc-endurance.test.ts                ← Phase 2: RPC 通信（待建）
  acp/src/
    acp-proxy-endurance.test.ts          ← Phase 2: ACP Proxy（待建）
  core/src/plugin/
    plugin-host.endurance.test.ts        ← Phase 4: Plugin 生命周期（待建）
  core/src/scheduler/
    scheduler.endurance.test.ts          ← Phase 4: Scheduler 多输入源（待建）
  core/src/email/
    email-hub.endurance.test.ts          ← Phase 4: Email 投递（待建）
  agent-memory/store-<backend>/
    memory-store.endurance.test.ts       ← Phase 5: Memory 存储（待建，后端待定）
```

---

## 7. Phase 4 耐久测试场景 🚧

> 以下场景随 Phase 4 各 Step 逐步实施。

### E-PLUG — Plugin 生命周期稳定性

**目标**: 验证 PluginHost 在长时间运行中，多个 Plugin 的 tick 循环稳定、故障隔离有效。

| 维度 | 设计 |
|------|------|
| 操作 | 启动 PluginHost（3 个 Plugin），反复触发 tick 循环 |
| 注入故障 | 随机让某 Plugin tick 抛异常 / 超时 |
| 不变量 | (1) 单 Plugin 异常不影响其他 Plugin 的 tick (2) consecutiveFailures 计数准确 (3) 无内存泄漏 (4) stop/dispose 全部幂等 |
| 统计 | tick 总次数、隔离成功次数、平均 tick 延迟 |

### E-SCHED — Scheduler 多输入源压力

**目标**: 验证 EmployeeScheduler 在 Heartbeat + Cron + DelayInput + EmailInput 同时运行时的正确性。

| 维度 | 设计 |
|------|------|
| 操作 | 同时注册 4 种 InputSource，高频产生任务 |
| 不变量 | (1) TaskQueue 不丢任务 (2) 任务按优先级排序 (3) InputRouter 分发无竞态 (4) cancel 后输入源停止 |
| 统计 | 任务入队总数、处理总数、最大队列深度、平均调度延迟 |

### E-EMAIL — Email 投递可靠性

**目标**: 验证 EmailHub 在大量并发 send/reply 下的消息投递可靠性。

| 维度 | 设计 |
|------|------|
| 操作 | N 个 Agent 互相发送 Email，混合在线/离线状态 |
| 不变量 | (1) 消息不丢失（sent = delivered + pending） (2) 线程归组正确 (3) 持久化与内存状态一致 |
| 统计 | 消息总数、投递成功率、离线队列峰值、平均投递延迟 |

### E-MEM — Memory 存储稳定性

**目标**: 验证 MemoryStore 实现在大量 recall/navigate/browse 下的稳定性和正确性。（存储后端待定）

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
