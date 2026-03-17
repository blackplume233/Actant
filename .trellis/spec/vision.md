# Actant 愿景

> **定位**: Agent 应用开发平台 —— 为特化 AgentTemplate 构建专属 UI、配置面板、工作流和数据互通层

---

## 核心判断

当前语境下，`Tool` 这个命名**不够准确**。

因为这里讨论的并不是一个单纯的模型调用工具、函数工具或 MCP tool，而是：

- 为某类 **AgentTemplate** 提供专属的人机交互界面
- 为该模板定义结构化配置，而不是只靠聊天输入
- 为该模板挂载领域工作流、事件响应和审批节点
- 复用 Actant 原生的 Agent 间通信、ACP、事件系统、资产与上下文能力

这已经超出了传统 `Tool` 的语义，更接近：

- **Agent App**
- **Agent Surface**
- **Agent Experience Pack**
- **Agent Solution**
- **Agent Product Bundle**

**建议结论**：

- 对外产品层命名，优先考虑 **Agent App**
- 对内技术层命名，可以保留一个更中性的结构名，如 **Surface Pack** 或 **App Bundle**

本文档后续统一使用 **Agent App** 作为产品概念名。

---

## 核心愿景

Actant 致力于成为 **Agent 应用开发平台**。

它不是只让开发者“运行 Agent”，而是让开发者围绕特化 AgentTemplate，快速构建一整套可交付的 Agent 应用，包括：

1. **专属 UI** —— 不同 Agent 拥有适合其任务域的页面、表单、面板、可视化视图
2. **结构化配置** —— Agent 的行为通过 schema 和配置面板驱动，而不是依赖低效聊天反复说明
3. **工作流封装** —— 将领域流程、事件、审批和自动化逻辑封装到模板对应的应用层
4. **数据互通** —— 应用之间通过 Actant 的资产、上下文、事件和 Agent 通信机制协同工作

**核心动机**：Chat 是通用入口，但对高频、结构化、可重复的专业任务来说效率很低。特化 Agent 需要特化交互层。

---

## 当前阶段主轴（2026-03）

> **阶段判断**：Actant 的长期使命没有变化，变化的是当前阶段的首要任务排序。
> 这一阶段的收敛，不应被解释为平台使命收缩，也不应被解释为产品转型为单一 MCP 工具。

### 不变的长期使命

- Actant 仍然是 Agent 平台与 Agent App 开发平台。
- `AgentTemplate`、`AgentInstance`、`DomainContext`、通信层、运行时管理、Dashboard、PluginHost 等仍然属于主航道。
- daemon、scheduler、runtime services、ACP/MCP/REST 等能力仍然是平台建设的一部分，而不是被放弃的方向。

### 当前阶段的首要任务

当前阶段优先级已经从“继续平均推进所有平台能力面”切换为“先用正式安装的 CLI 让 Agent 真正进入项目并开始工作”。

这意味着当前主线应优先解决：

1. **正式 CLI 作为第一控制面**
   - 自举阶段以已安装的 `actant` CLI 为准，而不是本地源码入口、临时脚本或 MCP 配置。
   - 正式自举命名空间是 `actant hub ...`；`acthub ...` 只是等价别名，不形成第二套产品语义。
2. **自举开发闭环**
   - Actant 应优先能够帮助开发 Actant 自身，成为进入项目、获取上下文、发现能力、驱动协作的第一入口。
   - “CLI-first”不等于“无 daemon”；允许存在轻量常驻宿主进程，但控制面必须仍然是正式 CLI。
3. **单宿主进程 + Hub 自举面**
   - `hub` 是单个 daemon host 上的 bootstrap capability surface，而不是第二个独立 daemon。
   - 默认自举配置应只加载 host kernel + hub core + project-context 相关能力，保持可热插拔、低内存占用。
4. **project-context first, runtime-enhancement second**
   - daemon 在线时的 live runtime 视图是增强项；
   - 默认自举不应实例化 `AgentService`；
   - Agent Runtime 可以作为框架存在，但运行时服务必须按需懒激活。

### 当前阶段中 CLI / Hub / MCP 的职责

当前阶段的职责边界应明确为：

- **CLI**：正式的自举控制面，负责启动、复用和驱动宿主能力。
- **Hub**：挂在单宿主进程上的 bootstrap surface，负责项目上下文发现、能力发现、只读 VFS/索引访问与后续扩展的统一入口。
- **MCP**：同一宿主能力之上的消费层 / 接入层，而不是当前阶段的 bootstrap owner。

因此，MCP 在当前阶段不再承担“第一入口”的职责；它可以继续作为消费层存在，但不应反向定义 Actant 的正式自举路径。

### 当前阶段的设计取舍

在这个阶段，设计与排期应优先遵循：

