---
name: codex-loop
description: '用于启动或续跑 `.trellis/scripts/multi-agent/codex-loop.sh` 的执行技能。适合需要在独立 worktree 中让 Codex 按 implement/check 多轮循环推进任务，直到通过校验门。触发方式：用户提及 "codex-loop"、"Ralph Loop"、"loop 修复"、"继续 loop"、"多轮修到通过"、"在 worktree 里反复实现和检查" 等关键词时激活。'
license: MIT
allowed-tools: Shell, Read, Glob, Grep
---

# Codex Loop

## 目标

把 `codex-loop` 当成一个现成的循环执行器来用，不重写它的流程。唯一真相源是：

- `.trellis/scripts/multi-agent/codex-loop.sh`
- `.trellis/scripts/multi-agent/codex-loop-live.sh`
- `.trellis/scripts/multi-agent/codex-loop-batch.sh`
- `.trellis/worktree.yaml`
- 任务目录中的 `task.json` / `prd.md` / `codex-loop/`

适用场景：

- 用户明确希望“循环修到通过”
- 任务需要隔离 worktree，避免污染主工作区
- 需要可恢复的 round 日志、状态文件、最后反馈
- 需要把“实现”和“检查”拆成多轮、让脚本驱动收敛

不适用场景：

- 只需要一次性小改动
- 用户只是在问原理，不要求实际执行
- 当前仓库没有 `codex` CLI 或没有可用的验证手段

## 参数映射

`codex-loop.sh` 的最小必填参数：

- `--name <task-name>`
- `--type <backend|frontend|fullstack|test|docs>`
- `--requirement "<requirement>"`

常用可选参数：

- `--task-dir <dir>`: 续跑已有 task
- `--rounds <n>`: 最大循环轮数，默认 `3`
- `--model <model>`: 默认 `gpt-5.4`
- `--sandbox <mode>`: 默认 `workspace-write`
- `--approval <policy>`: 默认 `never`
- `--search`: 允许 `codex exec` 使用 web search
- `--dry-run`: 只打印计划，不执行

类型选择规则：

- 后端/CLI/服务端逻辑改动选 `backend`
- 纯前端界面改动选 `frontend`
- 同时跨 UI + API/核心逻辑选 `fullstack`
- 以测试补强、回归修复为主选 `test`
- 纯文档/spec/changelog 选 `docs`

## 执行流程

### 1. 先确认是否适合用 loop

先检查：

- `codex` 命令可用
- 目标需求适合多轮收敛，不是一次性改完即可
- 仓库存在 `.trellis/scripts/multi-agent/codex-loop.sh`
- 必要时查看 `.trellis/worktree.yaml` 的 `verify` 配置

若用户表达含糊，优先自己补齐这三个信息：

- 任务名 `--name`
- 开发类型 `--type`
- 一句话验收目标 `--requirement`

### 2. 先跑 dry-run

除非用户明确要求立即执行，否则先执行：

```bash
./.trellis/scripts/multi-agent/codex-loop.sh \
  --name <task-name> \
  --type <type> \
  --requirement "<requirement>" \
  --dry-run
```

确认以下信息是否合理：

- 生成或复用的 task 目录
- `codex/` 前缀分支名
- worktree 路径
- verify 模式是 `shell` 还是 `codex-check`

### 3. 正式执行

dry-run 无误后，默认通过 live 包装脚本执行正式 loop：

```bash
./.trellis/scripts/multi-agent/codex-loop-live.sh \
  --name <task-name> \
  --type <type> \
  --requirement "<requirement>"
```

如果用户要求续跑已有 task，改为：

```bash
./.trellis/scripts/multi-agent/codex-loop-live.sh \
  --task-dir <task-dir> \
  --name <task-name> \
  --type <type> \
  --requirement "<requirement>"
```

### 4. 读取产物并汇报

执行后优先读取：

- `<task-dir>/codex-loop/status.json`
- `<task-dir>/codex-loop/last-feedback.md`
- `<task-dir>/codex-loop/round-*/implement.log`
- `<task-dir>/codex-loop/round-*/check.log`

最重要的结论只有三类：

- `passed`: loop 已收敛，给出 task、branch、worktree、剩余人工动作
- `stalled`: 连续两轮无 diff 进展，需要人工改策略
- `failed`: implement/check/shell verify 失败，汇总最后反馈

## Session 记录

`codex-loop.sh` 每一轮结束后都会自动执行一次 session 记录，写入当前开发者的 journal：

