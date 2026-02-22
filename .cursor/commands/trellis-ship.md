# Ship - 审查、提交、推送、同步 Issue 一站式流程

编排 `/trellis-finish-work` 的审查清单，并追加 Commit、Push、Issue 同步操作，一次完成交付。

**时机**: 代码编写完成后，准备交付时执行。

---

## 执行流程

### Phase 1: Review（执行 finish-work 审查清单）

**执行 `/trellis-finish-work` 中定义的全部检查项**，包括：

1. **代码质量** — 运行 `pnpm lint`、`pnpm type-check`、`pnpm test`
2. **代码模式扫描** — 检查 `console.log`、`any` 类型、非空断言
3. **文档同步** — 判断 `.trellis/spec/` 是否需要更新
4. **API / 数据库 / 跨层变更** — 按变更范围检查对应项

如果命令因依赖未安装而失败，标记为 "⚠️ 跳过" 并继续。
如果有实质性错误（❌），**停止流程**，先修复再重新执行。

#### 输出审查报告

```
## 审查报告

| 检查项 | 结果 |
|--------|------|
| pnpm lint | ✅ 通过 / ⚠️ 跳过 / ❌ 失败 |
| pnpm type-check | ✅ / ⚠️ / ❌ |
| pnpm test | ✅ / ⚠️ / ❌ |
| console.log | ✅ 无 / ❌ 发现 N 处 |
| any 类型 | ✅ 无 / ❌ 发现 N 处 |
| 非空断言 | ✅ 无 / ❌ 发现 N 处 |
| spec 文档同步 | ✅ 已同步 / ⚠️ 建议更新 |
```

---

### Phase 2: Commit（提交）

#### 2.1 查看变更

```bash
git status
git diff --stat
git log --oneline -5
```

#### 2.2 暂存并提交

```bash
git add -A
git commit -m "<type>: <描述>"
```

Commit message 规则：
- 使用 **英文**，遵循 Conventional Commits（`feat` / `fix` / `docs` / `refactor` / `test` / `chore`）
- 简洁描述 "why" 而非 "what"
- **不要提交** `.env`、`credentials.json` 等敏感文件（发现时警告并排除）

#### 2.3 验证

```bash
git status
```

---

### Phase 3: Push（推送）

```bash
git push origin <当前分支>
```

---

### Phase 4: Issue Sync（同步相关 Issue）

推送成功后，检查本次变更是否关联 Issue，并自动同步状态。

#### 4.1 识别关联 Issue

从以下来源识别本次变更关联的 Issue：

1. **Commit message** — 解析 `#N` 引用（如 `fix(acp): ... (#95)`）
2. **变更文件** — 检查 `.trellis/issues/` 目录下是否有新建或修改的 issue 文件
3. **代码注释** — 检查变更代码中引用的 `#N`（如 `// see #116`）

#### 4.2 更新 Issue 状态

对识别到的每个 Issue，根据变更性质执行对应操作：

| 变更性质 | Issue 操作 |
|----------|-----------|
| commit message 含 `fixes #N` / `closes #N` | `gh issue close N --comment "Closed by <commit-hash>"` |
| commit message 含 `#N`（非 close 关键字） | `gh issue comment N --body "Progress: <commit-hash> — <简述变更>"` |
| 新建了 `.trellis/issues/NNNN-*.md` | 确认 GitHub Issue 已创建（如未创建则提示） |
| 修改了 `.trellis/issues/NNNN-*.md` | 检查本地与 GitHub 是否同步（如有 dirty 则提示） |

#### 4.3 检查 Dirty Issue

```bash
./.trellis/scripts/issue.sh check-dirty
```

如有未同步的 Issue，输出提醒：

```
⚠️ 以下 Issue 有本地修改未同步到 GitHub:
  - #95: ACP Gateway Terminal ...
  - #116: Long-term SDK ...
运行 `./.trellis/scripts/issue.sh sync --all` 同步。
```

#### 4.4 输出 Issue 同步报告

```
## Issue 同步报告

| Issue | 操作 | 状态 |
|-------|------|------|
| #95 | 添加评论 (progress) | ✅ 已同步 |
| #116 | 确认 GitHub 已创建 | ✅ |
| #117 | 确认 GitHub 已创建 | ✅ |
```

---

推送和 Issue 同步完成后输出最终摘要：

```
## 完成摘要

- 提交: <hash> <message>
- 分支: <branch> → origin/<branch>
- 变更: N files changed, +insertions, -deletions
- Issue: N 个 Issue 已同步
```

---

## 安全规则

- **绝不** `git push --force`（除非用户明确要求）
- **绝不** 提交含密钥的文件
- **绝不** 修改 git config
- **绝不** 使用 `--no-verify` 跳过 hooks
- 如 pre-commit hook 失败，修复后创建 **新提交**，不要 amend

---

## 与其他命令的关系

```
开发流程:
  编写代码 → 测试 → /trellis-ship → /trellis-record-session
                      |
          ┌───────────┼───────────┬────────────┐
          ↓           ↓           ↓            ↓
   /trellis-finish-work  Commit    Push     Issue Sync
    （审查清单）      （提交）   （推送）  （同步 Issue）
```

| 命令 | 职责 |
|------|------|
| `/trellis-finish-work` | 审查清单（被本命令调用） |
| `/trellis-ship` | 审查 + 提交 + 推送 + Issue 同步（本命令） |
| `/trellis-record-session` | 记录会话和进度 |
| `/trellis-update-spec` | 更新规范文档 |
