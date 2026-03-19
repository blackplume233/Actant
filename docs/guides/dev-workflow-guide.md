# Development Workflow Guide

当前开发流程只保留一条硬约束：

```text
spec / design / roadmap -> contract -> implementation -> verification
```

## Current Workflow

1. 先确认当前真相入口：
   - `README.md`
   - `PROJECT_CONTEXT.md`
   - `.trellis/spec/index.md`
   - `docs/design/contextfs-architecture.md`
   - `docs/design/actant-vfs-reference-architecture.md`
   - `docs/planning/contextfs-roadmap.md`
2. 若要改核心模块，先做 impact 分析
3. 若涉及对象模型、路径、权限、生命周期或操作面，先改文档，再改代码
4. 如果发现旧模型文件仍在活跃区，先清理污染，再继续实现

## Non-Goals For Current Stage

当前不允许把以下内容重新带回主线：

- `workflow` 作为 V1 顶层对象
- 兼容层优先
- 保留多份互相冲突的架构文档

历史迁移说明只应保留在 `docs/history/legacy-architecture-transition.md` 或 `trash/`，不应重新进入默认开发入口。

## Source Of Truth

更详细的开发约束以 `.trellis/workflow.md` 为准。  
如果本文件与 spec/design/roadmap 冲突，以后者为准。
