# Create PR — Rebase、验证、创建 Pull Request 一站式流程

Rebase 当前分支到最新目标分支，执行简化版 Ship 质量门禁，通过后自动创建 GitHub PR。

**时机**: 功能开发完成、代码已提交，准备提交 PR 时执行。

**输入**: `{{input}}` — 可选，PR 标题或目标分支（如 `master`），留空则自动检测

---

## 执行流程

### Phase 0: Context — 收集上下文

#### 0.1 确定分支信息

```bash
git branch --show-current
git remote -v
git log --oneline -10
```

**识别目标分支**（按优先级）：
1. 用户通过 `{{input}}` 显式指定的目标分支
2. 仓库默认分支（通常为 `master` 或 `main`）

```bash
# 检测默认分支
git symbolic-ref refs/remotes/origin/HEAD 2>$null | ForEach-Object { $_ -replace 'refs/remotes/origin/', '' }
# 回退：尝试 master，再试 main
```

**前置检查**（任一不满足即中止）：
- 当前分支不能是目标分支本身（不能在 master 上创建 PR）
- 工作区必须干净（无未提交的变更），否则提醒先 commit 或 stash

```bash
git status --porcelain
```

如果工作区不干净，输出提示并中止：
```
❌ 工作区有未提交的变更，请先 commit 或 stash 后重新执行。
```

#### 0.2 输出上下文摘要

```
## PR Context

- 当前分支: <current-branch>
- 目标分支: <base-branch>
- 提交数: <N> commits ahead of <base-branch>
- 变更概览: <files changed summary>
```

---

### Phase 1: Rebase — 变基到最新目标分支

#### 1.1 Fetch 最新代码

```bash
git fetch origin <base-branch>
```

#### 1.2 执行 Rebase

```bash
git rebase origin/<base-branch>
```

#### 1.3 冲突处理

如果 rebase 产生冲突：

1. 中止 rebase：`git rebase --abort`
2. 输出诊断信息并中止流程：

```
❌ Rebase 冲突 — 需要手动解决

建议:
1. 手动执行 git rebase origin/<base-branch>
2. 解决冲突后 git rebase --continue
3. 重新执行 /trellis-create-pr
```

#### 1.4 Rebase 成功确认

```
✅ Rebase 成功 — 已变基到 origin/<base-branch> 最新提交
```

---

### Phase 2: Validate — 简化版质量门禁

执行核心质量检查，确保 PR 代码不引入明显问题。

#### 2.1 安装依赖（如需要）

```bash
# 检查 node_modules 是否存在
pnpm install
```

#### 2.2 代码质量检查

```bash
pnpm lint
pnpm type-check
```

#### 2.3 测试

```bash
pnpm test
```

#### 2.4 模式扫描（仅变更文件）

对变更文件进行禁止模式检查：

```bash
git diff origin/<base-branch>...HEAD --name-only --diff-filter=ACMR
```

对 `.ts` 源文件（排除 `.test.ts` 和 `.d.ts`）检查：
1. `console.log`（测试文件和 logger 除外）
2. 显式 `any` 类型（`.d.ts` 除外）
3. 非空断言 `!`

发现严重问题 → 标记为 FAIL。

#### 2.5 输出验证报告

```
## 质量门禁报告

| 检查项 | 结果 |
|--------|------|
| pnpm lint | ✅ 通过 / ⚠️ 跳过 / ❌ 失败 |
| pnpm type-check | ✅ 通过 / ⚠️ 跳过 / ❌ 失败 |
| pnpm test | ✅ 通过 / ⚠️ 跳过 / ❌ 失败 |
| console.log | ✅ 无 / ⚠️ 发现 N 处 |
| any 类型 | ✅ 无 / ⚠️ 发现 N 处 |
| 非空断言 | ✅ 无 / ⚠️ 发现 N 处 |

结论: GATE PASSED / GATE FAILED
```

**GATE FAILED 时**：输出完整诊断信息，中止流程，不创建 PR。

如果命令因依赖未安装而失败，先尝试 `pnpm install` 重试；仍失败则标记为 "⚠️ 跳过" 并继续。

---

### Phase 3: Push & Create PR — 推送并创建 PR