- 先定义 `Project-level DomainContext`，再决定大规模 runtime 改造；
- 先定义 `hub` 的控制面、作用域和同步模型，再决定消费层接入形式；
- 先做最小可自举闭环，再做大而全的包级纯化；
- 允许 Agent Runtime 框架先存在，但必须把“模块已注册”和“服务已激活”严格区分开。

因此：

- `actant hub`、`acthub` 别名、bootstrap profile、`actant.project.json`、作用域隔离、reactive sync 是当前主线；
- 默认启动应收敛到 host kernel + hub core，而不是默认拉起完整 runtime service 集；
- MCP 应移动到消费层，而不是继续占据 bootstrap owner 位置；
- `@actant/core` 的大规模拆分只应在它明确服务于 project-context / bootstrap 目标时推进。

## 核心抽象

### 1. AgentTemplate 仍然是运行时蓝图

`AgentTemplate` 定义一个 Agent 的基础运行能力：

- backend
- provider
- domainContext
- permissions
- initializer
- archetype
- schedule

它回答的是：**这个 Agent 如何运行、拥有什么基础能力。**

### 2. Agent App 是 Template 之上的产品层

`Agent App` 绑定到一个或多个 `AgentTemplate`，定义该模板在具体场景中的应用外壳：

- 页面布局
- 表单与配置 schema
- 操作入口
- 工作流编排
- 数据视图
- 资产输入输出约定
- 与其他 Agent 的协作关系

它回答的是：**这个 Agent 如何被人高效使用，如何融入完整生产流程。**

### 3. AgentInstance 是一次具体落地

`AgentInstance` 是某个 `AgentTemplate` 在某个 workspace / project / company 中的实例化结果。

当实例附着某个 `Agent App` 时，它不再只表现为一个通用聊天对象，而是表现为一个带有专属操作面的应用实体。

---

## 为什么不该继续叫 Tool

如果仍叫 `Tool`，会和现有体系发生明显混淆：

- 与 MCP tool 混淆：后者是给 Agent 调用的函数能力
- 与 Plugin 混淆：后者是运行时扩展点
- 与 Workflow 混淆：后者是行为编排，不包含 UI 与完整配置面
- 与 Skill 混淆：后者是上下文与方法注入，不是完整应用壳层

而你的目标其实是：

**围绕 AgentTemplate 构建“可用的专业应用界面与流程封装”。**

所以用 `App` / `Surface` / `Solution` 会更贴切。

---

## 目标场景

### 游戏开发：关卡生产 App

```
设计师在关卡生产 App 中填写需求
  - 关卡主题
  - 玩家目标
  - 时长预算
  - 机制约束
  - 美术风格

        ↓

[Agent App: Level Production]
  - 关卡策划面板
  - 资产需求视图
  - 流程节点状态
  - 审核与回退入口

        ↓

Agent A: 关卡策划模板
Agent B: 地形生成模板
Agent C: 场景布置模板
Agent D: 玩法脚本模板
Agent E: 验证测试模板

        ↓

通过 Actant 基础能力互通：
  - EventBus
  - ACP
  - ac:// 资产寻址
  - Context / Memory
  - Agent-to-Agent 协作
```

**关键价值**：用户不再通过聊天逐步指挥多个 Agent，而是在一个面向目标任务的专属应用界面中完成输入、观察、审核和迭代。

### 软件工程：代码变更 App

- PR 分析面板
- 风险评估配置
- 测试策略选择
- 文档同步开关
- 结果追踪与人工批准

### 内容创作：内容运营 App

- 内容 brief 表单
- 平台差异化配置
- 素材引用与版本化
- 发布计划和审核流

---

## Agent App 的定义

### Agent App = 特化 Agent 的应用封装层

一个 `Agent App` 至少包含以下几部分：

| 模块 | 作用 |
|------|------|
| `ui` | 专属页面、面板、表单、Canvas、Widget、状态视图 |
| `config` | 配置 schema、默认值、校验规则、可编辑参数 |
| `workflow` | 事件驱动流程、任务阶段、审批节点、自动化动作 |
| `data` | 输入输出资产类型、上下文槽位、记录与产物约定 |
| `capabilities` | 依赖哪些 Template / MCP / Plugin / Skill / Backend |
| `collaboration` | 与哪些 Agent/实例协作，如何通信和移交 |

### 推荐结构

```yaml
kind: AgentApp
name: level-production
version: 1.0.0

bindsTo:
  templates:
    - level-designer
    - terrain-generator
    - scene-composer
    - gameplay-scripter

ui:
  routes:
    - /apps/level-production
  panels:
    - brief-form
    - asset-browser
    - pipeline-status
    - approval-center

config:
  schema: level-production.schema.json
  defaults:
    targetDuration: 20m
    style: fantasy-realism

workflow:
  entry: level-production.flow.json
  triggers:
    - app.submit
    - asset.updated
    - review.approved

data:
  inputs:
    - ac://brief/level-design
    - ac://style-guides/environment
  outputs:
    - ac://artifacts/level/layout
    - ac://artifacts/level/playable-build

capabilities:
  mcpServers:
    - unreal-editor
    - asset-registry
  plugins:
    - heartbeat-plugin
    - review-gate

collaboration:
  handoffs:
    - from: level-designer
      to: terrain-generator
      via: ac://artifacts/level/layout
```

