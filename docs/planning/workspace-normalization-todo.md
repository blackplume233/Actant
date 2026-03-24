# Workspace Normalization To-Do

> Active post-freeze cleanup checklist.
> Scope: keep active docs, help surfaces, and workspace narratives aligned with the frozen ContextFS V1 boundary model.
> Related: [ContextFS V1 技术设计文档（Linux 术语版）](../design/contextfs-v1-linux-terminology.md), [ContextFS Architecture](../design/contextfs-architecture.md), [Actant VFS Reference Architecture](../design/actant-vfs-reference-architecture.md), [Product Roadmap](./roadmap.md), [Pre-Stack-Freeze Roadmap Archive](../history/contextfs-roadmap-pre-stack-freeze.md)

## Freeze Baseline

- [x] Linux 术语是唯一活跃对象模型
- [x] `ContextFS` / `VFS` 的产品层与实现层分工已固定
- [x] hosted runtime 边界固定为 `bridge -> RPC -> daemon`
- [x] hosted implementation 链固定为 `daemon -> runtime integration -> VFS`
- [x] `domain-context` / `manager` 角色已锁定，不再作为竞争性的架构中心
- [x] repo-level planning truth 只在 [Product Roadmap](./roadmap.md) 维护

## P0 Truth Sources

- [x] [docs/design/contextfs-v1-linux-terminology.md](../design/contextfs-v1-linux-terminology.md) 仍是 Linux 术语主设计文档
- [x] [.trellis/spec/terminology.md](../../.trellis/spec/terminology.md) 使用 Linux 语义核心术语
- [x] [docs/design/contextfs-architecture.md](../design/contextfs-architecture.md) 固定产品层对象与 `domain-context` / `manager` 角色边界
- [x] [docs/design/actant-vfs-reference-architecture.md](../design/actant-vfs-reference-architecture.md) 固定 kernel 层与 hosted 边界规则
- [x] [docs/planning/roadmap.md](./roadmap.md) 维护当前 planning 入口与 repo-level planning state
- [x] 增加 active doc guardrail，扫描把 `runtime integration` / `provider` / `manager` 写成 V1 核心对象的回流

## P1 Planning And Workspace Governance

- [x] [docs/planning/roadmap.md](./roadmap.md) 已改成 active planning entry，并指向当前 cleanup backlog 与历史归档
- [x] 审核 [README.md](../../README.md) 与 [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md)，确认不出现 freeze 边界漂移
- [x] 审核 [.trellis/workspace/index.md](../../.trellis/workspace/index.md) 与 [.trellis/workspace/cursor-agent/index.md](../../.trellis/workspace/cursor-agent/index.md)，清理 pre-freeze 叙事
- [ ] 把 workspace journal 中仍有价值的边界决策迁移到正式文档，而不是继续依赖隐式会话上下文

## P2 External Surfaces

- [x] 审核 CLI / RPC / REST / site 文案，确保 hosted 路径稳定描述 `bridge -> RPC -> daemon`
- [x] 审核 runtime / guide 文案，确保 `runtime integration` / `provider` 只作为内部实现角色出现
- [ ] 在帮助文本或接口文档中补足 `control node` / `stream node` 的稳定解释

## P3 Validation And Guardrails

- [x] 增加术语 grep 检查，防止旧边界叙事回流到活跃文档
- [ ] 增加链接检查，确保默认入口都指向 freeze 后的 terminology / architecture / roadmap 集合
- [x] 增加边界文案回归检查，防止 hosted/runtime 文档再出现第二套 public contract

## Exit Criteria

- [x] 活跃文档不再把 `runtime integration` / `provider` / `domain-context` / `manager` 提升为竞争性的核心对象层
- [x] hosted-process 文档一致描述 `bridge -> RPC -> daemon`
- [x] VFS-facing 文档一致描述 `daemon -> runtime integration -> VFS` 是实现链，而不是第二套产品对象模型
- [x] README、workspace 文档、guides 与 help surfaces 不再偏离 freeze 基线
