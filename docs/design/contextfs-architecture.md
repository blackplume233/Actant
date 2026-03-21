# ContextFS Architecture

> Status: Draft
> Date: 2026-03-20
> Scope: 产品层对象模型
> Related: [Actant VFS Reference Architecture](./actant-vfs-reference-architecture.md), [ContextFS Roadmap](../planning/contextfs-roadmap.md)

---

## 1. Positioning

Actant 的核心不是"管理 Agent 的平台"，而是"为 Agent 提供统一上下文访问的系统"。

在新的基线里：

- `ContextFS` 是产品层名称
- `VFS Kernel` 是其实现内核
- `Agent` 是资源，不是平台唯一中心
- `Tool` 是带执行与流能力的文件式资源，不是独立顶层系统

一句话概括：

> **Actant = 面向 Agent 的上下文文件系统。**

---

## 2. Core Claims

### 2.1 上下文管理是平台核心

Actant 优先解决的问题是：

- 统一上下文表示
- 统一上下文寻址
- 统一上下文操作
- 统一权限与生命周期
- 让不同 Agent 通过同一模型消费和暴露上下文

因此，平台的顶层抽象不再是旧 `ContextManager`，而是 `ContextFS`。

### 2.2 一切上下文以文件式资源接口暴露

ContextFS 不要求所有东西底层都存成真实文件，但要求所有上下文都可通过统一文件式接口被访问。

最小操作面：

- `read`
- `write`
- `list`
- `stat`
- `watch`
- `stream`

这是一种接口哲学，而不是存储限制。

### 2.3 Agent 是最复杂、最有价值的一类资源

Agent 仍然是系统中的关键对象，但它不再凌驾于资源模型之上。

在 ContextFS 中：

- Agent 有文件式资源视图
- Agent 具备执行和流能力
- Agent 可以消费上下文
- Agent 也可以暴露上下文

因此 Agent 的角色是：

- 资源
- 资源消费者
- 资源生产者

### 2.4 Tool 不是单独的顶层系统

Tool 在 V1 中不单独作为第二套平台中心出现。

它被建模为带执行/流能力的文件式资源，统一纳入 ContextFS 的资源语义，而不是保留旧"tool 注册中心"路线。

---

## 3. Core Objects

### 3.1 Project

`Project` 是：

- 编排单元
- 权限边界
- VFS 中的投影文件

Project 决定：

- 哪些 Source 被挂载
- 挂载到哪些路径
- 谁可以访问哪些路径
- 子 Project 如何收窄父 Project 的可见性和权限

Project 不是 `Source`。

### 3.2 SourceType 与 Source

`SourceType` 是带逻辑的类型定义：

- 封装传输策略（如 git clone、p4 sync、本地 fs read）
- 自定义配置结构（每个 SourceType 独立定义，不依赖中心化 discriminated union）
- 提供认证方式和 sync 策略
- 提供 Source 实例化工厂

`Source` 是 `SourceType` 的实例：

- 自包含
- 声明自身具备的 Trait 集合
- 通过统一文件式接口暴露内容
- 被挂载到 ContextFS 的某个路径前缀

V1 只内置 4 类 Source：

- `SkillSource`
- `McpConfigSource`
- `McpRuntimeSource`
- `AgentRuntime`

### 3.3 Trait

`Trait` 是 Source 声明的原子能力特征。

上层不检查 Source 的名义类型标签，而是通过 required/optional trait 约束来匹配 Source。

V1 关注的 Trait：

- `persistent`：数据跨重启存活
- `ephemeral`：数据随生命周期消亡
- `watchable`：支持变更通知
- `streamable`：支持流式读取
- `writable`：支持写入
- `virtual`：无物理后端，纯计算生成
- `executable`：含可触发执行的控制节点

`versioned` 和 `searchable` 允许保留为后续 trait，但不进入 V1 完成交付要求。

#### Trait 组合规则

**互斥约束：**

- `persistent` 与 `ephemeral` 互斥——一个 Source 不能同时声明数据持久和数据短暂
- V1 不存在其他互斥对；如果未来需要，必须在此显式列出