- 记录标题固定为 `Codex Loop 第N轮 - <task-name>`
- 摘要与详细内容使用中文
- 必须包含本轮 `check` 结果
- 若存在 `shell verify`，必须同时记录通过/失败结果
- 若工作区 journal 目录不存在，脚本应先自动补齐再写入

这类记录属于 loop 的运行轨迹，即使当前轮尚未 commit，也应该照常记录；不要把它和用户在任务收尾时手动执行的 `/trellis-record-session` 混为一谈。

## 质量门解释

`codex-loop` 有两层通过条件，缺一不可：

1. 检查 worker 的最终输出包含 `CODEX_LOOP_CHECK_PASS`
2. 如果 `.trellis/worktree.yaml` 配置了 `verify:`，这些 shell 命令必须全部通过

如果 `verify:` 为空，就退化为依赖 check worker 的结论。

因此：

- 不要在技能里重复定义 lint/typecheck/test 的固定清单
- 应以 `.trellis/worktree.yaml` 为准读取真实质量门

## 常见决策

### 新开 loop

在这些条件下直接新开：

- 用户要解决一个明确需求
- 还没有现成 task 目录
- 需要完整的 worktree 隔离和 round 日志

### 续跑 loop

在这些条件下复用已有 task：

- 已存在 task 目录与 `codex-loop/` 日志
- 上一轮是 `failed` 或 `stalled`
- 用户要“继续上次 loop”或“根据最后反馈再跑一轮”

### 不启动 loop

遇到以下情况应改用普通实现流程：

- 需求太小，开 worktree 成本高于收益
- 当前工作树已有用户未提交改动且任务强相关，隔离执行会增加同步成本
- 用户只需要审阅、解释、方案设计，不需要脚本实际执行

## 输出要求

每次使用此技能，都给用户一个简短执行摘要：

- 本次是 `dry-run`、正式执行，还是续跑
- 使用的 `name/type/requirement`
- 生成或复用的 task / branch / worktree
- 当前结果是 `passed`、`stalled` 还是 `failed`
- 若未通过，指出下一步阻塞来自哪里：implement、check 或 shell verify
- 若实际执行了 round，补充说明本轮 session 已自动记录

## 实时汇报要求

只要实际启动了 loop，就必须在当前界面全过程持续汇报进度，不能只把信息写入 task 目录后静默运行，也不能只在少数关键节点补发摘要。

强制要求：

- loop 开始前，说明这是 `dry-run`、正式执行还是续跑
- 每进入新一轮时，立即汇报当前 `round / max_rounds`
- implement 阶段执行期间持续同步正在做什么，完成后汇报本轮是否产生了实质改动
- check 阶段执行期间持续同步正在检查什么，完成后汇报当前判定是 `PASS` 还是 `FAIL`
- 若存在 shell verify，执行期间持续同步正在跑哪条命令，完成后汇报通过情况；失败时指出具体失败命令
- 若 loop 因无进展、校验失败、脚本报错或达到最大轮数而中断，要立即汇报原因
- loop 终止时，明确说明最终状态是 `passed`、`stalled` 还是 `failed`

汇报内容可以简短，但必须让用户在当前界面实时看见进度，而不需要主动去打开：

- `status.json`
- `last-feedback.md`
- `implement.log`
- `check.log`

如果运行方式不支持自动流式展示脚本内部输出，就必须主动轮询并读取产物，把最新状态不断同步到当前界面，直到 loop 结束；不允许因为“工具不支持流式”而退化为静默执行。

## 批量模式（Multi-Todo）

当用户有多个 todo 需要依次 loop 执行时，使用 `codex-loop-batch.sh` 包装器。

### Todos JSON 格式

创建一个 JSON 文件描述所有待执行 todo：

```json
{
  "verify": ["pnpm type-check"],
  "todos": [
    {
      "name": "m6-converge-acp",
      "todo_id": "m6-phase7",
      "type": "backend",
      "requirement": "Refactor VfsInterceptor to use VfsKernel...",
      "task_dir": ".trellis/tasks/03-20-m6-converge-acp",
      "rounds": 5
    },
    {
      "name": "m6-cleanup-legacy",
      "todo_id": "m6-phase8",
      "type": "backend",
      "requirement": "Remove ContextManager exports...",
      "rounds": 3
    }
  ]
}
```

字段说明：

