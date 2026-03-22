# Workspace Normalization To-Do

> Active workspace cleanup checklist.
> Scope: entire working tree normalization under Linux terminology and ContextFS V1 mount/node model.
> Related: [ContextFS V1 技术设计文档（Linux 术语版）](../design/contextfs-v1-linux-terminology.md), [ContextFS Roadmap](./contextfs-roadmap.md)

## Goals

- [ ] 统一整个工作目录的活跃术语到 `mount namespace` / `mount table` / `filesystem type` / `mount instance` / `node type`
- [ ] 清理旧的资源分类叙事，避免把 consumer interpretation 重新提升为内核对象
- [ ] 建立单一真相源，避免 spec、design、workspace、README、CLI 文案继续分叉
- [ ] 为 M7 执行期提供一份可直接落地的工作目录整理清单

## P0 Truth Sources

- [ ] 将 [docs/design/contextfs-v1-linux-terminology.md](/Users/muyuli/Workspace/AgentCraft/docs/design/contextfs-v1-linux-terminology.md) 标记为 Linux 术语主设计文档
- [ ] 重写 [.trellis/spec/terminology.md](/Users/muyuli/Workspace/AgentCraft/.trellis/spec/terminology.md)，移除旧主语义并对齐 Linux 术语
- [ ] 重写 [docs/design/contextfs-architecture.md](/Users/muyuli/Workspace/AgentCraft/docs/design/contextfs-architecture.md)，用新总图覆盖旧叙事
- [ ] 重写 [docs/design/actant-vfs-reference-architecture.md](/Users/muyuli/Workspace/AgentCraft/docs/design/actant-vfs-reference-architecture.md)，固定 `mount namespace`、`mount type`、`filesystem type`、`node type`
- [ ] 让 [docs/planning/contextfs-roadmap.md](/Users/muyuli/Workspace/AgentCraft/docs/planning/contextfs-roadmap.md) 与新设计文档术语完全一致

## P1 Planning And Workspace Governance

- [ ] 更新 [docs/planning/roadmap.md](/Users/muyuli/Workspace/AgentCraft/docs/planning/roadmap.md) 的当前范围摘要，使其不再使用旧 M7 表述
- [ ] 更新 [.trellis/workspace/index.md](/Users/muyuli/Workspace/AgentCraft/.trellis/workspace/index.md)，把工作区当前焦点改为 mount/node 方案
- [ ] 审核 [.trellis/workspace/cursor-agent/index.md](/Users/muyuli/Workspace/AgentCraft/.trellis/workspace/cursor-agent/index.md)，删除旧对象模型描述
- [ ] 审核 [.trellis/workspace/cursor-agent/journal-1.md](/Users/muyuli/Workspace/AgentCraft/.trellis/workspace/cursor-agent/journal-1.md)，把仍有价值的决策迁移到正式文档
- [ ] 审核 [.trellis/workspace/cursor-agent/journal-2.md](/Users/muyuli/Workspace/AgentCraft/.trellis/workspace/cursor-agent/journal-2.md)，把仍有价值的决策迁移到正式文档
- [ ] 为 `.trellis/tasks/` 建立新的 M7 active task，不复用旧任务目录语义

## P2 Spec Contracts

- [ ] 重写 [.trellis/spec/config-spec.md](/Users/muyuli/Workspace/AgentCraft/.trellis/spec/config-spec.md)，把挂载配置改成 `mount table declaration`
- [ ] 在 [.trellis/spec/config-spec.md](/Users/muyuli/Workspace/AgentCraft/.trellis/spec/config-spec.md) 中固定根配置文件命名为 `actant.namespace.json`
- [ ] 重写 [.trellis/spec/api-contracts.md](/Users/muyuli/Workspace/AgentCraft/.trellis/spec/api-contracts.md)，统一引入 `node type`
- [ ] 在 [.trellis/spec/api-contracts.md](/Users/muyuli/Workspace/AgentCraft/.trellis/spec/api-contracts.md) 中固定 runtime 节点表面：
- [ ] `status.json` = `regular`
- [ ] `control/request.json` = `control`
- [ ] `streams/*` = `stream`
- [ ] 审核 [.trellis/spec/backend/index.md](/Users/muyuli/Workspace/AgentCraft/.trellis/spec/backend/index.md)，删除旧的资源分类叙事

## P3 Product And User-Facing Docs

- [ ] 更新 [README.md](/Users/muyuli/Workspace/AgentCraft/README.md)，把当前主线表述改为新的 M7 方案
- [ ] 更新 [PROJECT_CONTEXT.md](/Users/muyuli/Workspace/AgentCraft/PROJECT_CONTEXT.md)，把当前项目状态改成 `mount namespace` / `filesystem type` / `node type`
- [ ] 扫描 `docs/guides/`，清理把业务解释词提升为核心对象的文案
- [ ] 扫描 `docs/site/`，统一成 mounted subtree / node types / consumer interpretation 叙事
- [ ] 把仍有参考价值的旧迁移说明下沉到 `docs/history/`

## P4 Runtime And VFS Implementation Surfaces

- [ ] 在核心类型层引入 `node type` 枚举：`directory` / `regular` / `control` / `stream`
- [ ] 在核心类型层引入 `mount type` 枚举：`root` / `direct`
- [ ] 在核心类型层引入 `filesystem type` 枚举：`hostfs` / `runtimefs` / `memfs`
- [ ] 审核 `stat` / `describe` 返回结构，确保都能暴露 `node type`
- [ ] 拆出独立 `mount namespace` 解析层，避免解析逻辑混进挂载表或 backend
- [ ] 固定 `runtimefs` 子树结构，避免 runtime 继续旁路 VFS
- [ ] 保证普通读取路径不依赖常驻进程

## P5 CLI, RPC, UI, And External Surfaces

- [ ] 扫描 `packages/cli/src/commands/`，清理旧术语和旧对象模型文案
- [ ] 扫描 `packages/cli/src/output/`，统一展示 `mount point` / `filesystem type` / `node type`
- [ ] 扫描 `packages/rest-api/src/`，确保接口描述不再使用旧资源分类
- [ ] 扫描 `packages/dashboard/client/src/`，清理 UI 与 i18n 中的旧表述
- [ ] 为 CLI / RPC 帮助文本增加 `control node` 和 `stream node` 的稳定解释

## P6 Validation And Guardrails

- [ ] 增加术语 grep 检查，防止旧术语回流到活跃文档
- [ ] 增加类型检查，防止 `node type` 在公共接口里缺失
- [ ] 增加文档链接检查，确保真相源都指向 Linux 术语版设计文档
- [ ] 增加回归测试：
- [ ] direct mount 路径解析
- [ ] `runtimefs` 控制节点写入
- [ ] `runtimefs` 流节点消费
- [ ] 无常驻进程读取 `hostfs` / `memfs`

## Exit Criteria

- [ ] 活跃 spec / design / roadmap / workspace 文档全部改用 Linux 术语
- [ ] 当前 M7 的执行项全部以 `mount namespace` / `mount table` / `filesystem type` / `node type` 表述
- [ ] 用户可见入口不再把业务解释词当作内核对象
- [ ] 工作目录内不存在与新真相源冲突的活跃文档