**无蕴含关系：**

- V1 的 Trait 彼此独立，不存在"A 蕴含 B"的推导（例如 `streamable` 不自动蕴含 `watchable`）
- 每个 Source 必须显式声明所有适用的 Trait，不依赖推断
- 这降低了实现复杂度，也避免隐式依赖导致的意外行为

**可组合性：**

- Trait 集合是 Source 级的，由 SourceType 定义默认集合，实例可在 SourceType 默认基础上收窄但不扩展
- 上层约束（SourceRequirement）对 Trait 做集合运算，不做继承链推导

### 3.4 Capability

`Capability` 描述资源支持的具体操作：

- `read`
- `write`
- `list`
- `stat`
- `watch`
- `stream`

`Trait` 描述 Source "是什么"（本质特征），`Capability` 描述资源"能做什么"（具体操作）。两者正交——Trait 用于上层约束匹配，Capability 用于 Kernel 操作分派。

---

## 4. Design Rationale

本节记录核心设计选择的原理，防止未来实现退化回旧模型。

### 4.1 结构定型优于名义分类

> 问"它能做什么"，而不是问"它叫什么"。

旧 `VfsSourceType`（`"filesystem" | "memory" | "process" | ...`）是名义类型标签——消费者必须知道 Source 的"类名"才能判断行为。这导致：

- 新增 SourceType 必须修改中心枚举
- 消费者对未知类型无法降级处理
- 同样能力的不同 Source 被当作不同类型

Trait 模型是结构定型——消费者只关心 Source 声明了哪些 Trait，不关心它的类名。这对应：

- **Rust trait bounds**：泛型代码要求 `T: Persistent + Watchable`，不要求 `T` 是具体类型
- **Go interfaces**：只要实现了方法集合就满足接口，不需要显式声明
- **Capability-based OS (seL4, Capsicum)**：对象由能力集标识，不由类型标识

### 4.2 开放注册优于中心枚举

> SourceType 注册表是开放的，中心类型定义是封闭的。

旧模式下，每增加一种 Source 就要改 `VfsSourceSpec` discriminated union 和 `VfsSourceType` enum。这违反 Open/Closed Principle。

新模式下，每个 SourceType 是自包含单元（配置 schema + 工厂 + trait 声明），只需注册进表里。对应：

- **Kubernetes CRD**：新资源类型通过注册 CustomResourceDefinition 引入，不修改 API server 核心
- **Linux VFS**：新文件系统通过 `register_filesystem()` 注册，不改内核 switch-case

### 4.3 Trait / Capability / Permission 三层正交

> 每层只回答一个问题。

| 层 | 问题 | 决策者 |
|---|---|---|
| Trait | Source 的本质特征是什么？ | SourceType 定义 + Source 注册 |
| Capability | 这个节点支持哪些操作？ | handlers + fileSchema |
| Permission | 当前 caller 能否执行该操作？ | Project + Middleware |

混淆任意两层会导致：

- 如果把 Trait 当 Permission 用 → Source 自己做权限，绕过 Project 边界
- 如果把 Capability 当 Trait 用 → 文件级操作和 Source 级特征耦合，粒度不对
- 如果把 Permission 当 Capability 用 → 权限变成 Source 的固有属性，无法按 caller 收窄

### 4.4 约束匹配模型

上层通过 `SourceRequirement` 约束 Source 的 Trait：

```text
SourceRequirement {
  required: Trait[]    — 必须全部具备，缺一即不匹配
  optional: Trait[]    — 如果具备则启用增强行为，不具备也不报错
}
```

匹配算法：

```text
satisfies(source, requirement) =
  requirement.required ⊆ source.traits
```

这是纯集合运算，无继承链、无类型层级、无优先级，实现和理解成本极低。

### 4.5 薄内核，厚约定（Thin Kernel, Thick Convention）

> 框架层只做分派和挂接，所有业务语义靠约定和协议表达。

4.1–4.4 的共同方向性承诺是：**系统的结构框架层应当越做越薄，可扩展性和可维护性靠设计模式与语义对齐保证，而不是靠框架代码膨胀。**

