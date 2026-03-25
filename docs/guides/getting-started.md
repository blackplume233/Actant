# Getting Started

当前仓库已经切到 ContextFS 的 Linux 术语基线。  
如果你是第一次进入这个仓库，不要从旧 CLI 功能、旧对象模型或旧迁移文案开始理解系统。

## Read This First

按以下顺序读取：

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `docs/design/contextfs-v1-linux-terminology.md`
4. `.trellis/spec/index.md`
5. `docs/design/contextfs-architecture.md`
6. `docs/design/actant-vfs-reference-architecture.md`
7. `docs/planning/roadmap.md`
8. `docs/planning/workspace-normalization-todo.md`

## What Is Current

当前有效基线只有一套：

- 产品层：`ContextFS`
- 实现层：`VFS`
- 核心对象：`mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- V1 必要 `filesystem type`：`hostfs`、`runtimefs`
- V1 必要 `node type`：`directory`、`regular`、`control`、`stream`
- V1 操作面：`read`、`write`、`list`、`stat`、`watch`、`stream`

## What Is Not Current

以下内容不应再当作当前实现方向：

- 旧 `Source` / `SourceType` / `Trait` 作为主对象模型
- `Prompt` 作为一级核心对象
- `workflow` 作为 V1 顶层对象
- query/view mount
- overlay/fallback 行为实现

如果你需要理解历史术语、迁移背景或残留命名，去看历史材料，不要把这些内容当作默认入口。
