# Terminology

> 本文档定义 ContextFS 基线下的统一术语边界。  
> 它不重复 design/spec 的完整内容，只负责约束命名，避免不同层级对同一个词赋予冲突含义。

---

## 1. Rule

同一个术语只应在一个主层级上承担核心语义：

- 产品层：系统"是什么"
- 配置层：系统"如何声明"
- 实现层：系统"如何落地"
- 运行时层：系统"如何被消费与暴露"

如果一个词已经在某层承担主语义，就不要在另一层把它复用成另一种核心概念。

---

## 2. Glossary

| Term | Layer | Definition | Not This | Use When |
|------|-------|------------|----------|----------|
| `ContextFS` | Product | Actant 的对外模型名，表示面向 Agent 的上下文文件系统 | `VFS Kernel`、某个 daemon、某个 package | 讲产品定位、对象模型、平台语义时 |
| `VFS Kernel` | Implementation | `ContextFS` 的实现内核，负责 namespace、mount、middleware、node/backend、metadata、lifecycle、events | 产品名、Source 集合、旧 source router | 讲内核分层和执行路径时 |
| `Resource` | Abstract | 一切可被寻址、操作、授权、观察、流式消费的统一对象总称 | 仅限真实磁盘文件 | 需要泛指"被管理对象"时 |
| `Project` | Product | 编排单元、权限边界、生命周期边界，也是 VFS 中的投影上下文 | `Source`、workspace 目录 | 讲 mounts、permissions、children 时 |
| `ProjectManifest` | Config | `Project` 的声明结构，定义 mounts、permissions、children | 运行时对象、全局管理器 | 讲配置入口和装载规则时 |
| `SourceType` | Product / Impl | 带逻辑的 Source 类型定义，封装传输策略、认证方式、配置 schema 和实例化工厂；每个 SourceType 自定义配置结构 | `Source` 实例、`Backend`、旧 `VfsSourceType` | 讲"怎么拿资源"、新增传输类型时 |
| `Source` | Product | `SourceType` 的实例，可被挂载的资源边界单位，对外暴露一棵资源子树，声明自身具备的 `Trait` 集合 | `SourceType`（类型定义）、`Backend`、`Registry` | 出现在 `Project.mounts`、路径树所有权时 |
| `Trait` | Cross-cutting | Source 声明的原子能力特征（如 `persistent`、`watchable`、`streamable`、`writable`、`virtual`、`executable`），上层通过 required/optional trait 约束 Source 而非检查名义类型标签 | 名义类型标签（旧 `VfsSourceType`）、权限规则 | 讲 Source 本质特征、约束匹配时 |
| `Capability` | Cross-cutting | 资源或 Source 支持的具体操作，例如 `read`、`write`、`watch`、`stream` | `Trait`（本质特征）、权限规则 | 讲"支持什么操作"时 |
| `Mount` | Config / Impl | 将某个 `Source` 接到某个路径前缀上的声明或动作 | `Source` 本体、namespace | 讲 direct mount、路径归属时 |
| `Namespace` | Implementation | 路径和标识符规范化层，把外部 path/uri 规约成 canonical request | mount、权限系统、资源树本体 | 讲路径解析和 canonicalization 时 |
| `Node` | Implementation | 内核可操作的资源节点抽象，是 `stat/readDir/readFile/writeFile/watch/stream` 的直接承载体 | `Source`、必然落盘的文件 | 讲 node contract、内核对象时 |
| `Backend` | Implementation | `Node` 背后的真实资源访问实现，负责读写、观察和流输出 | `Source`、权限判定器 | 讲 `VfsBackend` 一类实现接口时 |
| `Provider` | Internal Impl | 为 Source、Backend 或 Runtime 提供实例、连接、数据来源的内部供给者 | 对外顶层对象 | 讲内部适配、实例供给、连接来源时 |
| `Agent` | Runtime Resource | 最复杂的一类资源，既消费上下文，也暴露上下文，还可能带执行与流能力 | 平台唯一中心、仅是进程 | 讲资源视角下的 Agent 时 |
| `AgentRuntime` | Product / V1 Source | 暴露 `/agents/*` 运行时资源的内置 Source | 全部 Agent 概念的总称 | 讲 V1 内置 Source 时 |
| `Tool` | Runtime Resource | 带执行或流能力的文件式资源，不再单独构成顶层系统 | 独立 tool registry | 讲执行型资源而非第二套平台时 |
| `Control Node` | Runtime Path | 通过 `write` 触发执行的控制节点 | 独立 invoke API | 讲执行请求入口时 |
| `Stream Node` | Runtime Path | 通过 `stream` 消费持续输出的节点 | 普通静态文件 | 讲执行输出和长连接消费时 |
| `Session` | Sub-resource | 某个 Agent 或 Project 下的运行期交互子资源 | 顶层对象、平台中心 | 讲资源的子资源层级时 |
| `Conversation` | Sub-resource | 面向人类语义的对话子资源，可视为 `Session` 的一种视图或别名 | 独立核心对象 | 需要更偏交互语义时 |
| `L0 Kernel Core` | Change Impact | dispatch、mount 路由、path 规范化、node 适配、middleware 契约——变更需最高审慎 | 一般 Source 实现 | 判断变更影响层级时 |
| `L1 Infrastructure` | Change Impact | 内置 middleware、注册中心、工厂注册、权限管理、生命周期管理 | Kernel 核心 | 判断变更影响层级时 |
| `L2 Orchestration` | Change Impact | ContextFS 编排层、ProjectManifest、Source 挂载投影 | 具体 Source handler | 判断变更影响层级时 |
| `L3 Business` | Change Impact | Source 实现、handler 逻辑、具体资源的路径解析与读写 | 框架层代码 | 判断变更影响层级时 |
| `L4 Types` | Change Impact | 共享类型定义、契约接口（`shared/src/types/`） | 具体实现代码 | 判断类型契约变更时 |
| `Thin Kernel` | Design Principle | 框架层只做分派和挂接、业务语义靠约定和协议表达的方法论承诺（见 contextfs-architecture.md 4.5） | 功能代码膨胀到框架层 | 审查框架层变更时 |

