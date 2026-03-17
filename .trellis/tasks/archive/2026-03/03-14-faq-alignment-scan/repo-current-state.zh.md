# 仓库现状整理

> 本文用于回答：在 FAQ 对齐治理启动时，仓库当前到底已经拥有什么、缺少什么、混乱点在哪里。
> 目标是避免后续讨论继续在“代码现实”、“文档叙事”、“规划假设”之间来回跳转。

## 一句话结论

当前仓库**并不是一个概念空白、平台未成形的状态**。相反，它已经具备了相当明确的平台雏形：

- 配置层已经开始表达 app / template / instance / archetype 关系
- runtime 层已经出现 service / employee 差异化行为
- context injection / initializer pipeline / dashboard archetype 建模等关键基础设施已经存在
- Phase 4 planning 也已经开始从 feature backlog 转向平台底座优先

真正的问题不在于“没有基础”，而在于：

- 这些基础设施尚未被统一整理进一个一致的产品与架构叙事
- 历史文档仍在传播旧理解
- 一些关键术语仍未收口
- 验证体系尚未跟上新的平台模型

---

## 当前已经成立的东西

### 1. archetype 模型已经不是纯概念，而是跨层存在

当前 `repo / service / employee` 已同时存在于：

- wiki 概念文档
- 配置规范
- runtime 行为
- dashboard UI

这说明 archetype 不再只是规划概念，而已经成为实际产品模型的一部分。

关键证据：
- `docs/wiki/guide/concepts.md`
- `.trellis/spec/config-spec.md`
- `packages/core/src/manager/agent-manager.ts`
- `packages/dashboard/client/src/lib/archetype-config.ts`

结论：
- 后续工作应假设 archetype 是当前正式模型，而不是待引入概念

### 2. `service` 与 `employee` 已经在 runtime 上开始分化

从 `AgentManager` 可以看出，当前 runtime 已不仅仅是“统一启动几个 Agent”。

已经存在的差异化行为包括：
- employee conversation 持久化
- employee restart 相关逻辑
- service keepAlive / budget auto-stop
- session context injection
- event bus 生命周期事件

关键证据：
- `packages/core/src/manager/agent-manager.ts:118`
- `packages/core/src/manager/agent-manager.ts:153`
- `packages/core/src/manager/agent-manager.ts:165`
- `packages/core/src/manager/agent-manager.ts:353`
- `packages/core/src/manager/agent-manager.ts:404`

结论：
- 产品叙事尚未完全整理，但 runtime 已在用 service/employee 差异化建模

### 3. Initializer 已有“可扩展流水线”基础，不是空白地带

当前 initializer pipeline 已具备：
- StepContext
- StepRegistry
- dryRun 校验
- 顺序执行
- per-step / total timeout
- rollback
- shared state

关键证据：
- `packages/core/src/initializer/pipeline/types.ts`
- `packages/core/src/initializer/pipeline/step-registry.ts`
- `packages/core/src/initializer/pipeline/initialization-pipeline.ts`

结论：
- #37 应被重新描述为“扩展与整合现有流水线能力”，而不是“从零设计 extensible initializer”

### 4. Dashboard 的产品模型已经走在部分文档前面

dashboard 已将 archetype 视为产品一等概念，并基于 archetype 决定：
- 页面 tabs
- 是否允许 process control
- 是否允许 chat / session
- 是否允许 resume session
- 推荐 backend
- backend 兼容性

关键证据：
- `packages/dashboard/client/src/lib/archetype-config.ts`
- `packages/dashboard/client/src/components/agents/archetype-section.tsx`

结论：
- dashboard 已经比部分 architecture / design 文档更贴近当前产品模型

### 5. 配置规范已经开始具备“平台支撑上层 App”的结构

`config-spec` 里已经出现：
- AgentTemplate
- AgentAppManifest
- AgentInstanceMeta
- AppConfig

并且把 template、app、instance、daemon config 放在一个层次结构中说明。

关键证据：
- `.trellis/spec/config-spec.md:10`
- `.trellis/spec/config-spec.md:19`
- `.trellis/spec/config-spec.md:38`

