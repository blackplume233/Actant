# Terminology

> 本文档定义 ContextFS V1 的活跃术语真相。
> 当前主语义采用 Linux 风格命名；旧术语只允许出现在兼容说明或历史映射里。

---

## 1. Core Rule

同一个术语只应在一个主层级上承担核心语义：

- 产品层：系统是什么
- 配置层：系统如何声明
- 实现层：系统如何落地
- 消费层：系统如何被解释和使用

如果一个词已经在某层承担主语义，就不要在另一层把它复用成另一种核心概念。

---

## 2. Active Glossary

| Term | Layer | Definition | Not This |
|------|-------|------------|----------|
| `ContextFS` | Product | Actant 的对外模型名，表示面向 agent 的上下文文件系统 | 某个 daemon、某个包名 |
| `VFS` | Implementation | `ContextFS` 的实现内核，负责路径解析、挂载解析、节点分发、权限挂接 | 产品名、旧 source router |
| `mountfs` | Mount Implementation | 单一挂载类型的独立实现边界；通过稳定 SPI 向 `VFS` 提供 registration、node schema、handler 与 metadata | `VFS` kernel、本体 namespace、旧式 source registry |
| `daemon` | Runtime Host | 唯一运行时宿主与唯一组合根；负责装载 VFS 与内部运行机制 | UI 壳、bridge、产品打包层 |
| `bridge` | Runtime Edge | 通过 RPC 与 `daemon` 交互的入口层，例如 CLI、HTTP、TUI | 组合根、状态中心 |
| `Contracts Layer` | Monorepo Boundary | 单仓中的共享合同层，只承载 DTO / types / errors / 最小公共基础设施 | 业务真相源、组合根 |
| `VFS Stack` | Monorepo Boundary | 单仓中拥有文件系统真相的边界，当前主包是 `@actant/vfs` | 执行运行时、产品壳 |
| `AgentRuntime Stack` | Monorepo Boundary | 单仓中拥有执行真相与解释能力的边界，包含 `agent-runtime` 与 `domain-context` | VFS 真相源、产品壳 |
| `Surface Stack` | Monorepo Boundary | 单仓中对外暴露的薄包装/入口层，是唯一允许同时依赖 VFS 与 Runtime 的 stack | 新的真相源 |
| `core` | Package Taxonomy | 宿主与内核包层，包含 `shared`、`vfs`、`rpc-contracts`、`plugin-sdk`、`plugin-runtime`、`daemon-host` | feature capability 实现层 |
| `sdk` | Package Taxonomy | 面向 builtin / external plugin 的稳定可导入表面，只暴露 token、types、client helpers、builders | daemon side 真实实现 |
| `support` | Package Taxonomy | 主要给 builtin plugin 复用的实现积木层 | 对外稳定 capability contract |
| `plugins` | Package Taxonomy | daemon 内实际装载的 capability 实现层 | 宿主层、bridge 层 |
| `bridges` | Package Taxonomy | CLI / HTTP / Dashboard / MCP 等对外入口壳层 | 宿主与真相源 |
| `third-party` | Package Taxonomy | 外部插件开发、安装、兼容、审核、物化所在层 | runtime host、plugin capability 本身 |
| `app` | Package Taxonomy | 打包、分发与产品壳 | 组合根 |
| `plugin family` | Logical Grouping | 一个 capability family 的逻辑归属；可横跨 `sdk`、`support`、`plugins`、`third-party` 多个包 | 新的物理目录层、运行时宿主 |
| `builtin plugin` | Runtime Module | 由仓库内实现、由 `daemon` 装载的 capability plugin；与 third-party plugin 共用宿主协议 | bridge feature、独立宿主 |
| `agent-runtime` | Builtin Plugin Capability | 被 `daemon` 装载的运行机制 capability；负责 agent 生命周期、执行状态与 runtime integration | 组合根、VFS 真相源、对外公共实现入口 |
| `domain-context` | Agent Domain Layer | 归属 `AgentRuntime Stack` 的领域包，负责 parser / schema / validator / loader / permission compilation 与本地 authoring helper | VFS 真相源、系统状态中心 |
| `acp` | Protocol Adapter | agent-runtime / daemon 使用的协议与 transport 模块，用于 ACP 会话、gateway、callback、VFS interception | 独立宿主、组合根 |
| `pi` | Backend Package | 被 `agent-runtime` backend 体系消费的后端包，提供 builder / communicator / bridge 适配 | 系统中心层 |
| `mount namespace` | Implementation | 当前调用上下文可见的完整路径视图 | 权限系统、业务解释器 |
| `mount table` | Config / Impl | 挂载点到挂载实例的映射表 | 下层 backend、本体资源树 |
| `filesystem type` | Config / Impl | 一类文件系统实现的定义，决定实例化方式、能力上界、生命周期语义 | 业务资源分类 |
| `mount instance` | Config / Runtime | 某个文件系统类型的具体挂载实例，向命名空间暴露一棵子树 | 单个文件、业务对象 |
| `mountfs package` | Monorepo Boundary | 单一挂载类型的独立实现包，推荐命名为 `@actant/mountfs-*` | 新的 kernel、跨类型中心化平台层 |
| `mount point` | Config | 某个挂载实例接入命名空间的路径前缀 | 挂载实例本体 |
| `node` | Implementation | VFS 中可被寻址、读写、列举、观察、流式消费的统一对象 | 必然落盘的真实文件 |
| `node type` | Implementation | 节点的语义种类 | 业务用途分类 |
| `directory node` | Node | 可列举子节点的目录对象 | 普通配置节点 |
| `regular node` | Node | 表示稳定快照内容的普通文件对象 | 业务对象类型 |
| `control node` | Node | 向其写入会触发控制或执行语义的特殊节点 | 独立 invoke API |
| `stream node` | Node | 由生产者持续输出有序 chunk 的特殊节点 | 普通静态文件 |
| `capability` | Cross-cutting | 某个节点支持的具体操作，例如 `read`、`write`、`list`、`stat`、`watch`、`stream` | 权限规则 |
| `permission` | Cross-cutting | 当前 caller 能否执行某个 capability | 节点天然能力 |
| `metadata` | Cross-cutting | 节点或挂载的附加描述信息，类似 xattr | 新的核心对象体系 |
| `tag` | Cross-cutting | 面向 consumer 的轻量用途标记 | 内核对象类型 |
| `consumer` | Outside VFS | 读取并解释节点用途的外部程序或组件 | VFS 内核自身 |
| `backend` | Implementation | 节点背后的真实实现，负责读写、观察和流输出 | 顶层产品对象 |
| `manager` | Local Collection | 局部 mutable collection 或 authoring helper，用于目录加载、校验、缓存与本地写路径 | 系统中心注册表 |
| `index` | Support Layer | 为查询或匹配提供辅助结构的数据索引 | 运行时真相源 |
| `cache` | Support Layer | 可重建的性能优化副本 | 权威状态 |
| `view` | Read Model | 面向消费侧的派生读取视图 | 可写中心真相 |

