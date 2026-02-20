# Product Roadmap

> 项目优先级与规划总览。与 Trellis Issues / Tasks / Milestones 对齐，作为「后续要做的事」的单一入口。  
> 更新节奏：当前任务推进、Issue 状态变更或里程碑调整时同步更新本文。

---

## 当前进行中 (Current)

| 任务 | Issue | 说明 |
|------|--------|------|
| [02-20-real-agent-launcher](tasks/02-20-real-agent-launcher/) | #4 | Real Agent Launcher：真实启动/关停 Cursor、Claude Code，替代 MockLauncher |

---

## 后续优先 (Next Up)

按计划执行顺序排列，完成当前任务后优先从下表自上而下推进。

| 顺序 | Issue | 标题 | 说明 |
|------|--------|------|------|
| 1 | **#7** | 审查与文档化：配置结构与对外接口 + Workflow 约定 | 汇总配置与对外接口文档，约定配置/接口变更须同步更新文档 |
| 2 | #5 | Template hot-reload on file change | Daemon 监听 template JSON 变更，自动 reload，无需重启 |
| 3 | #4 后续 | Real Launcher 收尾与验收 | 测试、文档、集成配置（见任务 PRD 验收标准） |

*更多 backlog 见 [Open Issues](#open-issues-by-milestone)。*

---

## Open Issues by Milestone

便于按时间视野查看，详情用 `./.trellis/scripts/issue.sh show <id>`。

- **mid-term**：#7（配置与接口文档）
- **long-term**：#1 实例内存层、#2 内存整合与共享内存、#3 Context 层与 ContextBroker、#4 Real Agent Launcher、#5 Template 热重载、#6 OpenViking 可选 MCP 集成

---

## 维护说明

- **当前进行中**：与 `task.sh list` 一致，仅保留当前主动开发的任务。
- **后续优先**：从 Issue 列表与任务 PRD 的「后续 Todo」中提炼，保证前 3～5 项为共识的下一步。
- 新增/关闭 Issue 或完成 Task 后，可顺带更新本表；大版本或季度规划时可重排「后续优先」顺序。