核心准则：

1. **框架层只做"胶水"，不做"决策"**
   - Kernel 只负责 path 规范化、mount 查找、middleware 链调用、backend 分派
   - 任何特定 Source 的逻辑都不应出现在 Kernel 内部
   - 新增一个 SourceType 不需要 Kernel 改一行代码

2. **用协议对齐替代类型膨胀**
   - 对象之间通过契约接口（`VfsBackend`、`SourceRequirement`）通信
   - 不通过 discriminated union / switch-case 做分派
   - 新能力通过 Trait 声明而非框架层 if-else 引入

3. **每增加一个功能，框架层代码量应趋向不变或减少**
   - 框架层膨胀是设计债的信号，不是功能丰富的标志
   - 如果新增功能需要改 Kernel 核心代码，应先检查抽象是否需要改进
   - 重构方向永远是把具体逻辑从框架层下沉到 Backend/Source/Plugin

4. **语义对齐替代显式编排**
   - 上层不需要"知道"底层有多少种 Source，只通过 Trait 约束匹配
   - middleware 不需要"知道" Backend 的具体类型，只通过 permission 判定
   - 每层只靠协议面通信，不靠具体类型

与 4.1–4.4 的关系：

| 现有原则 | Thin Kernel 角度 |
|---|---|
| 结构定型优于名义分类 (4.1) | 类型层面的"薄内核"表达 |
| 开放注册优于中心枚举 (4.2) | 扩展性层面的"薄内核"表达 |
| Trait/Capability/Permission 正交 (4.3) | 分层层面的"薄内核"表达 |
| 约束匹配模型 (4.4) | 编排层面的"薄内核"表达 |
| **Thin Kernel, Thick Convention (4.5)** | **统摄性原则：越做越薄的方向性承诺** |

---

## 5. V1 Namespace

V1 固定根路径为：

- `/_project.json`
- `/skills/*`
- `/mcp/configs/*`
- `/mcp/runtime/*`
- `/agents/*`
- `/projects/*`

说明：

- `/_project.json` 是当前 Project 的投影文件
- `/projects/*` 用于子 Project 暴露
- V1 不引入 query/view mount
- V1 不引入 overlay/fallback 行为

---

## 6. Execution Model

V1 不引入独立的顶层 `invoke` 系统。  
执行能力通过"控制节点 + 流节点"表达：

- 写入控制节点触发执行
- 从流节点消费输出

最小约定：

- `/agents/<name>/control/request.json`
- `/agents/<name>/streams/<id>`
- `/mcp/runtime/<name>/streams/<id>`

这样可以保持"文件式资源接口"在 V1 内部的一致性。

---

## 7. Permissions And Lifecycle

权限由 Project 边界负责，不由 Source 自主定义为主入口。

V1 规则：

- 先按 `Project` 判断 caller 可见性
- 再按路径规则决定 `read/write/watch/stream`
- 最后由 Source/Backend 判定该能力是否真实支持

子 Project 只能：

- 收窄可见资源
- 收窄权限

不能扩大父 Project 已声明的能力或权限。

---

## 8. V1 Scope

### Included

- `ContextFS`
- `Project`
- `SourceType` + `Source`
- `Trait` + `Capability`
- 4 个 built-in sources
- `read/write/list/stat/watch/stream`
- 控制节点与流节点执行模型
- Trait 替代旧 `VfsSourceType` 名义标签

### Excluded

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 完整 cache 架构
- distributed consistency
- 旧 `ContextManager` 平台中心模型
- 旧 `DomainContext` 聚合中心模型
- 旧 `VfsSourceType` 名义类型分类

---

## 9. Product/Implementation Split

这份文档只定义产品层对象模型：

- 系统是什么
- 对象是什么
- V1 包含什么
- V1 不包含什么

实现层问题：

- namespace 如何解析
- mount 如何路由
- middleware 如何组织
- node/backend 如何分层
- metadata/lifecycle/events 如何模块化

统一交给 [Actant VFS Reference Architecture](./actant-vfs-reference-architecture.md) 定义。
