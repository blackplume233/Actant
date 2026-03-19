# 2026-03-19 Codex ContextFS 文档巡检报告

> 类型：全量巡检记录
> 作者：Codex
> 结论性质：审计意见，需要人类复核后作为后续治理依据

---

## 1. 巡检目标

本次巡检的目标不是继续实现 ContextFS，而是确认在完成第一轮文档基线重置后，仓库中还有哪些文档会继续污染新的 ContextFS / VFS Kernel 叙述。

本次关注的问题：

- 旧架构术语是否仍然大量残留
- 是否还有对已删除文档的引用
- 哪些文档仍然可能被误当作权威入口
- 哪些目录应纳入治理，哪些应只记录不清理

---

## 2. 巡检范围

扫描范围：

- `.trellis/spec`
- `docs/design`
- `docs/planning`
- `docs/guides`
- `docs/decisions`
- `docs/reports`
- `docs/agent`
- `docs/human`
- `docs/stage`
- `docs/wiki`
- 根文档：`README.md`、`PROJECT_CONTEXT.md`

特殊处理：

- `docs/wiki/node_modules/` 视为第三方依赖内容，排除出治理判断
- `docs/stage/` 视为版本快照，只记录不清理
- `docs/human/` 视为人类专属区域，只记录不主动改写

---

## 3. 文档规模盘点

按目录统计的 Markdown 文件数如下：

| 区域 | 数量 |
|------|------|
| `.trellis/spec` | 26 |
| `docs/design` | 42 |
| `docs/planning` | 5 |
| `docs/planning/archive` | 7 |
| `docs/guides` | 8 |
| `docs/decisions` | 2 |
| `docs/reports` | 2 |
| `docs/agent` | 1 |
| `docs/human` | 7 |
| `docs/stage` | 52 |
| `docs/wiki` | 23 |
| 其他根文档 | 3 |

结论：

- 当前真正需要治理的“活文档”主要集中在 `.trellis/spec`、`docs/design`、`docs/planning`、`docs/guides`、根文档
- `docs/stage` 与 `docs/wiki` 体量大，但不应按同一标准清理

---

## 4. 已完成的第一轮收口

本轮巡检开始前，以下主入口已经切换到新基线：

- `docs/planning/contextfs-roadmap.md`
- `docs/planning/roadmap.md`
- `docs/design/contextfs-architecture.md`
- `docs/design/actant-vfs-reference-architecture.md`
- `.trellis/spec/index.md`
- `.trellis/spec/vision.md`
- `.trellis/spec/config-spec.md`
- `.trellis/spec/api-contracts.md`
- `.trellis/spec/backend/index.md`

已删除的旧设计文档：

- `docs/design/context-first-multi-source-architecture.md`
- `docs/design/domain-context-extension-guide.md`
- `docs/design/domain-context-formats.md`
- `docs/design/actant-vfs-reference-architecture.zh-CN.md`

---

## 5. 关键发现

### A. 主入口层已收口，但外围活文档仍有大量旧术语

在排除 `docs/wiki/node_modules` 后，仍含旧术语的活跃文档集中在：

