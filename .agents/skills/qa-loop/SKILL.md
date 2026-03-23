---
name: qa-loop
description: 用于执行 `/qa-loop` 风格的 QA 循环验证编排技能。适合用户要求“qa-loop”、“循环回归直到通过”、“测试→报错→修复→再测”、“把某个 scope/issue 跑到 100% PASS”时使用。它负责在项目内编排完整的测试、报告、Issue 去重与创建、修复、全量回归和收敛控制；不适用于一次性的小型 QA 检查，也不适用于持续轮询监测（那应使用 `qa-monitor` / `qa-watch`）。
---

# QA Loop

## 概要

把 `qa-loop` 当成一个收敛编排器来用，而不是单次测试器。

它的职责是：

- 选定测试范围
- 执行一轮完整 QA
- 对 FAIL/WARN 做去重、建 issue、必要时进入修复
- 再跑完整回归，而不是只重跑失败步骤
- 直到全量通过、达到轮数上限，或确认陷入停滞

单次测试执行引擎不是本技能本身，仍然以以下真相源为准：

- [.agents/skills/qa-engineer/SKILL.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-engineer/SKILL.md)
- [.agents/skills/qa-engineer/workflows/cyclic-verification.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-engineer/workflows/cyclic-verification.md)
- [.agents/skills/issue-manager/SKILL.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/issue-manager/SKILL.md)

如需看旧 slash-command 的原始语义，读取：

- [references/source-map.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-loop/references/source-map.md)

## 输入映射

将用户意图收敛到以下参数：

- `scope`
  - `all`：全部场景
  - `<scenario-name>`：单个场景
  - `#<issue>`：围绕某个 issue 的相关场景
  - 自由描述：进入 explore 型 QA 设计
- `environment`
  - 默认 `real`
  - 用户明确要求或环境受限时用 `mock`
- `max_rounds`
  - 默认 `0`，表示不限轮数
  - 需要安全阀时显式设置
- `skip_fix`
  - 只做测试和报告，不自动修
- `unit_only`
  - 只跑单元测试，不跑黑盒场景

如果用户没有明确给出这些参数，按以下默认值工作：

- `scope=all`
- `environment=real`
- `max_rounds=0`
- `skip_fix=false`
- `unit_only=false`

## 执行流程

### 1. 先确定本轮的活跃范围

按顺序决策：

1. 如果用户给了场景名，只加载对应 `scenarios/<name>.json`
2. 如果用户给了 issue 编号，先读取 issue，再挑选相关场景
3. 如果用户给的是自由描述，按 QA engineer 的 explore 模式设计步骤
4. 否则默认 `all`

读取场景时优先使用：

- `.agents/skills/qa-engineer/scenarios/*.json`

不要自己发明第二套场景清单。

### 2. 建立轮次目录和证据链

如果当前已有活跃 task 目录，则在该 task 下写入 QA 产物。

如果没有，创建一个最小任务目录用于承载日志和报告，例如：

```text
.trellis/tasks/qa-loop-<topic>/
```

每轮必须落两类文件：

- `qa-log-roundN.md`
- `qa-report-roundN.md`

日志要求严格复用 QA engineer 的增量写入规则：

- 每一步执行前记录原始输入
- 每一步执行后立即记录 stdout / stderr / exit code
- 紧跟记录 PASS / WARN / FAIL 判断

不要在整轮执行完后再回忆补日志。

### 3. 做 preflight，而不是盲目开跑

默认 preflight：

- `git status --short`
- 必要的上下文入口文档
- 相关场景 JSON
- 如果是实现后回归，先看关联 issue / task

构建与验证：

- 默认尝试 `pnpm build`
- 如果仓库存在与当前 scope 无关的已知基线故障，不要假装构建通过
- 需要明确记录：
  - 是“pre-existing unrelated failure”
  - 还是“本轮修改引入的新失败”

如果 preflight 就已经 BLOCKED，停止并出报告，不要进入伪循环。

### 4. 执行 Round 1 完整 QA

默认顺序：

1. 创建隔离环境
2. 按 scope 执行黑盒 / 白盒步骤
3. 如未设置 `unit_only`，执行场景测试
4. 执行相关单元测试 / 仓库验证
5. 汇总 PASS / WARN / FAIL

关键约束：

- 不允许只跑失败步骤后就宣称修复完成
- 回归必须重新执行完整 scope

### 5. 处理 FAIL / WARN

对每个 FAIL / WARN：

1. 先搜索已有 issue
2. 若已存在，追加 comment
3. 若不存在，按 QA 规则创建 issue

默认规则：

- FAIL -> `bug`, `priority:P1`, `label: qa`
- WARN -> 视情况创建 `enhancement`, `priority:P2`, `label: qa`

如果问题根因不清晰，不直接修代码，先按 investigate 方式补齐：

- Problem
- Evidence
- Hypotheses
- Validation
- Status

### 6. 需要时进入修复

只有在以下条件同时成立时才进入修复：

- `skip_fix=false`
- 问题已经足够清晰
- 当前请求不是纯 QA 审查

修复后至少做两层验证：

- 与修改直接相关的 targeted validation
- 同一 scope 的完整 QA 回归

### 7. 进入下一轮

当存在修复时，进入下一轮完整回归。

每轮都要记录：

- 轮次编号
- 本轮通过率
- 新建 / 更新的 issues
- 是否有实质修复
- 与上一轮相比是改善、持平还是退化

停止条件：

- 全量 PASS
- 达到 `max_rounds`
- 连续 3 轮无改进
- 环境或基线问题导致 BLOCKED

## 输出要求

每次使用该技能，对用户输出必须包含：

- 本次 `scope`
- 当前环境是 `real` 还是 `mock`
- 当前轮次和上限
- 当前状态是 `PASS`、`PARTIAL`、`FAIL` 还是 `BLOCKED`
- 新建 / 更新的 issue
- 下一步是“继续修复”还是“停止并汇报”

如果真的进入多轮循环，必须持续汇报进展，不能静默执行到最后才一次性总结。

## 与相关技能的边界

### `qa-engineer`

`qa-engineer` 负责：

- 执行单个场景
- 做黑盒 / 白盒判断
- 写增量日志

`qa-loop` 负责：

- 轮次编排
- 收敛控制
- 修复触发
- issue 生命周期串联

### `qa-monitor`

`qa-monitor` / `/qa-watch` 适合：

- 监听新 ship
- 长期轮询
- 监测式回归

`qa-loop` 适合：

- 围绕一个明确 scope 持续修到收敛
- 一次性多轮执行

## 不要做的事

- 不要把 `qa-loop` 退化成“跑一次测试”
- 不要只重跑失败步骤就宣布通过
- 不要跳过 issue 去重
- 不要在原因不清晰时直接修代码
- 不要维护第二套场景或第二套报告标准

## 快速工作法

当用户直接说：

- “跑 qa-loop”
- “把这个问题循环修到通过”
- “针对 #321 做 QA loop”

使用以下最小步骤：

1. 明确 `scope`
2. 明确 `real/mock`
3. 建立 round 目录
4. 执行 Round 1
5. 对 FAIL/WARN 建 issue 或追加 comment
6. 如允许修复，则修复并进入下一轮
7. 直到收敛或停止条件触发
