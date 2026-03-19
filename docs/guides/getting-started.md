# Getting Started

当前仓库处于 ContextFS 文档基线重置阶段。  
如果你是第一次进入这个仓库，不要从旧 CLI 功能、旧站点文案或历史设计稿开始理解系统。

## Read This First

按以下顺序读取：

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `.trellis/spec/index.md`
4. `docs/design/contextfs-architecture.md`
5. `docs/design/actant-vfs-reference-architecture.md`
6. `docs/planning/contextfs-roadmap.md`

## What Is Current

当前有效基线只有一套：

- 产品层：`ContextFS`
- 实现层：`VFS Kernel`
- 核心对象：`Project`、`Source`、`Capability`
- V1 内置 Source：`SkillSource`、`McpConfigSource`、`McpRuntimeSource`、`AgentRuntime`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`

## What Is Not Current

以下内容不应再当作当前实现方向：

- `workflow` 作为 V1 顶层对象
- query/view mount
- overlay/fallback 行为实现

如果你需要理解历史术语、迁移背景或残留命名，去看历史材料，不要把这些内容当作默认入口。

## Practical Rule

如果你读到的文档与上述基线冲突：

1. 先检查该文件是否在 `trash/`
2. 若不在 `trash/`，视为文档污染并应被清理
