# Actant Specifications

> 核心原则：文档、契约、接口、配置先于实现。
> 当前基线：Linux 语义下的 ContextFS V1。

---

## 当前规范基线

Actant 当前只承认一套新的顶层叙述：

- 产品层：`ContextFS`
- 实现层：`VFS`
- 挂载实现层：`mountfs`
- 运行时宿主：`daemon`
- 交互入口：`bridge`
- 核心对象：`mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- V1 必要 `mount type`：`root`、`direct`
- V1 必要 `filesystem type`：`hostfs`、`runtimefs`
- V1 必要 `node type`：`directory`、`regular`、`control`、`stream`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`
- V1 边界：只实现当前 spec、design、roadmap 中明确列出的对象、路径约定与操作面

### 运行时基线

运行时结构统一采用以下口径：

- `daemon` 是唯一运行时宿主与唯一组合根
- `bridge` 只负责通过 RPC 与 `daemon` 交互
- `actant` 是打包层 / 分发层 / 产品壳，不是组合根
- 当前单仓按 `Contracts Layer`、`VFS Stack`、`AgentRuntime Stack`、`Surface Stack` 四层理解
- `Surface Stack` 是唯一允许同时依赖 `VFS Stack` 与 `AgentRuntime Stack` 的对外薄包装层
- `domain-context` 归属 `AgentRuntime Stack`
- 面向插件化治理时，仓库内额外按 `core / sdk / support / plugins / bridges / third-party / app` 七类包层理解

```mermaid
flowchart TB
    ACTANT["actant
打包层 / 分发层"]

    BRIDGE["Bridge
cli / rest-api / tui / dashboard / mcp-server / channel-*"]

    DAEMON["Actant Daemon
唯一运行时宿主 / 唯一组合根"]

    CONTRACTS["Contracts Layer
@actant/shared"]

    VFS["@actant/vfs
唯一核心 / 唯一真相源"]

    RUNTIME["AgentRuntime Stack
agent-runtime / domain-context / acp / pi / tui / channel-*"]

    ACTANT --> BRIDGE
    BRIDGE -. RPC .-> DAEMON
    DAEMON --> RUNTIME
    DAEMON --> VFS
    VFS --> CONTRACTS
    RUNTIME --> CONTRACTS
    RUNTIME --> VFS
```

### 冻结后的包拓扑

当前活跃仓库只保留下面这套包层级：

| 层级 | 保留包 | 固定职责 |
| --- | --- | --- |
| `Contracts Layer` | `@actant/shared` | 共享合同、错误、最小公共基础设施；不拥有业务真相 |
| `VFS Stack` | `@actant/vfs` | 唯一文件系统内核、唯一挂载/路径/节点真相源 |
| `MountFS Packages` | `@actant/mountfs-*` | 单一挂载类型的独立实现包；通过稳定 SPI 接入 `@actant/vfs` |
| `AgentRuntime Stack` | `@actant/agent-runtime`, `@actant/domain-context`, `@actant/acp`, `@actant/pi`, `@actant/tui`, `@actant/channel-*` | 运行时执行、解释、协议与集成能力 |
| `Surface Stack` | `@actant/api`, `@actant/cli`, `@actant/rest-api`, `@actant/dashboard`, `@actant/mcp-server`, `actant` | daemon 组合、CLI / HTTP / MCP / Dashboard / 分发壳等对外入口 |

### 插件化包层级

当实现向 daemon plugin 模型继续收口时，单仓包目录应按以下层级理解：

| 层级 | 作用 | 约束 |
| --- | --- | --- |
| `core` | 宿主与内核：`shared`、`vfs`、`rpc-contracts`、`plugin-sdk`、`plugin-runtime`、`daemon-host` | 不依赖 `plugins`、`bridges`、`third-party` |
| `sdk` | 面向 builtin / external plugin 的稳定可导入表面；只暴露 token、types、client helpers、builders | 不承载 daemon side 状态或 plugin 实现 |
| `support` | 主要给 builtin plugin 复用的实现积木，如 command/page/provider/handler helper | 不充当对外稳定 capability contract |
| `plugins` | daemon 内实际装载的 capability 实现；内置能力优先表达为 builtin plugin | 默认不作为其他包的公共实现入口 |
| `bridges` | `cli`、`rest-api`、`dashboard`、`mcp-server` 等对外入口壳 | 只消费 `daemon` 暴露的 contract / manifest / RPC |
| `third-party` | 外部插件开发、安装、兼容、审核与物化层 | 不是 runtime host，也不是 plugin capability 本身 |
| `app` | `actant` 分发壳与打包入口 | 不是组合根 |

额外约束：

- plugin family 是逻辑归属维度，不是新的物理目录层
- 同一个 family 可同时包含 `sdk`、`support`、`plugins`、`third-party` 中的多个包
- `sdk` / `support` 是否属于某个 family，不等于它们应被嵌套进 plugin 实现目录
- builtin plugin 间可复用代码应优先落在 `sdk` 或 `support`，而不是直接 import 彼此实现目录
- external / cross-repo plugin 只承诺依赖 `core` 的公开合同与 `sdk`
- `plugins` 中的实现若形成稳定复用面，必须显式提炼到 `sdk` 或 `support`
- `bridges` 不得直接依赖 `plugins` 实现包

过渡与清理结论固定如下：

| 状态 | 包 | 结论 |
| --- | --- | --- |
| `cleanup-target` | `@actant/context` | 本轮并入 `@actant/api` 并删除，不得新增任何 call site |
| `deleted` | `@actant/catalog`, `@actant/core`, `@actant/domain` | 已退出活跃边界，不得在 active docs/help/export 中复活 |

