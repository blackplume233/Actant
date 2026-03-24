# Actant Documentation

> `docs/` 只保留当前可读的 ContextFS 基线文档。  
> 文档类历史材料统一归档到 `docs/history/`；非文档残骸或已删除实现可保留在仓库根目录 `trash/`。二者都不再作为当前实现依据。

## Current Reading Order

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `.trellis/spec/index.md`
4. `.trellis/spec/terminology.md`
5. `docs/design/contextfs-architecture.md`
6. `docs/design/actant-vfs-reference-architecture.md`
7. `docs/planning/roadmap.md`
8. `docs/planning/workspace-normalization-todo.md`

## Active Areas

### `guides/`

仅保留当前基线下仍有参考价值的最小指南：

- `ai-agent-usage-guide.md`
- `ai-agent-dev-guide.md`
- `getting-started.md`
- `dev-environment-setup.md`
- `dev-workflow-guide.md`

这些文件如果与 spec/design/roadmap 冲突，以后者为准。

### `design/`

当前只应把以下文件视为架构真相入口：

- `contextfs-architecture.md`
- `actant-vfs-reference-architecture.md`
- `channel-protocol.md`
- `channel-protocol/`

其余历史设计如果仍有保留价值，应迁入 `docs/history/`；已废弃实现残骸才进入 `trash/`。

### `planning/`

当前规划入口：

- `roadmap.md`
- `workspace-normalization-todo.md`

规则：

- `docs/planning/roadmap.md` 是当前 repo-level planning entry
- `docs/planning/workspace-normalization-todo.md` 是当前 cleanup backlog owner file
- `docs/planning/contextfs-roadmap.md` 只保留旧链接兼容，不再承载活跃进度或边界真相
- 活跃 planning 文档可以分工，但每一项状态必须有明确 owner 文件，不能在多个入口重复维护同一组 checklist
- 历史分析或回顾不要写回活跃 planning，转移到 `docs/history/` 或 `docs/agent/`

### `site/`

`docs/site/` 只是对外站点源文件，不是实现真相入口。  
站点内容必须与当前 ContextFS 基线保持一致；若未同步，应优先修正文档真相，再修站点文案。

### `stage/`

版本级 release changelog 汇总区，不是架构或 planning 真相入口。

### `reports/`

一次性分析报告若失效，优先移入 `docs/history/`；与已删除实现绑定的残骸才移入 `trash/`。

### `agent/`

AI 生成的审查记录和审计日志。仅作工作记录，不是当前架构真相。

### `human/`

人类手写笔记区。AI 不应将其当作当前架构规范来源，也不应自动写入。

## Current Rule

对一个新 Agent 来说，`docs/history/` 与 `trash/` 之外不应再出现与当前 ContextFS 基线冲突的“活跃文档”。  
如果发现冲突文件，默认处理方式是：

1. 不是当前真相入口的文档：移入 `docs/history/`
2. 不是当前真相入口的非文档残骸：移入 `trash/`
3. 必须保留原路径：重写为最小正确版本
