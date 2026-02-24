# Ship - 审查、提交、推送一站式流程

编排 `/trellis:finish-work` 的审查清单，并追加 Commit 和 Push 操作，一次完成交付。

**时机**: 代码编写完成后，准备交付时执行。

---

## 执行流程

### Phase 1: Review（执行 finish-work 审查清单）

**执行 `/trellis:finish-work` 中定义的全部检查项**，包括：

1. **代码质量** — 运行 `pnpm lint`、`pnpm type-check`、`pnpm test`
2. **代码模式扫描** — 检查 `console.log`、`any` 类型、非空断言
3. **Spec 文档同步** — **必须检查**，按下方规则判断是否需要更新
4. **API / 数据库 / 跨层变更** — 按变更范围检查对应项

如果命令因依赖未安装而失败，标记为 "⚠️ 跳过" 并继续。
如果有实质性错误（❌），**停止流程**，先修复再重新执行。

#### 1.3 Spec 文档同步检查（强制）

Spec 文档同步是 **必选项**（❌ 级别），不通过则阻止提交。

**检测方法**：分析本次变更涉及的文件和代码，判断是否命中以下触发条件。

| 触发条件 | 需更新的 Spec 文档 |
|---------|------------------|
| `packages/shared/src/types/` 下类型定义变更（新增/删除/改签名） | `config-spec.md` |
| `packages/core/src/template/schema/` 下 Zod schema 变更 | `config-spec.md` |
| 环境变量增删改 | `config-spec.md` |
| `packages/shared/src/types/rpc.types.ts` 中 RPC 方法/参数/返回变更 | `api-contracts.md` |
| `packages/api/src/handlers/` 中 handler 行为变更 | `api-contracts.md` |
| `packages/cli/src/commands/` 中命令签名/选项变更 | `api-contracts.md` |
| 错误码增删改 | `api-contracts.md` |
| 内部契约接口（Launcher/Manager/Communicator）签名变更 | `api-contracts.md` |

**判断流程**：
1. 运行 `git diff --name-only` 获取变更文件列表
2. 匹配上述触发路径
3. 若命中，检查对应 spec 文档是否也在变更列表中
4. 若 spec 文档未更新，标记为 **❌ spec 未同步**，列出需要更新的文档和触发原因
5. **立即中止 ship 流程**，不进入 Phase 2

**重要：ship 不负责修改 spec 文件。** 检测到不同步时，输出诊断信息后终止，要求用户先通过 `/trellis:update-spec` 或手动更新 spec 文档，然后重新执行 `/trellis:ship`。

**输出格式（中止时）**：
```
spec 文档同步检查：
  - config-spec.md: ❌ 需更新（检测到 packages/shared/src/types/ 变更）
  - api-contracts.md: ✅ 已同步

❌ Ship 已中止：spec 文档未同步。
请先更新以上标记为 ❌ 的 spec 文档，然后重新执行 /trellis:ship。
```

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
| spec/config-spec.md | ✅ 已同步 / ❌ 需更新 / — 无关 |
| spec/api-contracts.md | ✅ 已同步 / ❌ 需更新 / — 无关 |
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

**必须直接使用 `gh` CLI 操作 GitHub（权威源），再更新本地缓存。** 不依赖 `issue.sh` 的 bash 脚本（在 Windows 环境下不可靠）。

对于每个引用的 Issue：

```bash
# 1. 先确认 GitHub 上的实际状态
gh issue view <N> --json state

# 2a. 需要关闭的 Issue（fixes/closes/resolves 引用，或 fix 类型 commit 的括号引用）
gh issue close <N> -c "Completed in <commit-hash>."

# 2b. 仅需添加评论的 Issue（docs/refactor 类型的括号引用）
gh issue comment <N> -b "Progress: addressed in <commit-hash>."

# 3. 更新本地缓存文件（如存在）
#    修改 .trellis/issues/NNNN-*.md 中的 status/closedAt 字段
```

**判断规则**：
- commit message 包含 `fix` 类型且引用了 Issue → 关闭该 Issue
- commit message 仅括号引用 `(#NNN)` → 根据上下文判断：修复类 commit 则关闭，文档/重构类仅评论
- 如果 GitHub 上 Issue 已关闭，跳过

#### 4.3 验证同步

操作完成后，验证 GitHub 状态与本地缓存一致：

```bash
# 验证 GitHub 实际状态
gh issue view <N> --json state,closedAt
```

如果 `gh` CLI 不可用，标记为 "⚠️ 跳过" 并在报告中提醒手动操作。

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
          ┌───────────┼──────────────┬──────────┐
          ↓           ↓              ↓          ↓
   Phase 1: Review    Phase 2:     Phase 3:   Phase 4:
   ├─ 代码质量        Commit       Push       Issue Sync
   ├─ 模式扫描
   └─ Spec 同步 (❌ 阻断)
       ├─ config-spec.md
       └─ api-contracts.md
```

| 命令 | 职责 |
|------|------|
| `/trellis:finish-work` | 审查清单（被本命令调用） |
| `/trellis:ship` | 审查 + Spec 同步 + 提交 + 推送 + Issue 同步（本命令） |
| `/trellis:record-session` | 记录会话和进度 |
| `/trellis:update-spec` | 更新规范文档 |
| `issue.sh` | Issue 管理 CLI（被 Phase 2.2 和 Phase 4 调用） |