#### 3.1 推送分支

```bash
git push origin <current-branch> --force-with-lease
```

使用 `--force-with-lease`（rebase 后需要 force push，但比 `--force` 安全）。

#### 3.2 生成 PR 内容

分析所有 commits（从分叉点到 HEAD）生成 PR 标题和描述：

```bash
git log origin/<base-branch>..HEAD --oneline
git diff origin/<base-branch>...HEAD --stat
```

**PR 标题**：
- 如果用户通过 `{{input}}` 提供了标题，使用用户提供的
- 否则从 commits 中推断（遵循 Conventional Commits 风格）

**PR Body 模板**：

```markdown
## Summary
<1-3 bullet points summarizing the changes>

## Changes
<list of key changes with file references>

## Test Plan
- [ ] lint passes
- [ ] type-check passes
- [ ] tests pass
- [ ] manual verification (if applicable)

## Related Issues
<auto-detected issue references, e.g. Closes #N, Refs #N>
```

**Issue 检测**：从 commit messages 和代码变更中提取 `#N` 引用，自动填入 Related Issues。

#### 3.3 创建 GitHub PR

```bash
gh pr create --base <base-branch> --head <current-branch> --title "<title>" --body "<body>"
```

如果当前已存在同分支的 PR，提示用户并询问是否更新现有 PR。

#### 3.4 输出最终摘要

```
## PR 创建完成

- PR: <pr-url>
- 标题: <title>
- 分支: <current-branch> → <base-branch>
- 提交数: N commits
- 变更: N files changed, +insertions, -deletions
- Issue: <related issues>
```

---

## 异常处理

| 场景 | 处理方式 |
|------|---------|
| 工作区不干净 | 提示 commit/stash 后中止 |
| 当前在目标分支上 | 提示切换到 feature 分支后中止 |
| Rebase 冲突 | abort 并输出诊断，中止 |
| 质量门禁失败（lint/type-check/test ❌） | 输出报告，中止 |
| Push 失败 | 输出错误信息，中止 |
| `gh` CLI 不可用 | 输出 push 成功信息，提供手动创建 PR 的指引 |
| PR 已存在 | 提示并询问是否更新 |

---

## 安全规则

- 使用 `--force-with-lease` 而非 `--force`（rebase 后安全 force push）
- **绝不** 在 master/main 上执行（检测到则中止）
- **绝不** 提交含密钥的文件
- **绝不** 修改 git config
- **绝不** 使用 `--no-verify` 跳过 hooks
- Rebase 冲突时 **绝不** 自动解决，必须中止

---

## 与其他命令的关系

```
开发流程:
  /trellis-plan-start → 编写代码 → 测试 → /trellis-create-pr → PR Review
                                              |
                                    ┌─────────┼──────────┬──────────────┐
                                    ↓         ↓          ↓              ↓
                              Phase 0:   Phase 1:   Phase 2:       Phase 3:
                              Context    Rebase     Validate       Push & Create PR
                                                    (简化版 Ship)
```

| 命令 | 关系 |
|------|------|
| `/trellis-ship` | 本命令复用其 Phase 1 (Review) 的核心检查项 |
| `/trellis-finish-work` | 本命令的 Phase 2 是其简化版 |
| `/trellis-handle-pr` | 下游：PR 创建后由此命令处理合并 |
| `/trellis-plan-start` | 上游：规划并实现功能后执行本命令创建 PR |

---

## 简化版 vs 完整版 Ship 的区别

| 检查项 | `/trellis-create-pr` (简化) | `/trellis-ship` (完整) |
|--------|---------------------------|----------------------|
| lint | ✅ | ✅ |
| type-check | ✅ | ✅ |
| test | ✅ | ✅ |
| 模式扫描 | ⚠️ 警告级别 | ❌ 阻断级别 |
| Spec 同步检查 | — 跳过 | ❌ 阻断级别 |
| Commit | — 跳过（已提交） | ✅ 执行 |
| Issue Sync | — 跳过（PR 合并时处理） | ✅ 执行 |
| Rebase | ✅ 执行 | — 不执行 |
| 创建 PR | ✅ 执行 | — 不执行 |