---

## 与 Actant 基础能力的关系

这是你方案里最关键的一点：

**Agent App 不是重新发明一套系统，而是建立在 Actant 原生能力之上的上层封装。**

### 复用的底座能力

| Actant 基础能力 | Agent App 如何使用 |
|----------------|-------------------|
| `AgentTemplate` | 作为 App 绑定的执行蓝图 |
| `AgentInstance` | 作为 App 中实际运行的工作实体 |
| `DomainContext` | 为 App 内各 Agent 注入专业知识与约束 |
| `EventBus / Hook` | 驱动 App 内状态流转、自动触发和审批逻辑 |
| `ACP` | 支撑与编辑器、引擎、外部客户端的深度通信 |
| `ac://` 资产系统 | 作为 App 间和 Agent 间的数据交换协议 |
| `Memory / Context` | 保持多步流程中的上下文连续性 |
| `Live Canvas` | 承载专属可视化视图和动态反馈 |
| `Dashboard` | 提供 App 的容器与统一入口 |

### 关键原则

- **App 不替代 Template**，而是绑定 Template
- **App 不替代 Workflow**，而是编排和组织多个 Workflow 能力
- **App 不替代 Plugin**，而是声明自己依赖哪些 Plugin
- **App 不替代 Chat**，而是将 Chat 降级为补充入口，而非主入口

---

## UI 为什么是核心

对于特化 Agent，聊天式交互有天然瓶颈：

- 输入结构不稳定
- 重复指令成本高
- 状态不易总览
- 审批与回滚困难
- 难以和资产、流程节点、版本信息形成统一视图

因此，特化 Agent 应该拥有自己的 UI 交互层，例如：

- 配置表单
- 参数面板
- 流程图
- 资产浏览器
- 审批中心
- 结果对比器
- 实时 Canvas 预览

**结论**：对于高价值、高频、强结构化任务，UI 不是附属物，而是 Agent 应用的一部分。Chat 只是 fallback。

---

## 演进路线

### 当前阶段

- 已有 AgentTemplate / AgentInstance / DomainContext / ACP / EventBus / Dashboard / Canvas
- 这些能力已经构成 Agent App 的底座

### 下一阶段

1. 在 spec 层正式引入 `AgentApp` 概念
2. 定义 `AgentAppManifest` 结构
3. 允许 `AgentTemplate` 声明可挂载的 app / surface
4. Dashboard 增加 App 路由、App 容器、App 状态管理
5. 让 App 能调用 Agent 间通信、资产系统和工作流引擎

### 长期阶段

- App Marketplace / Hub 分发
- 跨项目复用的行业 App 模板
- 面向游戏、内容、工程的垂直 App 生态

---

## 命名建议

按优先级排序：

1. **Agent App** — 最适合产品与平台叙事
2. **Agent Surface** — 适合强调交互层
3. **App Bundle** — 适合内部技术结构
4. **Solution Pack** — 适合行业场景封装

**不推荐继续使用**：

- `Tool` — 过于轻，且与 MCP tool / function tool 语义冲突
- `Plugin` — 过于偏底层扩展
- `Workflow` — 无法覆盖 UI 和配置面

---

## 与 Paperclip 的进一步差异

| 维度 | Paperclip | Actant (本方案) |
|------|-----------|-----------------|
| 核心对象 | AI 员工组织 | 特化 Agent 应用 |
| 主交互方式 | ticket / governance | 专属 UI + 配置 + 流程 |
| UI 角色 | 管理面板 | 生产界面本身 |
| Agent 价值 | 执行组织角色 | 承载专业场景能力 |
| 目标 | 运营 AI 公司 | 构建 AI 原生应用平台 |

**一句话概括**：Paperclip 在管理 AI 员工，Actant 在产品化特化 Agent。

---

## 相关文档

- [Agent 生命周期](./agent-lifecycle.md) — Agent 的运行模式与状态管理
- [配置规范](./config-spec.md) — Template、Plugin、Workflow 等配置基础
- [统一事件系统设计](../../docs/design/event-system-unified-design.md) — App 编排的事件底座
- [记忆层与 Agent 演进](../../docs/design/memory-layer-agent-evolution.md) — 上下文保持机制
- [actant-hub 组件仓库设计](../../docs/design/actant-hub-registry-design.md) — App/模板分发的生态基础
