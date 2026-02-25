# Phase 4 计划：自治 Agent 平台 (Hook · Plugin · 强化 · 通信)

> 评估日期：2026-02-25
> 基于 roadmap.md + 全部 open Issues + 代码现状分析

---

## 一、Phase 4 现状评估

### 已完成项（Phase 3 → Phase 4 过渡期）

| Issue | 标题 | 状态 | 备注 |
|-------|------|------|------|
| #134 | agent open + interactionModes | ✅ 已关闭 | BackendManager 已支持 open mode |
| #121 | Pi 内置后端 | 🔧 大部分完成 | `@actant/pi` 包已存在 (PiBuilder, PiCommunicator, acp-bridge) |
| #141 | ModelProvider Registry | 🔧 部分实现 | `ModelProviderRegistry` 类已存在，内置 providers 已注册 |
| #131 | Pluggable Backend Registry | 🔧 部分实现 | `BackendManager` + `BackendDefinition` 已完成 |
| — | 版本号统一 | ✅ | 所有包已升至 0.2.1（#129 描述的 0.1.3 问题应已解决） |

### 仍需修复的 Bug（第一波）

| 优先级 | Issue | 标题 | 难度 | 状态 |
|--------|-------|------|------|------|
| **P0** | #117 | `gateway.lease` RPC handler 缺失 | 中 | 未开始 — handler 文件不存在，Session Lease 模式完全不可用 |
| **P0** | #151 | agent adopt 后 status 不可见 | 低 | 未开始 — registry/manager cache 不同步 |
| P1 | #129 | 包发布 0.1.3 | ？ | **需验证** — 版本已是 0.2.1，可能已解决 |
| P2 | #95 | ACP Gateway terminal stub | 中 | 未开始 — 需 TerminalHandle 映射方案 |
| P2 | #127 | install.ps1 非交互挂起 | 低 | 未开始 |
| P2 | #126 | daemon.ping 硬编码版本 | 低 | 未开始 |
| P3 | #138 | 清理已弃用传递依赖 | 低 | chore |

### Phase 4 核心能力（第二波）

| 优先级 | Issue | 标题 | 依赖 | 预估 |
|--------|-------|------|------|------|
| **P1** | #135 | Workflow 重定义为 Hook Package | #47 ✅ | **大** — 三层 Hook 事件总线 + 动作执行器 |
| **P1** | #14 | Actant 系统级 Plugin 体系 | #22 ✅ | **大** — 可插拔架构设计 |
| **P1** | #137 | Runtime MCP Manager | — | **大** — MCP Server 进程管理 + 连接维护 |
| P1 | #37 | Extensible Initializer | — | 中 — 声明式初始化步骤框架 |
| P2 | #133 | 环境变量 provider 配置 | #141 部分完成 | 中 — env fallback + 后端感知注入 |
| P2 | #128 | spawn EINVAL 友好错误 | — | 低 |
| P2 | #153 | 后端 CLI 依赖自动安装 | #131 部分完成 | 中 |
| P2 | #150 | Backend Materialization Plugin | #131 | 中 — 声明式物化描述 |
| P2 | #122 | Employee/Service Mode 完善 | #47 ✅ | 中 |
| P2 | #153(arch) | Instance Interaction Archetype | #134 ✅ | 中 — archetype 字段推导 |
| P2 | #124 | daemon restart --force | — | 低 |

### Phase 4 深化扩展（第三波）

| 优先级 | Issue | 标题 | 依赖 | 预估 |
|--------|-------|------|------|------|
| P2 | #136 | Agent-to-Agent Email 通信 | 无 | **大** — EmailHub + CLI + RPC + 时间线 |
| P2 | #40 | Agent 工具权限管理 | — | 中 |
| P2 | #8 | Template hot-reload | — | 低 |
| P2 | #38 | Endurance Test Agent 模板 | #37 | 低 |
| P3 | #9 | Agent 进程日志收集 | — | 低 |
| P2 | #145 | Community Skill Source | — | 中 |

---

## 二、推进策略

### 第一波：Bug 修复 + 基础保障（1-2 天）

**目标**：消除已知阻塞性 Bug，确保基础功能可用。

