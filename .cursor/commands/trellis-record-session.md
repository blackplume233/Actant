[!] **Prerequisite**: This command should only be used AFTER the human has tested and committed the code.

**AI must NOT execute git commit** - only read history (`git log`, `git status`, `git diff`).

> `codex-loop` 是例外：它会在每一轮结束后自动调用底层 `add-session.sh` 记录运行轨迹。  
> 这些自动记录可以没有 commit，重点是保留 round 级别的检查结果；不替代人工在任务收尾时执行的 `/trellis-record-session`。

---

## Record Work Progress (Simplified - Only 2 Steps)

### Step 1: Get Context

```bash
bash ./.trellis/scripts/get-context.sh
```

### Step 2: One-Click Add Session

```bash
# Method 1: Simple parameters
bash ./.trellis/scripts/add-session.sh \
  --title "Session Title" \
  --commit "hash1,hash2" \
  --summary "Brief summary of what was done"

# Method 2: Pass detailed content via stdin
cat << 'EOF' | bash ./.trellis/scripts/add-session.sh --title "Title" --commit "hash"
| Feature | Description |
|---------|-------------|
| New API | Added user authentication endpoint |
| Frontend | Updated login form |

**Updated Files**:
- `packages/api/modules/auth/router.ts`
- `apps/web/modules/auth/components/login-form.tsx`
EOF
```

**Auto-completes**:
- [OK] Appends session to journal-N.md
- [OK] Auto-detects line count, creates new file if >2000 lines
- [OK] Updates index.md (Total Sessions +1, Last Active, line stats, history)

Session summary should preserve the same delivery facts used by changelog drafts:

- 变更摘要
- 验证结果
- 关联 PR / commit / issue
- 如本轮是 ship / merge 级交付，补充对应 `docs/agent/changelog-drafts/*.md` 路径

---

## Archive Completed Task (if any)

If a task was completed this session:

```bash
bash ./.trellis/scripts/task.sh archive <task-name>
```

---

## Script Command Reference

| Command | Purpose |
|---------|---------|
| `get-context.sh` | Get all context info |
| `add-session.sh --title "..." --commit "..."` | **One-click add session (recommended)** |
| `task.sh create "<title>" [--slug <name>]` | Create new task directory |
| `task.sh archive <name>` | Archive completed task |
| `task.sh list` | List active tasks |
