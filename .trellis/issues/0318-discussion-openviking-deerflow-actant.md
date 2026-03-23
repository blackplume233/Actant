---
id: 318
title: "[discussion] 基于 OpenViking / DeerFlow 对照收敛 Actant 仓库定位与边界"
status: open
labels:
  - discussion
  - "priority:P1"
  - architecture
  - roadmap
  - vision
  - vfs
  - context
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 278
  - 296
  - 310
relatedFiles:
  - README.md
  - PROJECT_CONTEXT.md
  - .trellis/spec/index.md
  - docs/design/contextfs-architecture.md
  - docs/design/actant-vfs-reference-architecture.md
  - docs/planning/contextfs-roadmap.md
  - packages/api/src/services/namespace-authoring.ts
  - packages/mcp-server/src/context-backend.ts
  - packages/vfs/src/namespace/canonical-path.ts
  - packages/acp/src/channel-adapter.ts
  - packages/channel-claude/src/claude-channel-adapter.ts
taskRef: null
githubRef: "blackplume233/Actant#318"
closedAs: null
createdAt: "2026-03-23T04:34:37"
updatedAt: "2026-03-23T04:34:37"
closedAt: null
---

**Related Issues**: [[0278-faq]], [[0296-refactor-5-actant-core]], [[0310-thin-kernel-4-m5]]
**Related Files**: `README.md`, `PROJECT_CONTEXT.md`, `.trellis/spec/index.md`, `docs/design/contextfs-architecture.md`, `docs/design/actant-vfs-reference-architecture.md`, `docs/planning/contextfs-roadmap.md`, `packages/api/src/services/namespace-authoring.ts`, `packages/mcp-server/src/context-backend.ts`, `packages/vfs/src/namespace/canonical-path.ts`, `packages/acp/src/channel-adapter.ts`, `packages/channel-claude/src/claude-channel-adapter.ts`

---

## 背景

这是一份用于后续多人讨论的上下文整合 issue，不是最终决议。

触发原因：在 2026-03-23 的架构讨论里，我们集中对照了 **OpenViking** 与 **DeerFlow 2.0**，重新审视 Actant / AgentCraft 当前工程的存在必要性、边界、以及后续是否应该继续扩张产品面。

当前判断是：

- 如果仓库继续同时做“super-agent harness + memory platform + skills platform + runtime integrations + context filesystem”，必要性已经显著下降。
- 如果仓库收敛为“agent-native context substrate”，也就是专注 `ContextFS / VFS / namespace / protocol bridge / runtime filesystem contract`，则仍然存在独立价值。

这个 issue 的目标是把这轮讨论中的证据、判断、风险和建议一次性记录下来，供后续更多人继续讨论。

---

## 外部对照摘要

### 1. OpenViking

公开资料显示，OpenViking 的定位是 **AI agents 的 context database**，核心特征包括：

- 用 `viking://` 作为统一资源协议
- 采用 L0 / L1 / L2 三层上下文分层与按需下钻
- 强调 filesystem paradigm，而不是平铺 chunk 检索
- 关注 session memory、自迭代、上下文工程
- 截至 2026-03-19，PyPI 仍有活跃发布，不是历史概念项目

参考：

- OpenViking GitHub: https://github.com/volcengine/OpenViking
- OpenViking PyPI: https://pypi.org/project/openviking/

### 2. DeerFlow 2.0

公开资料显示，DeerFlow 2.0 的定位是 **super agent harness**，核心特征包括：

- sub-agents orchestration
- memory
- sandbox filesystem
- skills
- human-in-the-loop
- 面向 minutes-to-hours 复杂任务的完整 harness
- 2026-02-28 发布 2.0 后快速进入 GitHub Trending

参考：

- DeerFlow GitHub: https://github.com/bytedance/deer-flow

### 3. 关键结论

OpenViking 和 DeerFlow 覆盖的是两层不同但相邻的能力：