```
顺序 1: #117 gateway.lease handler          ← Session Lease 模式的前置
顺序 2: #151 agent adopt registry sync      ← 低成本高价值
顺序 3: #129 验证包发布状态                   ← 确认是否已解决
顺序 4: #126 daemon.ping 版本号             ← 快速修复
顺序 5: #127 install.ps1 非交互检测          ← 低风险修复
顺序 6: #95 terminal stub                   ← 依赖 SDK，可能需要 workaround
```

### 第二波：核心能力（按依赖关系和价值排序）

**批次 A — 环境基础（P1，解锁后续开发）**:
```
#133 环境变量 provider 配置     ← 影响所有后端的可用性
#128 spawn EINVAL 友好错误      ← DX 体验
```

**批次 B — Hook/Event 体系（P1，Phase 4 核心）**:
```
#135 Workflow as Hook Package   ← 三层 Hook 架构是 Phase 4 的灵魂
  ├── Step 1: WorkflowDefinition schema 重设计
  ├── Step 2: Hook EventBus（Layer 1 系统事件 + Layer 3 运行时事件）
  ├── Step 3: Action 执行器（shell / builtin / agent）
  ├── Step 4: 与 EmployeeScheduler 整合（CronInput → Hook cron）
  └── Step 5: CLI workflow list / enable / disable
```

**批次 C — Plugin 架构（P1，可插拔基础）**:
```
#14 Actant 系统级 Plugin 体系   ← 与 #135 协同设计
  ├── Step 1: Plugin 接口定义（onStart/onStop/onTick lifecycle）
  ├── Step 2: PluginHost + PluginRegistry（实例级）
  ├── Step 3: HeartbeatMonitor 作为首个内置 Plugin
  ├── Step 4: Scheduler Plugin 化（从 #47 重构）
  └── Step 5: 模板 plugins 字段集成
```

**批次 D — 强化项**:
```
#37 Extensible Initializer       ← 声明式初始化
#137 Runtime MCP Manager        ← headless Agent MCP 支持
#150 Backend Materialization     ← 声明式物化描述
#122 Employee/Service 完善       ← archetype 推导
```

### 第三波：深化扩展

```
#136 Agent-to-Agent Email        ← 异步通信范式
#40 工具权限管理                  ← 安全增强
#8  Template hot-reload          ← DX 增强
#9  日志收集                     ← 可观测性
```

---

## 三、推荐的第一个开发任务

**#117 `gateway.lease` RPC handler 实现**

理由：
1. Session Lease 是 Phase 3 的核心架构之一，但 handler 缺失导致完全不可用
2. 类型定义已存在（`GatewayLeaseParams` / `GatewayLeaseResult`）
3. 实现范围明确：新建 `gateway-handlers.ts`，从 `AcpConnectionManager` 获取 Gateway → 创建 socket → 返回 `{ socketPath }`
4. 修复后可验证整个 ACP Proxy Session Lease 流程

---

## 四、关键架构决策（待确认）

| 决策点 | 选项 | 建议 | 备注 |
|--------|------|------|------|
| Hook 事件总线实现 | Node EventEmitter vs 自定义 | EventEmitter + typed wrapper | 简单高效，Layer 分离通过命名空间 |
| Plugin 加载方式 | 静态注册 vs 动态加载 | Phase 1 静态注册，Phase 2 动态 | 避免过早引入复杂性 |
| Workflow 配置格式 | JSON vs YAML | YAML（与现有 configs 一致） | #135 已有 YAML 草案 |
| Email 持久化 | SQLite vs 文件 | SQLite（与 state 一致） | 或考虑 JSON Lines 作为轻量方案 |

---

## 五、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| #135 Hook 体系范围膨胀 | 高 | Phase 4 延期 | 严格分 Phase: Schema → EventBus → Actions |
| #14 Plugin 接口不稳定 | 中 | 后续插件需重写 | 先实现 2-3 个内置插件验证接口 |
| #137 MCP 运行时复杂度 | 高 | 阻塞 headless Agent | 先支持 stdio 传输，SSE 延后 |
| ACP SDK 变更 | 低 | #95 terminal stub | 保持 workaround，追踪上游 |
