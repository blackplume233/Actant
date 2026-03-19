# Phase 4 计划：自治 Agent 平台 (Hook · Plugin · 强化 · 通信)

> 更新日期：2026-03-14
> 基于 `docs/planning/roadmap.md`、`docs/planning/phase4-employee-steps.md`、活跃 tasks 与当前代码现状同步更新
> 说明：本文件作为 Phase 4 的策略压缩版，详细步骤与依赖以 `docs/planning/phase4-employee-steps.md` 为准

---

## 一、Phase 4 现状评估

### 已落地基础（不是纯规划态）

| 项目 | 状态 | 备注 |
|------|------|------|
| Hook 类型基础 (#159) | ✅ 已完成 | HookEventName / HookDeclaration / HookAction 已定义并通过测试 |
| Bug 清理与脚本修复 (#129 / #95 / #57) | ✅ 已完成 | npm 发布、terminal stub、Windows workaround、CRLF 修复均已收口 |
| Dashboard v0/v1/v2 | ✅ 已完成（Plugin 面板待补） | 已是 React SPA + REST API + SSE + 事件流 |
| 动态上下文注入 + Canvas (#210 / #211) | ✅ 已完成 | SessionContextInjector、内置 MCP Server、Canvas 链路已打通 |
| Hook Package 基础 (#135) | ✅ 基础已完成 | Hook EventBus / HookRegistry / ActionRunner 已具备基础形态 |
| Pi 内置后端 (#121) | ✅ 已完成 | `@actant/pi` 已落地 |
| `agent open` + interactionModes (#134) | ✅ 已完成 | 前台 TUI 与交互模式已可用 |

### 已完成的近期稳定性收口

| Issue / 项目 | 状态 | 备注 |
|--------------|------|------|
| #117 `gateway.lease` RPC handler | ✅ 已完成 | Session Lease 基础可用 |
| #151 agent adopt 状态同步 | ✅ 已完成 | registry / manager cache 已修复 |
| #126 daemon.ping 版本号 | ✅ 已完成 | 已读取真实 package.json |
| #127 install.ps1 非交互挂起 | ✅ 已完成 | 增加非交互检测 |
| #129 包发布校验 | ✅ 已完成 | `@actant/*` 0.2.2 已发布 |
| #95 terminal stub | ✅ 已完成 | TerminalHandle 映射方案已落地 |
| #57 Windows daemon fork | ✅ 已关闭 | `--foreground` workaround 已文档化 |

### 当前主阻塞与未完成主线

| 优先级 | Issue / Task | 标题 | 说明 |
|--------|--------------|------|------|
| **P1** | #14 | Actant 系统级 Plugin 体系 | ✅ 核心底座已落地：ActantPlugin 六插口、PluginHost 生命周期、legacy adapter、HeartbeatPlugin、runtime status RPC/CLI 已实现；当前重点转向其上的能力闭环 |
| P2 | #122 | 调度器四模式增强 | 依赖 #14 + 已完成的 Context Injection / Scheduler 基础 |
| P1 | #37 | Extensible Initializer | 依赖运行时与插件集成收敛后价值最大 |
| P2 | #133 | 环境变量 provider 配置 | provider/env 注入标准化，提升 DX 与后端可用性 |
| P2 | #136 | Agent-to-Agent Email 通信 | 协作层能力，建议排在平台内核稳定之后 |
| P2 | `03-11-capability-backend-runtime` | Capability-driven backend runtime model | ✅ 已完成近期模型收口 |
| P2 | `03-11-issue276-daemon-socket-normalization` | Windows daemon socket normalization | ✅ 已完成近期稳定性补丁 |

> Phase 4 的默认产品承载面应以 `service` 为主，`employee` 作为自治增强层；这也是后续 Plugin / Scheduler / Initializer 收敛时的叙事基线。

### 与步骤文档的对应关系

`docs/planning/phase4-employee-steps.md` 目前是更接近真实执行状态的文档：
- 已完成：Step 1、2、3、3b、4（Plugin Core）、7、8、10，以及若干计划外基础能力
- 当前关键路径：Step 5 → Step 6 / 9 / 13 → Step 11 / 14
- v0.3.0 新增基础：ActantChannel、TUI、RecordSystem、VFS、ChannelPermissions

---

## 二、推进策略

### A. 近期：先完成治理收口

**目标**：在继续推进 Phase 4 runtime 实现前，先把 `#278` 暴露出来的平台叙事、概念边界、Spec 分层与验证入口收稳，避免后续实现继续建立在混合叙事上。

```text
#278 Slice 2
  <- 清理历史文档 / FAQ / design / wiki 中仍会误导当前主线的表述
  <- 逐条回看冲突项，至少覆盖 C-01 / C-02 / C-04 / C-05 / C-08

#278 Slice 3
  <- 收口验证与契约入口
  <- 固定 archetype-oriented validation / endurance framing
  <- 必要时补最小 api-contracts / index / issue 跟踪同步
```

这一步不是额外文档负担，而是 Phase 4 后续实现的前置治理层。完成后，`#14`、`#122`、`#37` 才会有稳定的一致语义基线。

### B. 近期：稳定化与模型收口

**目标**：先清掉会干扰 Phase 4 内核推进的建模与平台稳定性噪音。

```
1. 03-11-capability-backend-runtime
   ← 收口 backend/runtime capability model，明确能力抽象边界
   ← 用 `supportedModes + runtimeProfile + capabilities` 三层共同表达 backend runtime contract
   ← archetype compatibility / interactionModes / dashboard backend grouping 都应以该模型为准

2. 03-11-issue276-daemon-socket-normalization
   ← 修复 Windows daemon socket path / normalization 问题
   ← 统一 CLI / foreground daemon / AppContext / setup 对 `ACTANT_SOCKET` 的规范化入口
   ← 以 named pipe 实际路径为真相，兼容 `.sock` 风格 override 在 Windows 上的映射
```

这两项应视为近期收尾任务，而非新的产品主线。完成后应同步更新 roadmap / task / spec，避免“实现收口了但文档仍停留在 planning”。

### B. 近期：稳定化与模型收口

**目标**：先补齐统一插件底座，再在其上挂自治能力。

#### B1. #14 Plugin Core（当前第一优先）

```
#14 Actant 系统级 Plugin 体系
  ├── Plugin 接口与类型（ActantPlugin / PluginContext / PluginScope）
  ├── PluginHost 生命周期：init → start → tick → stop → dispose
  ├── actant / instance 双层 scope
  ├── domainContext / runtime / hooks 三插口分流
  ├── 旧 PluginDefinition 的 legacy adapter
  └── PluginHost 单元测试与基础可观测性
```

**原因**：`#14` 是当前 Phase 4 的真正平台底座。没有统一 PluginHost，调度增强、Initializer、MemoryPlugin 都只能继续分散实现，无法形成可扩展内核。

#### B2. #122 调度增强

```
#122 调度器四模式增强
  ├── DelayInput（一次性延迟触发）        ✅ 已实现
  ├── InputSourceRegistry（Plugin 注册自定义输入源） ✅ 已实现
  ├── MCP schedule tools                  ✅ 已实现
  │    ├── actant_schedule_wait
  │    ├── actant_schedule_cron
  │    └── actant_schedule_cancel
  └── E-SCHED 基础耐久测试               ✅ 已实现
```

**当前状态**：主链已完成，动态调度能力已经从模板静态 schedule 扩展到运行时注册/取消 source。后续若继续深化，重点应放在 plugin-to-registry wiring 与调度可观测性，而不是重新设计基础模型。

#### B3. #37 Extensible Initializer + #133 env provider

```
#37 Extensible Initializer
  ├── InitializerStepExecutor                     ✅ 已实现
  ├── git-clone / npm-install / exec / mkdir      ✅ 已实现
  ├── file-copy / file-template / write-file      ✅ 已实现
  ├── rollback / state sharing                    ✅ 已实现
  └── AgentInitializer 集成                       ✅ 已实现

#133 环境变量 provider 配置
  ├── env fallback                                ✅ 已实现
  ├── 后端感知注入                                ✅ 已实现
  ├── provider 配置标准化                         ✅ 已实现
  └── 文档与配置契约同步                          进行中
```

**当前状态**：`#37` 的运行时主链和测试覆盖已具备，已不再是阻塞实现问题；`#133` 的核心运行时行为也已收口，剩余工作主要是持续同步 planning/spec 与后续 DX 细节。

### C. 主线：平台底座优先

#### C1. #136 Agent-to-Agent Email

```
#136 Agent-to-Agent Email
  ├── EmailHub
  ├── EmailInput → TaskQueue
  ├── email.send / inbox / reply / threads RPC
  ├── CLI email 子命令
  └── E-EMAIL 基础耐久测试
```

**定位**：协作层能力。它和 Dashboard / REST API 会形成对外协作面，但不应早于平台内核稳定。

#### C2. 外置记忆系统（不计入当前 Phase 4 主线）

```
Memory / external memory component
  ├── 作为 Actant 外置组件或外部服务单独演进
  ├── 与当前 Phase 4 平台内核解耦
  ├── 后续如需接入，再通过稳定的 PluginHost / MCP / external integration surface 连接
  └── 不再作为当前 Phase 4 完成条件的一部分
```

**定位**：记忆系统改为外置组件方向，而不是当前 Phase 4 的内建收尾项。当前主线应集中在已完成能力的深度测试与平台稳定性验证。

### D. 中期：协作与平台补强

```
#40 权限体系          ← 平台安全边界
#8  hot-reload        ← DX 增强
#9  日志采集          ← 可观测性补强
#38 Endurance Agent   ← 与 #37 配合完善验证资产
```

---

## 三、推荐的推进顺序

按当前状态，推荐顺序不再是旧版的“先扫 Bug 再泛化做 Hook/Plugin”，而是以下闭环：

1. **治理收口**
   - `#278 Slice 2`
   - `#278 Slice 3`

2. **稳定化与模型收口**
   - `03-11-capability-backend-runtime`
   - `03-11-issue276-daemon-socket-normalization`

3. **平台底座**
   - `#14` Plugin Core

4. **自治能力闭环**
   - `#122` 调度增强
   - `#37` Extensible Initializer
   - `#133` env provider 配置

5. **协作与外置扩展**
   - `#136` Email
   - 外置记忆系统（按组件/集成线单独推进）

6. **平台补强**
   - `#40` / `#8` / `#9` / `#38`

---

## 四、关键架构判断

| 主题 | 当前判断 | 原因 |
|------|----------|------|
| Hook 与 Plugin 的关系 | Hook 基础已完成，Plugin Core 仍是主底座 | Hook 解决事件模型，Plugin 解决系统级能力挂载与生命周期统一 |
| Email 的时机 | 不早于 Plugin / Scheduler / Initializer 主线 | 否则先得到通信外壳，内核仍不稳 |
| 记忆系统的定位 | 改为外置组件 / 外部集成方向 | 避免继续把平台主线与记忆实现耦合在同一交付链里 |
| Runtime 能力模型 | 先完成 `#278` 治理收口，再推进近期 task 与主线实现 | 避免平台叙事、概念边界与 runtime/backend 抽象继续反复返工 |
| Windows 稳定性 | 作为近期补丁尽早闭环 | 避免平台主线开发被跨平台 socket 问题反复打断 |

---

## 五、验证与同步要求

Phase 4 后续每一步都应同步检查以下四层，避免“功能做完但知识和验证层没跟上”：

- **roadmap**：`docs/planning/roadmap.md` 的 Current / Next Up / Phase 4 状态要同步更新
- **task / issue**：活跃 task、依赖说明、完成状态要与实现一致
- **spec**：配置、RPC、CLI、类型契约变更要同步到 `spec/config-spec.md` / `spec/api-contracts.md`
- **endurance test**：涉及生命周期、调度、通信、插件、记忆的能力变更，要同步补耐久测试

建议在 Plugin / Scheduler / Email / Memory 四条线上分别建立最小可持续验证口径：
- Plugin：生命周期、隔离、重入保护
- Scheduler：delay / cron / cancel / dynamic source
- Email：离线投递、线程、自动唤醒
- External memory integration：边界清晰、可替换、与平台内核解耦

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| #14 Plugin 接口不稳定 | 中 | 后续 heartbeat / scheduler / memory 需重写 | 先完成最小 PluginHost + 2-3 个内置插件验证接口 |
| #122 调度增强与现有 Scheduler 耦合过深 | 中 | 调度能力难以扩展 | 通过 InputSourceRegistry + MCP tools 分层推进 |
| #37 Initializer 范围膨胀 | 中 | 拖慢主线交付 | 先做最小可用步骤集（mkdir/exec/git-clone/npm-install） |
| Email 过早推进 | 中 | 平台外壳先行，内核继续分散 | 严格排在 Plugin Core 和调度闭环之后 |
| Memory 接入过早耦合 | 中 | Plugin Core 反复改动 | 先完成 memory core/store，再通过 PluginHost 接入 |