结论：
- “Actant 是平台，上层承载 App” 这件事其实已经有 spec 萌芽，不是纯新增方向

### 6. Scheduler 已被正确限制在 employee 层

这是当前很重要的一点，因为它避免了所有 archetype 被拉平。

关键证据：
- `docs/wiki/features/scheduler.md:13`
- `.trellis/spec/config-spec.md:247`

结论：
- 当前代码/文档至少在这一点上没有继续滑向“employee 成为唯一形态”

---

## 当前最容易被误判的地方

### 1. 容易误判为“平台还没成形”

实际情况：
- 平台底座的多个关键部件已经存在
- 只是还没有被统一讲清楚

风险：
- 团队会继续以 feature-by-feature 思路推进，而不是底座整合思路

### 2. 容易误判为“#14 直接扩展现有 plugin manager 即可”

实际情况：
- 当前 `PluginManager` 是 agent/workspace 侧组件管理
- Phase 4 #14 需要的是 runtime 侧 PluginHost

风险：
- 一旦误判，会把 system plugin 做到错误层级上

### 3. 容易误判为“#37 是 greenfield”

实际情况：
- 当前已经有 step registry、rollback、timeout、shared state 等基础

风险：
- 规划和实现会无谓重造轮子

### 4. 容易误判为“employee 是当前当然的中心形态”

实际情况：
- `employee` 虽然在文档和规划中曝光很高，但从 FAQ framing 和当前产品结构看，更应被视为 `service + autonomy`

风险：
- service 的平台契约、文档入口、验证口径被长期弱化

---

## 当前真正缺失的东西

### 1. 统一的产品主叙事
缺的不是更多 feature 文档，而是统一的顶层 framing：
- Actant 是底层平台
- 上层承载 App / SOP / CI / engine integration
- archetype 是平台管理深度递进模型

### 2. 明确的分层模型
缺的是一套稳定说明：
- 哪些属于 template/domain-context
- 哪些属于 platform/runtime-services
- 哪些能力通过 workspace 物化，哪些通过 runtime 注入

### 3. plugin 术语收口
当前最显著的术语治理缺口之一。

### 4. 以 archetype 为核心的验证组织方式
当前 endurance 已经有基础，但还没有直接服务于 archetype 产品模型。

### 5. 历史文档状态治理
当前缺少一套明确的 current / partial / historical / superseded 分级策略。

---

## 当前文档与实现之间的主要脱节点

### 1. architecture 落后于 runtime
- runtime 已体现 service/employee 差异化
- architecture 仍偏旧式包结构说明

### 2. design 文档落后于 Phase 4 收口方向
- 某些设计稿仍在讲旧问题定义
- 但当前 planning 已开始转向平台底座优先

### 3. spec 比部分 wiki 更先进
- config-spec 已开始容纳 AgentAppManifest 与 archetype 结构
- 但 wiki 顶层叙事还没有完全跟上

### 4. dashboard 比部分概念文档更先进
- UI 已经做出 archetype-first 的差异化建模
- 文档却尚未完全解释这种差异化背后的产品逻辑

---

## 当前推荐的理解方式

如果要用一句话总结仓库现状，建议这样理解：

**Actant 当前已经进入“平台雏形已存在、但知识层和验证层尚未完成统一收敛”的阶段。**

这意味着后续工作重点应是：
- 先治理概念与文档
- 再收敛规划与边界
- 再按 archetype / platform capability 重组验证
- 而不是继续简单叠加零散 feature 叙事

---

## 对后续执行的直接指导

### 先做什么
- 先处理 P0 概念冲突：平台叙事、service 主形态、plugin 双义

### 不应再怎么做
- 不应继续把 #14、#37、#122 描述成彼此孤立的新功能点
- 不应继续让 employee 作为默认主叙事压过 service
- 不应继续让历史 design doc 隐性充当当前产品定义

### 后续整理输出建议
- 母 issue：治理目标与边界
- 冲突登记表：逐条问题与证据
- 仓库现状整理：当前能力与断裂点
- 子 issue：按 docs/spec/runtime/verification 分拆推进
