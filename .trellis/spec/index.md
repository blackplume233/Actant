# Actant Specifications

> 核心原则：文档、契约、接口、配置先于实现。
> 当前基线：先完成 ContextFS 文档重置，再进入代码实现。

---

## 当前规范基线

Actant 当前只承认一套新的顶层叙述：

- 产品层：`ContextFS`
- 实现层：`VFS Kernel`
- 核心对象：`Project`、`Source`、`Capability`
- 首批内置 Source：`SkillSource`、`McpConfigSource`、`McpRuntimeSource`、`AgentRuntime`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`

以下旧基线已废弃，不再作为实现依据：

- `ContextManager` 作为平台顶层
- `DomainContext` 作为聚合中心
- `ContextSourceType` 作为核心分类真相
- 旧 source-centric VFS 作为最终架构
- `workflow` 作为 V1 顶层对象

---

## 强制流程

```text
需求 -> spec/design/roadmap -> 类型/契约 -> 实现 -> 测试 -> 审查
```

当前阶段额外约束：

- 先重写 spec/design/roadmap
- 再进入实现
- 与新基线冲突的旧文档必须删除或明确废弃
- 不允许双重真相并存

---

## 推荐阅读顺序

1. [愿景](./vision.md)
2. [术语表](./terminology.md)
3. [ContextFS Architecture](../../docs/design/contextfs-architecture.md)
4. [Actant VFS Reference Architecture](../../docs/design/actant-vfs-reference-architecture.md)
5. [配置规范](./config-spec.md)
6. [接口契约](./api-contracts.md)
7. [后端指南](./backend/index.md)
8. [ContextFS Roadmap](../../docs/planning/contextfs-roadmap.md)

---

## 文档分层

### 1. Vision

定义：

- Actant 是什么
- 长期方向是什么
- 为什么收敛到 ContextFS

入口：

- [vision.md](./vision.md)

### 1.5 Terminology

定义：
- 哪些词属于哪个层级
- 哪些命名应保留
- 哪些旧术语只允许作为废弃参考出现

入口：
- [terminology.md](./terminology.md)

### 2. Design

定义：

- ContextFS 产品层对象模型
- VFS Kernel 实现层边界

入口：

- [ContextFS Architecture](../../docs/design/contextfs-architecture.md)
- [Actant VFS Reference Architecture](../../docs/design/actant-vfs-reference-architecture.md)

### 3. Spec Contracts

定义：

- 配置结构
- 文件式操作面
- 路径约定
- 权限与边界

入口：

- [config-spec.md](./config-spec.md)
- [api-contracts.md](./api-contracts.md)

### 4. Implementation Guides

定义：

- 后端如何按新基线实现

入口：

- [backend/index.md](./backend/index.md)
- [frontend/index.md](./frontend/index.md)

---

## 审查要求

任何后续实现或设计变更，审查时必须确认：

- 是否仍遵守 `ContextFS` / `VFS Kernel` 的层次分工
- 是否重新引入了旧 `ContextManager` / `DomainContext` 叙事
- 是否把 `workflow`、query view、兼容层偷偷带回 V1
- 是否在 spec、design、roadmap 三层同步修改
