# Terminology

> 本文档定义 ContextFS 基线下的统一术语边界。  
> 它不重复 design/spec 的完整内容，只负责约束命名，避免不同层级对同一个词赋予冲突含义。

---

## 1. Rule

同一个术语只应在一个主层级上承担核心语义：

- 产品层：系统“是什么”
- 配置层：系统“如何声明”
- 实现层：系统“如何落地”
- 运行时层：系统“如何被消费与暴露”

如果一个词已经在某层承担主语义，就不要在另一层把它复用成另一种核心概念。

---

## 2. Glossary

| Term | Layer | Definition | Not This | Use When |
|------|-------|------------|----------|----------|
| `ContextFS` | Product | Actant 的对外模型名，表示面向 Agent 的上下文文件系统 | `VFS Kernel`、某个 daemon、某个 package | 讲产品定位、对象模型、平台语义时 |
| `VFS Kernel` | Implementation | `ContextFS` 的实现内核，负责 namespace、mount、middleware、node/backend、metadata、lifecycle、events | 产品名、Source 集合、旧 source router | 讲内核分层和执行路径时 |
| `Resource` | Abstract | 一切可被寻址、操作、授权、观察、流式消费的统一对象总称 | 仅限真实磁盘文件 | 需要泛指“被管理对象”时 |
| `Project` | Product | 编排单元、权限边界、生命周期边界，也是 VFS 中的投影上下文 | `Source`、workspace 目录 | 讲 mounts、permissions、children 时 |
| `ProjectManifest` | Config | `Project` 的声明结构，定义 mounts、permissions、children | 运行时对象、全局管理器 | 讲配置入口和装载规则时 |
| `Source` | Product | 可被挂载的资源边界单位，对外暴露一棵资源子树 | `Provider`、`Backend`、`Registry` | 出现在 `Project.mounts`、路径树所有权时 |
| `Capability` | Cross-cutting | 资源或 Source 支持的能力 trait，例如 `read`、`write`、`watch`、`stream` | 资源类型、权限规则 | 讲“能做什么”时 |
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

---

## 3. Boundary Rules

### 3.1 `Source` vs `Provider`

如果一个对象：

- 会出现在 `Project.mounts`
- 会成为 `/skills`、`/agents` 这类路径树的拥有者
- 会被用户或 Agent 理解为资源边界

那它应命名为 `Source`。

如果一个对象：

- 只在内部供给实例、连接或数据来源
- 不直接成为挂载目标
- 不进入产品对象模型

那它应命名为 `Provider`。

结论：

- 外部模型保留 `Source`
- 内部实现可使用 `Provider`

### 3.2 `Project` vs `Source`

`Project` 负责：

- 编排
- 权限边界
- 子 Project 收窄
- `/_project.json` 投影

`Source` 负责：

- 资源子树边界
- 文件式接口暴露
- capability 组合

所以 `Project` 不是 `Source`。

### 3.3 `Capability` vs Permission

`Capability` 表示资源“支不支持某种操作”。  
Permission 表示当前 caller“能不能执行该操作”。

推荐顺序：

1. `Project` 判断权限
2. `Source` / `Backend` 判断 capability 是否支持

### 3.4 `Node` vs File

`Node` 是统一文件式接口下的内核节点抽象。  
它可以映射为：

- 静态内容
- 控制面
- 流
- 运行时状态
- 虚拟投影

不要把 `Node` 等同于真实文件落盘。

### 3.5 `Tool` vs System

`Tool` 在当前基线中不是独立顶层系统。  
它应被吸收到 Resource 模型里，作为带执行或流能力的文件式资源来表达。

---

## 4. Recommended Names

### Keep

- `ContextFS`
- `VFS Kernel`
- `Project`
- `ProjectManifest`
- `Source`
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
- `workflow` 作为 V1 顶层对象
- `tool registry` 作为平台中心

---

## 5. Practical Usage

### Product Docs

优先使用：

- `ContextFS`
- `Project`
- `Source`
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
- `Control Node`
- `Stream Node`
- `Session`

---

## 6. Review Checklist

审查任何新文档或新命名时，至少确认：

1. 这个词属于哪个层级
2. 它是否在另一层已有不同含义
3. 它是否会把 `Source`、`Provider`、`Backend` 混成一层
4. 它是否会重新引入旧 `ContextManager` / `DomainContext` 叙事
5. 它是否会把 `workflow` 偷偷带回 V1 顶层对象