---

## 3. Boundary Rules

### 3.1 `SourceType` vs `Source`

`SourceType` 是带逻辑的类型定义：

- 封装传输策略（git clone、p4 sync、fs read）
- 自定义配置结构（不依赖中心化 discriminated union）
- 提供实例化工厂

`Source` 是 `SourceType` 的实例：

- 会出现在 `Project.mounts`
- 会成为 `/skills`、`/agents` 这类路径树的拥有者
- 会被用户或 Agent 理解为资源边界
- 声明自身具备的 `Trait` 集合

### 3.2 `Trait` vs `Capability`

`Trait` 描述 Source 的本质特征——它"是什么"：

- `persistent`：数据跨重启存活
- `ephemeral`：数据随生命周期消亡
- `watchable`：支持变更通知
- `streamable`：支持流式读取
- `writable`：支持写入
- `virtual`：无物理后端，纯计算生成
- `executable`：含可触发执行的控制节点
- `versioned`：有版本控制语义
- `searchable`：支持搜索

`Capability` 描述具体操作——它"能做什么"：

- `read`、`write`、`list`、`stat`、`watch`、`stream`

上层通过 `Trait` 做约束匹配（required/optional），Kernel 通过 `Capability` 做操作分派。两者正交。

### 3.3 `Source` vs `Provider`

`Provider` 仍保留为内部实现术语：

- 为 Source、Backend 或 Runtime 提供实例、连接、数据来源
- 不直接成为挂载目标
- 不进入产品对象模型

结论：

- 外部模型使用 `SourceType` + `Source`
- 内部适配层可使用 `Provider`

### 3.4 `Project` vs `Source`

`Project` 负责：

- 编排
- 权限边界
- 子 Project 收窄
- `/_project.json` 投影

`Source` 负责：

- 资源子树边界
- 文件式接口暴露
- trait + capability 组合

所以 `Project` 不是 `Source`。

### 3.5 `Capability` vs Permission

`Capability` 表示资源"支不支持某种操作"。  
Permission 表示当前 caller"能不能执行该操作"。

推荐顺序：

1. `Project` 判断权限
2. `Source` / `Backend` 判断 capability 是否支持

### 3.6 `Node` vs File

`Node` 是统一文件式接口下的内核节点抽象。  
它可以映射为：

- 静态内容
- 控制面
- 流
- 运行时状态
- 虚拟投影

不要把 `Node` 等同于真实文件落盘。

### 3.7 `Tool` vs System

`Tool` 在当前基线中不是独立顶层系统。  
它应被吸收到 Resource 模型里，作为带执行或流能力的文件式资源来表达。

---

## 4. Recommended Names

### Keep

- `ContextFS`
- `VFS Kernel`
- `Project`
- `ProjectContext`
- `ProjectManifest`
- `SourceType`
- `Source`
- `Trait`
- `Capability`
- `Mount`
- `Namespace`
- `Node`
- `Backend`
- `AgentRuntime`

### Avoid As Current Truth

- `ContextManager`
- `DomainContext`
- `ContextSourceType`
- `VfsSourceType`（旧名义类型标签，已被 `Trait` 替代）
- `bootstrap` 作为当前活跃概念
- `workflow` 作为 V1 顶层对象
- `tool registry` 作为平台中心

### Deprecated Term: `bootstrap`

`bootstrap` 不再是当前基线下允许自由扩散的活跃概念。

使用替代口径：

- 项目上下文装载 / 只读预备态：`context`
- 仓库或环境准备：`setup`
- 从声明式项目上下文恢复认知：`project-context discovery`

允许保留 `bootstrap` 的范围仅限：

- 明确标注为历史引用的文档
- archive / history / trash
- 兼容性别名输入或迁移说明

禁止在活跃 spec / workflow / roadmap / command docs / 用户可见 CLI 文案中继续把 `bootstrap` 当作当前能力名、流程名、profile 名或推荐术语。

---

## 5. Practical Usage

### Product Docs

优先使用：

- `ContextFS`
- `Project`
- `SourceType`
- `Source`
- `Trait`
- `Capability`

### Config Docs

优先使用：

- `ProjectManifest`
- `MountDeclaration`
- `PermissionConfig`

### Kernel Docs

优先使用：

- `VFS Kernel`
- `Namespace`
- `Mount`
- `Node`
- `Backend`

### Runtime Docs

优先使用：

- `AgentRuntime`
- `ProjectContext`
- `Control Node`
- `Stream Node`
- `Session`

---

## 6. Review Checklist

审查任何新文档或新命名时，至少确认：

1. 这个词属于哪个层级
2. 它是否在另一层已有不同含义
3. 它是否会把 `SourceType`、`Source`、`Provider`、`Backend` 混成一层
4. 它是否会重新引入旧 `ContextManager` / `DomainContext` 叙事
5. 它是否会把 `workflow` 偷偷带回 V1 顶层对象
6. 它是否使用了旧 `VfsSourceType` 名义标签而非 `Trait` 声明
7. 变更是否违反 Thin Kernel 原则——框架层代码量增加了但没有等量的具体逻辑被下沉
8. 变更是否引入了新的 discriminated union 或 switch-case 分派（应优先用注册表或接口替代）
9. 变更影响层级（L0–L4）是否已标注，且审查要求是否与层级匹配
