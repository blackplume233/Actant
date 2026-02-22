# Ship - 审查、提交、推送一站式流程

编排 `/trellis:finish-work` 的审查清单，并追加 Commit 和 Push 操作，一次完成交付。

**时机**: 代码编写完成后，准备交付时执行。

---

## 执行流程

### Phase 1: Review（执行 finish-work 审查清单）

**执行 `/trellis:finish-work` 中定义的全部检查项**，包括：

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

#### 2.2 Issue 同步检查

确保所有本地 Issue 变更已推送到 GitHub，避免提交时本地缓存与远端不一致：

```bash
./.agents/skills/issue-manager/scripts/issue.sh check-dirty --strict
```

- 如果有 dirty Issue，先执行 `issue.sh sync --all` 再继续
- 如果 `gh` CLI 不可用，标记为 "⚠️ 跳过" 并继续

#### 2.3 暂存并提交

```bash
git add -A
git commit -m "<type>: <描述>"
```

Commit message 规则：
- 使用 **英文**，遵循 Conventional Commits（`feat` / `fix` / `docs` / `refactor` / `test` / `chore`）
- 简洁描述 "why" 而非 "what"
- **不要提交** `.env`、`credentials.json` 等敏感文件（发现时警告并排除）
- 如修复 Issue，在 message 中引用编号（如 `(#118)`），以便 Phase 4 自动关联

#### 2.4 验证

```bash
git status
```

---

### Phase 3: Push（推送）

```bash
git push origin <当前分支>
```

---

### Phase 4: Issue 状态更新与同步

Push 成功后，根据 commit message 中的 Issue 引用自动更新状态。

#### 4.1 解析 commit message 中的 Issue 引用

从最新 commit message 中提取 Issue 编号：
- `(#NNN)` — 关联引用（不自动关闭，仅添加评论）
- `fixes #NNN` / `closes #NNN` / `resolves #NNN` — 自动关闭

#### 4.2 更新 Issue 状态

对于每个引用的 Issue：

```bash
# 自动关闭类引用（fixes/closes/resolves）
./.agents/skills/issue-manager/scripts/issue.sh close <id>
./.agents/skills/issue-manager/scripts/issue.sh comment <id> "Fixed in <commit-hash>."

# 关联类引用（仅 (#NNN)），如果 Issue 确实已修复也关闭
./.agents/skills/issue-manager/scripts/issue.sh comment <id> "Addressed in <commit-hash>."
```

**判断规则**：
- commit message 包含 `fix` 类型且引用了 Issue → 关闭该 Issue
- commit message 仅括号引用 `(#NNN)` → 根据上下文判断：修复类 commit 则关闭，文档/重构类仅评论
- 如果 Issue 已关闭，跳过

#### 4.3 同步到 GitHub

```bash
./.agents/skills/issue-manager/scripts/issue.sh sync --all
```

确保本地关闭状态同步到 GitHub。如果 `gh` CLI 不可用，标记为 "⚠️ 跳过"。

#### 4.4 输出 Issue 更新报告

```
## Issue 更新

| Issue | 操作 | 状态 |
|-------|------|------|
| #118  | 关闭 + 评论 | ✅ 已同步 / ⚠️ 跳过 |
```

---

推送和 Issue 更新完成后输出最终摘要：

```
## 完成摘要

- 提交: <hash> <message>
- 分支: <branch> → origin/<branch>
- 变更: N files changed, +insertions, -deletions
- Issue: #NNN 已关闭 / 无关联 Issue
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
  编写代码 → 测试 → /trellis:ship → /trellis:record-session
                      |
          ┌───────────┼───────────┬──────────┐
          ↓           ↓           ↓          ↓
   /trellis:finish-work  Commit    Push    Issue Sync
    （审查清单）       （提交）   （推送）（状态更新）
```

| 命令 | 职责 |
|------|------|
| `/trellis:finish-work` | 审查清单（被本命令调用） |
| `/trellis:ship` | 审查 + 提交 + 推送 + Issue 同步（本命令） |
| `/trellis:record-session` | 记录会话和进度 |
| `/trellis:update-spec` | 更新规范文档 |
| `issue.sh` | Issue 管理 CLI（被 Phase 2.2 和 Phase 4 调用） |