- `verify`（可选）：batch 级别的 verify 命令，会临时覆盖 `worktree.yaml` 中的 `verify:` 配置，全部 todo 执行完后自动恢复
- `todos[].name`：任务名（必填）
- `todos[].todo_id`（可选）：关联的 Cursor TodoWrite ID，用于自动同步进度
- `todos[].type`：开发类型（必填）
- `todos[].requirement`：需求描述（必填）
- `todos[].task_dir`（可选）：续跑已有 task 目录；为空时自动创建
- `todos[].rounds`（可选）：最大轮数，默认 3

### 批量执行流程

```bash
# dry-run 预览
./.trellis/scripts/multi-agent/codex-loop-batch.sh \
  --todos-file path/to/todos.json \
  --dry-run

# 正式执行
./.trellis/scripts/multi-agent/codex-loop-batch.sh \
  --todos-file path/to/todos.json

# 失败后继续下一个
./.trellis/scripts/multi-agent/codex-loop-batch.sh \
  --todos-file path/to/todos.json \
  --continue-on-failure
```

### 进度文件

脚本自动在 todos JSON 同目录下写入 `batch-progress.json`，每个 todo 状态变化时即时更新：

```json
{
  "total": 2,
  "current_index": 1,
  "updated_at": "2026-03-20T15:30:00+08:00",
  "results": [
    {
      "name": "m6-converge-acp",
      "todo_id": "m6-phase7",
      "state": "passed",
      "round": 3,
      "task_dir": ".trellis/tasks/03-20-m6-converge-acp"
    },
    {
      "name": "m6-cleanup-legacy",
      "todo_id": "m6-phase8",
      "state": "running",
      "round": 1,
      "task_dir": ""
    }
  ]
}
```

`state` 取值：`pending` / `running` / `passed` / `failed` / `stalled` / `skipped`

## Todo 进度同步协议

codex-loop 的执行结果必须实时同步到 Cursor 的 TodoWrite。这是强制规则，不允许全部跑完后才一次性更新。

### 状态映射

| codex-loop state | TodoWrite status |
|---|---|
| `running` | `in_progress` |
| `passed` | `completed` |
| `failed` / `stalled` | 保持 `in_progress`（由 assistant 决定下一步） |

### 单任务模式

直接调用 `codex-loop-live.sh` 执行单个 todo 时：

1. 启动前：如果 assistant 当前有活跃 todo list 且本次 loop 对应某个 todo，立即 `TodoWrite` 将其标记为 `in_progress`
2. 监控中：持续轮询 `status.json`，检测到 state 变化时在汇报的同时判断是否需要更新 TodoWrite
3. 结束后：读取 `status.json` 最终 state
   - `passed` → `TodoWrite` 该 todo 为 `completed`
   - `failed` / `stalled` → 保持 `in_progress`，汇报失败原因后由 assistant 或用户决定下一步

### 批量模式

调用 `codex-loop-batch.sh` 执行多个 todo 时：

1. 启动前：根据 todos JSON 中的 `todo_id` 字段创建或更新 TodoWrite 条目，全部初始化为 `pending`
2. 监控中：轮询 `batch-progress.json`，每当检测到某个 todo 的 `state` 发生变化：
   - `state` 变为 `running` → `TodoWrite` 对应 todo 为 `in_progress`
   - `state` 变为 `passed` → `TodoWrite` 对应 todo 为 `completed`
   - `state` 变为 `failed` / `stalled` → 保持 `in_progress`
   - `state` 变为 `skipped` → 保持 `pending`
3. 结束后：做一次最终同步，确认 `batch-progress.json` 中所有 `todo_id` 非空的条目状态都已同步到 TodoWrite

### 跳过同步条件

- `todo_id` 字段为空或不存在时，跳过 TodoWrite 同步，不报错
- assistant 当前没有活跃 todo list 时，跳过同步

## 注意事项

- 不要手工模拟 `codex-loop` 的多轮逻辑，优先直接调用脚本
- 默认使用 `codex-loop-live.sh`，只有在用户明确要求底层原始脚本时才直接调用 `codex-loop.sh`
- 批量执行多个 todo 时使用 `codex-loop-batch.sh`
- 不要在主工作区修改 loop 目标代码；脚本会在独立 worktree 中执行
- 不要假设验证命令存在；先读 `.trellis/worktree.yaml`
- 若用户只想创建技能或文档而非实际跑 loop，可以只更新技能文件，不执行脚本