- `.trellis/spec/backend/context-injector.md`
- `.trellis/spec/backend/plugin-guidelines.md`
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/frontend/directory-structure.md`
- `.trellis/spec/guides/index.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`
- `docs/design/core-agent-config-roadmap.md`
- `docs/design/core-agent-progress-report.md`
- `docs/design/mvp-next-design.md`
- `docs/design/memory-layer-agent-evolution.md`
- `docs/planning/phase4-employee-steps.md`
- `docs/planning/phase4-plan.md`
- `docs/guides/ai-agent-dev-guide.md`
- 根 `README.md`
- `PROJECT_CONTEXT.md`

这些文件中的问题不一定都需要立刻删除，但它们已经不适合作为“当前架构真相”被直接引用。

### B. 已删除文档仍有残余引用

本轮修复后，活跃入口中的死链已基本清除。  
当前确认仍保留对已删除文档引用的主要位置是：

- `docs/wiki/features/extensibility.md`

说明：

- 该文件属于用户站点内容，不是当前开发权威入口
- 它仍然需要后续同步，但不应阻塞当前 ContextFS 文档基线

### C. `docs/README.md` 曾明显过时，但本轮已做最低限度修复

已完成修复：

- 删除已删除设计文档的索引项
- 增加 `contextfs-roadmap.md`
- 修正设计文档命名示例

剩余问题：

- 整体目录说明仍偏历史口径
- 需要后续再做一次结构性审阅

### D. 根 `README.md` 与 `PROJECT_CONTEXT.md` 仍然带有旧平台叙述

这两份文档仍然会让首次进入仓库的人获得偏旧的项目心智：

- `README.md` 仍然主要站在旧 Agent 平台叙述上
- `PROJECT_CONTEXT.md` 仍然使用“building, bootstrapping, and managing AI agents”表述，并继续暴露 `configs/workflows/`

这两份文件属于高影响入口，应列为下一轮文档治理优先项。

### E. 许多历史设计文档不该被删除，但必须降级

例如：

- `docs/design/acp-*`
- `docs/design/agent-launch-scenarios.md`
- `docs/design/subsystem-design.md`
- `docs/design/event-system-unified-design.md`
- `docs/design/plugin-memory-review-report.md`

这些文档仍有参考价值，但如果继续在入口索引里与 ContextFS 基线并列，会制造双重真相。

处理建议不是直接删除，而是：

- 加“历史/参考/非当前基线”声明
- 从主入口索引降级

### F. `docs/stage`、`docs/wiki`、`docs/human` 不应纳入同一清理标准

- `docs/stage`：只读版本快照，允许保留旧术语
- `docs/wiki`：生成物或面向用户站点，应该作为后续同步任务处理
- `docs/human`：AI 不应主动重写

这三类区域应记录，但不作为当前“文档污染未清理”的阻塞项。

---

## 6. 本轮已顺手修复的问题

本轮巡检同时做了三类低风险修复：

1. 主入口 spec/design/planning 已切换到新基线
2. `docs/README.md`、`docs/guides/ai-agent-dev-guide.md`、根 `README.md` 的死链与索引漂移已修复
3. `.trellis/spec/agent-lifecycle.md` 顶部增加了“历史说明，冲突时服从 ContextFS 基线”

---

## 7. 治理分级建议

### P0：应立即处理

- 修复用户站点 `docs/wiki/` 中仍残留的已删除文档引用
- 重写 `PROJECT_CONTEXT.md`
- 更新根 `README.md` 的产品定位入口

### P1：下一轮文档治理主线

- 重写 `PROJECT_CONTEXT.md`
- 审查 `.trellis/spec/backend/context-injector.md`
- 审查 `.trellis/spec/backend/plugin-guidelines.md`
- 审查 `.trellis/spec/backend/quality-guidelines.md`
- 审查 `docs/guides/ai-agent-dev-guide.md` 的旧开发心智
- 审查 `docs/planning/phase4-*` 是否应归档或加废弃声明

### P2：历史设计降级

- 给仍保留的历史设计文档添加“非当前基线”声明
- 从主入口索引移除这类历史设计文档的“当前架构”地位

### P3：后续同步项

- 同步 `docs/wiki`
- 审视 `docs/reports`
- 审视根 `README.md` 的整体产品叙述

---

## 8. 当前结论

结论分两部分：

1. **主入口层面**：ContextFS 文档基线已经建立，新的单一真相已经初步形成。
2. **全仓层面**：仍存在大量历史文档和旧术语残留，但主要集中在外围活文档、历史设计、用户站点和快照文档中。

因此当前状态可以定义为：

> **主入口已收口，外围仍需第二轮治理。**

这意味着仓库已经可以继续推进下一轮文档治理，但还不适合宣称“全仓文档已完全收敛”。

---

## 9. 建议的下一步

下一轮建议只做一件事：

> **围绕高影响入口文档做第二轮治理。**

优先顺序：

1. `PROJECT_CONTEXT.md`
2. `README.md`
3. `.trellis/spec/backend/context-injector.md`
4. `.trellis/spec/backend/plugin-guidelines.md`
5. `.trellis/spec/backend/quality-guidelines.md`
6. `docs/planning/phase4-employee-steps.md`
7. `docs/planning/phase4-plan.md`

在这之后，再决定是否进入真正的实现阶段。
