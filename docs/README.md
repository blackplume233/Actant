# Actant Documentation

> `docs/` 只保留当前可读的 ContextFS 基线文档。  
> 所有历史设计、历史指南、历史站点内容与阶段性快照都应移入仓库根目录 `trash/`，不再作为当前实现依据。

## Current Reading Order

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `.trellis/spec/index.md`
4. `.trellis/spec/terminology.md`
5. `docs/design/contextfs-architecture.md`
6. `docs/design/actant-vfs-reference-architecture.md`
7. `docs/planning/contextfs-roadmap.md`

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

其余历史设计如果仍有保留价值，也必须在 `trash/` 中查阅，而不是在活跃区查阅。

### `planning/`

当前规划入口：

- `roadmap.md`
- `contextfs-roadmap.md`

规则：

- 这两个活跃 roadmap 必须保持 checklist / todolist 结构
- 里程碑完成态、进行中、待开始、取消都要用显式 todo 标记表达
- 历史分析或回顾不要写回活跃 roadmap，转移到 `docs/history/` 或 `docs/agent/`

### `site/`

`docs/site/` 只是对外站点源文件，不是实现真相入口。  
站点内容必须与当前 ContextFS 基线保持一致；若未同步，应优先修正文档真相，再修站点文案。

### `stage/`

预留目录。当前不承载历史快照；历史快照统一进入 `trash/`。

### `reports/`

预留目录。一次性分析报告若失效，直接移入 `trash/`。

### `agent/`

AI 生成的审查记录和审计日志。仅作工作记录，不是当前架构真相。

### `human/`

人类手写笔记区。AI 不应将其当作当前架构规范来源，也不应自动写入。

## Current Rule

对一个新 Agent 来说，`trash/` 之外不应再出现与当前 ContextFS 基线冲突的“活跃文档”。  
如果发现冲突文件，默认处理方式是：

1. 不是当前真相入口：移入 `trash/`
2. 必须保留原路径：重写为最小正确版本
