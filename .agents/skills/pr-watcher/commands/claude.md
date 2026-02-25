# Watch PRs — 持续轮询处理 GitHub PR

以 PR Watcher 身份，持续监控 GitHub 上的 Open PR，自动调用 pr-handler 逐一处理。

## 前置准备

读取 PR Watcher Skill：

@.agents/skills/pr-watcher/SKILL.md

同时读取 PR Handler Skill（处理单个 PR 的五阶段流程）：

@.agents/skills/pr-handler/SKILL.md

按照 Skill 中定义的轮询流程执行。

## 用户指令

$ARGUMENTS

## 快速参考

- `/watch-prs` — 默认参数运行（60 轮空闲退出，1 分钟间隔）
- `/watch-prs --max-idle 120` — 连续 120 轮无新 PR 才退出
- `/watch-prs --interval 30` — 每 30 秒轮询一次
- `/watch-prs --retry-failed` — 对有新 push 的失败 PR 重试
- `/watch-prs --exclude 160,162` — 排除指定 PR

## 运行模式

1. **轮询** — 每隔 interval 秒检查 GitHub Open PR 列表
2. **处理** — 对新发现的 PR 执行 pr-handler 五阶段流程
3. **跟踪** — 记录已处理/失败 PR，避免重复
4. **退出** — 连续 max-idle 轮无新 PR 后输出总结并退出
