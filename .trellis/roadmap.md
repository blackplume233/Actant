# Product Roadmap

> 项目优先级与规划总览。与 Trellis Issues / Tasks / Milestones 对齐，作为「后续要做的事」的单一入口。  
> 更新节奏：当前任务推进、Issue 状态变更或里程碑调整时同步更新本文。  
> **Task 级 Todo**：在本文持续迭代当前任务的勾选清单，随开发进展更新 `[ ]` → `[x]`，完成一项勾一项。

---

## 当前进行中 (Current)

| 任务 | Issue | 说明 |
|------|--------|------|
| [02-20-real-agent-launcher](tasks/02-20-real-agent-launcher/) | #4 | Real Agent Launcher：真实启动/关停 Cursor、Claude Code，替代 MockLauncher |

### 当前任务 Todo（Task 级，随推进勾选）

*对应 [02-20-real-agent-launcher PRD](tasks/02-20-real-agent-launcher/prd.md) 实现清单，以本表为 Roadmap 侧进度视图。*

- [x] backend 类型与配置（meta 含 backendType/backendConfig）
- [x] 可执行路径（template.backend.config → meta）
- [ ] 新增 RealLauncher 实现 AgentLauncher
- [ ] launch(workspaceDir, meta)：spawn 子进程、工作目录、返回真实 PID
- [ ] terminate(process)：SIGTERM，可选超时后 SIGKILL
- [ ] 进程存活检测（如 process.kill(0)）
- [ ] 与 daemon initialize() 的 stale 修正一致
- [ ] AppContext 按配置选择 MockLauncher / Real Launcher
- [ ] 文档：Cursor/Claude Code 路径与环境要求
- [ ] 保留并通过 AgentManager + MockLauncher 单元测试
- [ ] Real Launcher 单元/集成测试
- [ ] Lint/typecheck 通过
- [ ] 验收：Cursor / Claude Code start&stop、PID 与状态、跨平台路径

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
- **Task 级 Todo**（持续迭代）：
  - 随开发推进在本文件中勾选完成项（`[ ]` → `[x]`），完成一项勾一项。
  - 若任务拆出新的子项或 PRD 清单有更新，同步增补到「当前任务 Todo」列表。
  - 当前任务完成后：将该任务 Todo 段归档或删除，将「后续优先」中下一项提为当前任务，并从其 PRD 抄写新的 Task 级 Todo 到本段。
- **后续优先**：从 Issue 列表与任务 PRD 的「后续 Todo」中提炼，保证前 3～5 项为共识的下一步。
- 新增/关闭 Issue 或完成 Task 后，可顺带更新本表；大版本或季度规划时可重排「后续优先」顺序。
