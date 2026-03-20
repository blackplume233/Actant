---
name: ship-sub
description: 子分支交付技能。用于用户要求“ship sub”、“子分支提 PR 再由主分支合并”、“feature branch ship”、“先创建 PR 再 handle-pr 交付”等场景。流程是在当前非主分支执行 finish-work/ship 级检查，提交并推送子分支，创建或复用 PR，然后切回主分支按 pr-handler 流程完成 handle-pr 交付。
license: MIT
allowed-tools: Shell, Read, Write, Glob, Grep
metadata:
  short-description: 子分支提交 PR，主分支 handle-pr 交付
---

# Ship Sub

## Overview

把一次完整交付拆成两个责任边界：

1. **子分支** 负责 review、spec 同步检查、commit、push、创建或复用 PR。
2. **主分支** 负责接手该 PR，执行 `handle-pr` 的验证、合并、spec 更新与最终 ship。

这适用于不能直接在 `master`/`main` 上 ship 的仓库流程。它复用 `.cursor/commands/trellis-ship.md` 的质量门和 `.agents/skills/pr-handler/SKILL.md` 的主分支交付流程，但不重复定义两套规则。

## 前置条件

- 当前仓库必须是 Trellis 工作流仓库，并存在：
  - `.cursor/commands/trellis-ship.md`
  - `.cursor/commands/trellis-finish-work.md`
  - `.agents/skills/pr-handler/SKILL.md`
- 当前分支必须是 **子分支**，不能是 `master`/`main`，也不能是 detached HEAD。
- 本地必须可以使用 `git`、`gh`、`pnpm`。
- 如存在 task 目录，优先读取 `task.json` 的 `base_branch`、`branch`、`pr_url`。

## 工作流

### 1. 收集上下文

先确认：

- 当前分支名：`git branch --show-current`
- 工作区状态：`git status --short`
- 目标主分支：
  - 优先 `task.json.base_branch`
  - 其次 `origin/HEAD`
  - 最后回退为 `master` 或 `main`
- 当前 task：
  - 优先 `.trellis/.current-task`
  - 其次从当前分支名匹配 `.trellis/tasks/*/task.json`

若当前就在目标主分支上，立即中止，并告知用户这个技能只适用于子分支交付。

### 2. 子分支质量门

在当前子分支执行与 `trellis-ship` 一致的阻断检查：

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
- 对变更源文件扫描：
  - `console.log`
  - 显式 `any`
  - 非空断言 `!`

同时执行 `trellis-ship.md` 里的 **Spec 文档同步检查**。命中触发条件而 spec 未同步时，必须中止；不要带着 spec 缺口继续创建 PR。

如果依赖缺失导致命令失败，可先尝试 `pnpm install` 再重跑一次；仍失败时，把失败原因明确报出，不要假装通过。

### 3. 子分支提交与推送

质量门通过后，在子分支完成提交：

- 查看变更：`git status`、`git diff --stat`、`git log --oneline -5`
- 暂存变更时排除明显不应提交的文件：
  - `.trellis/workspace/`
  - `.agent-log`
  - 凭证、密钥、`.env`
- 使用 Conventional Commits
- 如仓库中可用 `git-commit` 技能，优先按该技能的约定生成 commit message

推送规则：

- 默认 `git push origin <current-branch>`
- 只有在本轮已经明确执行过 rebase / history rewrite 时，才使用 `--force-with-lease`
- 绝不使用 `--force`

### 4. 创建或复用 PR

优先直接使用 `gh`：

```bash
gh pr list --head <current-branch> --base <base-branch> --json number,url,state,isDraft
gh pr create --draft --base <base-branch> --head <current-branch> --title "<title>" --body "<body>"
```

规则：

- 若该分支已有 PR，直接复用并输出 URL，不重复创建
- 默认创建 **Draft PR**
- PR 标题优先使用最新 commit message；必要时再精简成人类可读标题
- PR body 至少包含：
  - Summary
  - Changes
  - Test Plan
  - Related Issues

不要默认调用 `.trellis/scripts/task.sh create-pr` 或 `.trellis/scripts/multi-agent/create-pr.sh` 作为本技能的 PR 创建步骤，因为它们会在创建 PR 后写回 `task.json`，容易把子分支重新弄脏，影响后续切换主分支。

### 5. 切回主分支执行 Handle PR

拿到 PR URL 或编号后：

1. `git checkout <base-branch>`
2. `git pull origin <base-branch>`
3. 读取 `.agents/skills/pr-handler/SKILL.md`
4. 按 `pr-handler` 的五阶段流程处理该 PR

这里的主分支阶段不是“再造一个简化版”，而是直接复用现有 `pr-handler`：

- Discovery
- Validation Gate
- Local Merge
- Update Spec
- Ship

如果切换主分支前发现本地还有未提交改动，必须先停下并解释阻塞原因；不要在脏工作区上强行 `checkout`。

### 6. 结束条件

只有同时满足以下条件，才算完成：

- 子分支变更已经提交并推送
- PR 已创建或已确认存在
- 主分支 `handle-pr` 已成功完成
- 本地仓库上下文最终回到 `master`/`main`

如果因为合并冲突、验证失败或本地脏状态导致流程中断，要明确指出是中断在：

- 子分支质量门
- 子分支推送 / PR 创建
- 主分支 handle-pr

## 输出要求

执行该技能时，最终至少汇报：

- 当前子分支
- 目标主分支
- 子分支 commit hash 与 commit message
- PR 编号 / URL
- `handle-pr` 最终结果
- 当前本地所在分支

若中途失败，也要按同样结构汇报已完成部分和阻塞点。

## 安全规则

- 绝不在 `master`/`main` 上直接执行“子分支阶段”的 commit/push/PR 创建
- 绝不 `git push --force`
- 绝不 `git checkout -f`
- 绝不 `git reset --hard`
- 绝不跳过 hooks（`--no-verify`）
- spec 未同步时绝不继续创建 PR
- 主分支阶段必须以 `pr-handler` 的真实验证结果为准，不得自行宣称完成