- OpenViking 更像“context database / context operating model”
- DeerFlow 更像“super-agent harness / execution product”

如果 Actant 继续在这两层都扩张，会同时撞上两个成熟方向。

---

## 当前仓库真相

当前仓库默认入口、spec、roadmap 已经把产品基线收敛到 **ContextFS**：

- 产品层：`ContextFS`
- 实现层：`VFS`
- 核心对象：`mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`
- 当前里程碑状态：M0-M8 已完成，仓库处于 V1 Freeze 之后、等待下一阶段规划

相关文件：

- `README.md`
- `PROJECT_CONTEXT.md`
- `.trellis/spec/index.md`
- `docs/design/contextfs-architecture.md`
- `docs/design/actant-vfs-reference-architecture.md`
- `docs/planning/contextfs-roadmap.md`

这说明仓库当前的“真相”已经不是旧的 template/source/workflow 叙事，而是 **面向 agent 的上下文文件系统**。

---

## 当前工程仍然独特的价值

这轮讨论里，认为仓库仍然有独立价值的部分主要在底层 substrate，而不是上层产品叙事。

### 1. ContextFS / VFS 语义边界比较清晰

当前设计明确区分：

- 访问入口不等于解释层
- consumer interpretation 在 VFS 之外
- VFS 只负责路径、挂载、节点、操作与权限
- 文件用途不由内核决定

这套边界在当前文档里定义得比很多 agent 项目更硬。

### 2. namespace authoring + mount contract

仓库已经有相对清晰的 namespace 配置与约束：

- `actant.namespace.json` 作为唯一运行时配置入口
- root mount 走隐式投影
- direct mount 走显式声明
- `runtimefs` 的 V1 挂载路径有限制
- host path 不能逃逸 project root

这部分更接近“可治理的上下文内核”，而不是普通工具脚本集合。

### 3. daemon / standalone 一致的 MCP 暴露面

`@actant/mcp-server` 当前既能连接 daemon，也能在 standalone namespace mode 下直接暴露上下文树；它把 `/project`、`/workspace`、`/skills`、`/agents`、`/mcp/runtime` 等树统一成稳定访问面。

### 4. ACP / channel bridge

仓库还有 `@actant/acp` 与 `@actant/channel-claude` 这种协议桥和 runtime adapter，这部分不是 DeerFlow/OpenViking 直接替代掉的内容。

---

## 当前工程的主要问题

### 1. 包面过宽

`packages/` 里同时存在：

- substrate 类包：`vfs`、`shared`、`api`、`mcp-server`、`acp`
- runtime / orchestration 类包：`agent-runtime`、`context`、`domain-context`、`catalog`
- 交付表面类包：`dashboard`、`rest-api`、`tui`
- 特定运行时绑定：`pi`

问题不是包多本身，而是这些包背后混着几条不同产品叙事。

### 2. compatibility debt 仍然明显

仓库里仍能扫到大量 `legacy / compat / migration / standalone` 痕迹：

- ACP compatibility bridge
- channel protocol migration 文档
- standalone 路径与 fallback 叙事
- catalog compat mode
- 历史 source-centric 清理后的余波

这会让仓库继续维持较高维护成本。

### 3. 容易重新滑回“什么都想做”的方向

尤其是 `catalog / context / domain-context / runtime` 这一层，最容易重新长回：

- template / skill 平台
- memory system
- deep research workflow
- productized agent runtime

而这几条路已经和 DeerFlow / OpenViking 高度重叠。

---

## 本轮讨论的核心判断

### 判断 A：作为“完整 agent 产品”继续做，必要性偏低

原因：

- DeerFlow 2.0 已经覆盖 super-agent harness 叙事
- OpenViking 已经覆盖 context database / memory-heavy context engineering 叙事
- Actant 若继续同时做上层产品、memory、skills、runtime，会持续进入高重叠区域

### 判断 B：作为“agent-native context substrate”继续做，仍有必要

原因：

