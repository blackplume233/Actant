## 目标
让 `/trellis-create-issue` 支持“任务版（Task Board）”概念，使 Agent 可以根据当前上下文和目标连续接取下一个任务，而不是一次只创建单条 issue 后人工中断。

## 背景
当前 issue 创建流程更偏“单次记录”，缺少面向 Agent 连续执行的任务编排能力。
在多任务并行或长流程执行场景下，Agent 需要自动判断并接取下一个可执行任务，以提高吞吐和减少人工调度成本。

## 需求
- 在 `/trellis-create-issue` 流程中引入 Task Board 语义（如 backlog / ready / doing / blocked / done）。
- 支持 Agent 根据自身需求（优先级、标签、依赖、assignee、上下文）选择下一个任务。
- 支持“连续接取”模式：完成当前任务后自动挑选下一条可执行任务。
- 支持可观测性：记录每次接取决策依据（priority、label、dependency、reason）。

## 验收标准
- [ ] 可以通过命令或参数启用“任务版”模式。
- [ ] Agent 可从候选任务中自动挑选下一项并开始执行。
- [ ] 当无可执行任务时给出明确原因（blocked / dependency / empty queue）。
- [ ] 流程日志可追踪接单链路（picked -> started -> finished -> next picked）。

## 影响范围
- Slash Command: `/trellis-create-issue`（或等价命令实现）
- Issue/Task 协同脚本（`.trellis/scripts/issue.sh`, `.trellis/scripts/task.sh`）
- 相关技能文档（issue-manager / workflow）