---

## 3. Required Node Types

V1 当前只承认以下 `node type`：

- `directory`
- `regular`
- `control`
- `stream`

`symlink` 允许作为保留值存在，但不属于 V1 必交付项。

关键约束：

- `control node` 先是节点种类，再谈 capability
- `stream node` 先是节点种类，再谈 capability
- `skill`、`prompt`、`sql`、`config` 都不是 `node type`

---

## 4. Required Mount And Filesystem Types

V1 当前只承认以下 `mount type`：

- `root`
- `direct`

V1 当前只承认以下 `filesystem type`：

- `hostfs`
- `runtimefs`

后续扩展如 `gitfs`、`dbfs` 只允许在 design/spec 中作为预留扩展出现，不进入当前交付承诺。

---

## 5. Interpretation Boundary

VFS 只负责：

- 路径规范化
- 挂载解析
- 节点分发
- capability 检查
- permission 挂接

VFS 不负责：

- 判断某个普通文件是不是 skill
- 判断某个 `.md` 是 prompt 还是配置模板
- 内容嗅探
- 业务语义分类

这些都属于 `consumer interpretation`。

运行时宿主边界：

- `daemon` 负责装载系统
- `bridge` 只负责 RPC 交互
- `agent-runtime` 只是被 `daemon` 装载的 builtin plugin capability
- `domain-context` 属于 `AgentRuntime Stack`
- `acp` 是协议/transport 模块，不能越级成为宿主层
- `pi` 是 backend package，必须通过 `agent-runtime` / `daemon` 进入系统
- `consumer` 可以依赖 `VFS`，但不能替代 `daemon` 成为组合根
- `plugin family` 只表达能力归属，不替代 `sdk` / `support` / `plugins` / `third-party` 这些物理层级
- builtin plugin 之间的稳定复用面应命名并下沉到 `sdk` 或 `support`
- third-party plugin 的开发与安装治理属于 `third-party`，不是 runtime host

---

## 6. Legacy Mapping

以下旧术语不再作为当前真相，但允许在兼容说明中出现：

| Legacy Term | Current Meaning |
|-------------|-----------------|
| `SourceType` | `filesystem type` |
| `Source` | 历史统称；当前应按上下文收敛为 `mountfs` 或 `mount instance`，不得继续作为主术语 |
| `Source 配置` | `mount table declaration` |
| `App 负责装载系统` | `daemon` 才是唯一组合根；`actant` 只是打包层 |
| `actant.project.json` | 迁移期遗留配置文件名；不属于当前运行时入口 |
| `Prompt` | 普通文件的一种 consumer interpretation |
| `SkillSource` / `McpConfigSource` / `McpRuntimeSource` / `AgentRuntimeSource` | 某些内置 mountfs / mount instance 家族的历史名称 |

规则：

- 活跃文档不得继续把这些旧词当主术语
- 新 CLI / 新文档 / 新接口说明必须只用当前术语
- 兼容输入允许保留，但默认输出不得继续外显旧词