- 当前仓库已经完成一轮较完整的 ContextFS / VFS 基线冻结
- namespace + mount contract + node semantics + MCP/ACP bridge 是相对独立的价值层
- 这一层可以成为 DeerFlow/OpenViking 之上的接入 substrate，而不是替代它们的产品

### 判断 C：后续不应该再证明“我也能当一个 super agent app”

更合理的方向是：

> 证明 Actant 能成为别的 agent 系统值得接入的上下文内核。

---

## 建议的仓库收敛方向

### 目标定位

把仓库收敛为：

> **Actant = agent-native context substrate**

也就是只保留并强化：

- `ContextFS`
- `VFS`
- `namespace authoring`
- `runtime filesystem contract`
- `MCP surface`
- `ACP / channel bridges`

### 建议保留为 Core 的包

- `packages/vfs`
- `packages/shared`
- `packages/api`
- `packages/mcp-server`
- `packages/acp`
- `packages/channel-claude`
- `packages/cli`

### 建议冻结为 Secondary 的包

- `packages/agent-runtime`
- `packages/context`
- `packages/catalog`
- `packages/domain-context`

原则：停止扩张，只保留支撑 core 所必需的部分。

### 建议评估退出或迁移为 Experimental 的包

- `packages/dashboard`
- `packages/rest-api`
- `packages/pi`
- `packages/tui`

原则：没有明确外部消费者和验证闭环的，不再保留为默认主线。

---

## 建议的三阶段收敛计划

### Phase 1: 定核

目标：把仓库“是什么、不是什么”写死。

建议动作：

- 在默认入口文档中新增非目标声明
- 给所有 package 打上 `core / secondary / experimental / retire-candidate` 标签
- 新建一份 repo convergence truth file，作为后续收敛工作的唯一跟踪文件

### Phase 2: 砍面

目标：收缩默认构建面和维护面。

建议动作：

- 清理没有活跃消费者的 compatibility layer
- 保留 `mcp-server` 必需的 standalone mode，但不再把 standalone 发展为并行产品叙事
- 审查 `dashboard / rest-api / tui / pi`，迁出默认主线或删除
- 压缩 `context / catalog / domain-context / agent-runtime` 的角色边界

### Phase 3: 强化 substrate

目标：把收敛后的仓库变成可接入的底座。

建议动作：

- 明确 ContextFS external contract
- 把 DeerFlow / OpenViking 视作上层消费者或外部后端，而不是直接竞争对象
- 做一个真实外部消费者集成，而不是继续仓库内部自证循环

---

## 值得集中讨论的问题

1. 我们是否正式接受这个定位：`Actant != super-agent product`，`Actant == context substrate`？
2. 哪些包是下一阶段必须保留的核心，哪些应该冻结或迁出主线？
3. `catalog / context / domain-context / agent-runtime` 中哪些能力仍然是 substrate 必需的？
4. `dashboard / rest-api / tui / pi` 是否存在真实使用者或明确的近期需求？
5. 我们是否应该把下一阶段的成功标准定义为“有外部 harness/backend 接入”，而不是“仓库内再增加一种能力”？
6. 对 OpenViking / DeerFlow 的正确策略是什么：接入、兼容、映射，还是继续部分替代？

---

## 相关 Issue

- #278 对齐 FAQ 产品定位，开展仓库历史内容审查、概念收缩与现状整理
- #296 [refactor] 按 5 层架构拆分 @actant/core 为独立包
- #310 Thin Kernel 反模式预警：4 处框架层膨胀需在 M5 前收敛

这三个 issue 与本 issue 相关，但本 issue 更偏“下一阶段仓库收敛与定位决策”。

---

## 期望产出

希望通过这条 issue 达成以下结果之一：

- 明确接受“收敛为 substrate”的方向，并启动收敛计划
- 明确拒绝该方向，但给出继续做上层产品的清晰理由与范围边界
- 至少完成对 package 分层、默认入口、非目标声明、experimental/retire 候选的第一轮审查
