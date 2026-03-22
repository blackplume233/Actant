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
- V1 边界：只实现当前 spec、design、roadmap 中明确列出的对象、路径约定与操作面

---

## 强制流程

```text
需求 -> spec/design/roadmap -> 类型/契约 -> 实现 -> 测试 -> 审查
```

当前阶段额外约束：

- 先重写 spec/design/roadmap
- 再进入实现
- 历史迁移说明必须留在默认入口之外
- 不允许把历史迁移说明和当前规范并列为默认入口
- 所有 ship / merge 级交付必须先产出 changelog draft，再汇总正式 release changelog
- `docs/planning/` 下仍作为真相源的 roadmap 必须使用 checklist / todolist 主格式
- 项目进度标注必须只在一个活跃文件里做原子维护；当前唯一真相源为 `docs/planning/contextfs-roadmap.md`

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
- 哪些术语属于当前基线

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

### 3.5 Delivery Contracts

定义：

- `task.json` 最小字段契约：`id`、`name`、`title`、`status`、`dev_type`、`branch`、`base_branch`、`current_phase`、`createdAt`、`completedAt`
- changelog draft 交付契约：`docs/agent/changelog-drafts/`
- active roadmap 结构契约：`docs/planning/*.md` 使用 checklist/todolist
- 项目进度唯一文件契约：`docs/planning/contextfs-roadmap.md` 是唯一 live progress truth file

入口：

- [workflow.md](../workflow.md)
- [ContextFS Roadmap](../../docs/planning/contextfs-roadmap.md)
- [Product Roadmap](../../docs/planning/roadmap.md)

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
- 是否把迁移说明重新写回主线入口
- 是否把 `workflow`、query view、兼容层偷偷带回 V1
- 是否在 spec、design、roadmap 三层同步修改
- 是否保留了对应 changelog draft，并确保 release changelog 仍由 stage 汇总生成
- 是否把活跃 roadmap 保持为 checklist/todolist，而不是叙事式状态说明
- 是否把 live progress 只维护在 `docs/planning/contextfs-roadmap.md`，而没有在其他入口文件重复标注同一里程碑状态