```mermaid
flowchart LR
    ACTANT["@actant/actant
打包层 / 分发层"]

    subgraph BRIDGE["Bridge Packages"]
      CLI["@actant/cli"]
      REST["@actant/rest-api"]
      DASH["@actant/dashboard"]
      MCP["@actant/mcp-server"]
    end

    subgraph SURFACE["Surface Stack"]
      API["@actant/api"]
      CLI2["@actant/cli"]
      REST2["@actant/rest-api"]
      DASH2["@actant/dashboard"]
      MCP2["@actant/mcp-server"]
      APP["@actant/actant"]
    end

    subgraph CONTRACTS["Contracts Layer"]
      SHARED["@actant/shared"]
    end

    subgraph VFSSTACK["VFS Stack"]
      VFS["@actant/vfs"]
    end

    subgraph RUNTIME["AgentRuntime Stack"]
      DC["@actant/domain-context"]
      AR["@actant/agent-runtime"]
      ACP["@actant/acp"]
      PI["@actant/pi"]
      TUI["@actant/tui"]
      CHAN["@actant/channel-*"]
    end

    ACTANT --> BRIDGE
    BRIDGE --> API
    API --> VFS
    API --> AR
    AR --> VFS
    AR --> DC
    AR --> ACP
    AR --> PI
    API --> DC
    BRIDGE --> SHARED
    TUI --> AR
    CHAN --> AR
```

### `actant` 最小职责边界

`@actant/actant` 只允许承担以下职责：

- 打包产物入口与产品分发壳
- 对外聚合已冻结的 bridge / shell 能力
- 不得成为组合根
- 不得重新导出已删除的 `core` / `catalog` / `domain` 旧入口
- 不得持有 runtime state、mount table 或 VFS kernel

---

## 强制流程

```text
需求 -> spec/design/roadmap -> 类型/契约 -> 实现 -> 测试 -> 审查
```

当前阶段额外约束：

- 先收敛真相源，再进入实现
- 活跃文档必须使用 Linux 术语
- 历史迁移说明必须留在默认入口之外
- `daemon` 是唯一运行时组合根，bridge 层不得二次装配系统
- `agent-runtime` 只是由 `daemon` 装载的 builtin plugin capability，不是中心层或组合根
- `Surface Stack` 只是组合层，不得成为新的真相源
- `mountfs` 是唯一允许承载具体挂载类型实现的活跃术语；`source` 不再是活跃架构概念
- `packages/vfs` 的 core 骨架必须保持在 `facade / kernel / mount / path / node / permission / lifecycle / storage / index / filesystem type SPI`
- 后续新增挂载类型必须优先实现为 `@actant/mountfs-*` 包，不得继续新增 `packages/vfs/src/sources/*`
- `@actant/context` 是清退目标，不得新增任何导入
- plugin 复用优先顺序固定为 `core contracts -> sdk -> support -> plugin implementation`
- `third-party` 只负责开发、安装、兼容与审核，不得被写成第二宿主层
- 所有 ship / merge 级交付必须先产出 changelog draft，再汇总正式 release changelog
- 活跃 planning 真相只允许留在 `docs/planning/roadmap.md` 与 `docs/planning/workspace-normalization-todo.md` 这组 owner 文件中
- `actant.namespace.json` 是默认且唯一运行时 namespace 配置入口

### `mountfs` 基线

`mountfs` 是单一挂载类型的独立实现边界。

它负责：

- 某类 `mount instance` 的 registration 构造
- 该挂载对外暴露的 node schema / handler / metadata
- 该挂载对底层 host、runtime 或 virtual backend 的适配

它不负责：

- `mount namespace`
- `mount table`
- 全局 middleware / permission / lifecycle 框架
- 成为新的中心注册表或旧式 source router

边界规则：

- `@actant/vfs` 只承载内核与稳定 SPI
- `@actant/mountfs-*` 承载具体挂载类型实现
- `@actant/api` / `@actant/agent-runtime` 只负责装配 mountfs，不直接定义新的挂载实现模型
- mountfs 的实现 contract 以 [MountFS 实现规范](./mountfs-implementation-spec.md) 为权威接口文档

---

## 推荐阅读顺序

1. [Linux 术语设计文档](../../docs/design/contextfs-v1-linux-terminology.md)
2. [术语表](./terminology.md)
3. [ContextFS Architecture](../../docs/design/contextfs-architecture.md)
4. [Actant VFS Reference Architecture](../../docs/design/actant-vfs-reference-architecture.md)
5. [MountFS 实现规范](./mountfs-implementation-spec.md)
6. [配置规范](./config-spec.md)
7. [接口契约](./api-contracts.md)
8. [后端指南](./backend/index.md)
9. [Product Roadmap](../../docs/planning/roadmap.md)
10. [Workspace Normalization To-Do](../../docs/planning/workspace-normalization-todo.md)

---

## 审查要求

任何后续实现或设计变更，审查时必须确认：

- 是否仍遵守 `ContextFS` / `VFS` 的层次分工
- 是否仍遵守 `Contracts Layer / VFS Stack / AgentRuntime Stack / Surface Stack` 的单仓边界
- 是否把 consumer interpretation 重新写回 VFS 核心模型
- 是否把 `agent-runtime` 或 `domain-context` 重新写成系统中心层
- 是否把旧 `Source` / `Prompt` 术语重新写成当前真相
- 是否在 spec、design、roadmap 三层同步修改
- 是否把 planning 状态只维护在当前 owner 文件中，而没有把旧 `contextfs-roadmap.md` 重新当作活跃真相
