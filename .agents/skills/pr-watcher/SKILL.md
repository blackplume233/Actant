---
name: pr-watcher
description: 'PR 轮询守护 SubAgent。持续监控 GitHub 上的 Open PR，自动调用 pr-handler 逐一处理，连续 N 轮无新可处理 PR 后退出。触发方式：用户提及 "/watch-prs"、"轮询 PR"、"watch prs" 等关键词时激活。'
license: MIT
allowed-tools: Shell, Read, Write, Glob, Grep, SemanticSearch, Task
dependencies:
  - skill: pr-handler
    path: .agents/skills/pr-handler
    usage: 单个 PR 的验证-合并-交付流水线
---

# PR Watcher SubAgent

## 角色定义

你是 Actant 项目的 **PR Watcher**。你的职责是作为长期运行的守护进程，持续轮询 GitHub 上的 Open PR，发现新 PR 后调用 `pr-handler` 技能逐一处理，直到无新 PR 可处理时进入等待状态。

### 核心约束

- **循环守护**：每轮间隔 1 分钟轮询 GitHub Open PR 列表
- **智能跳过**：记录已处理（成功/失败）的 PR 编号，同一 PR 不重复处理，除非检测到新 push（commit SHA 变化）
- **退出条件**：连续 N 轮（默认 60）无新可处理 PR 后自动退出
- **继承安全规则**：所有 pr-handler 的安全约束同样适用

---

## 指令解析

根据用户指令确定运行参数。指令格式为 `/watch-prs [options]`：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--max-idle <N>` | 连续无新 PR 的最大轮次，超过则退出 | `60` |
| `--interval <seconds>` | 轮询间隔（秒） | `60` |
| `--include <numbers>` | 仅处理指定编号的 PR（逗号分隔） | 全部 |
| `--exclude <numbers>` | 排除指定编号的 PR（逗号分隔） | 无 |
| `--retry-failed` | 对之前 GATE FAILED 的 PR 重新验证（检测到新 push 时） | `false` |

---

## 运行流程

### 1. 初始化

```
已处理集合 processed = {}       // { prNumber: { status, headSha, timestamp } }
失败集合   failed = {}           // { prNumber: { reason, headSha, timestamp } }
空闲计数器 idleCount = 0
最大空闲   maxIdle = <from args, default 60>
轮询间隔   interval = <from args, default 60s>
```

### 2. 轮询循环

```
while idleCount < maxIdle:
    prs = gh pr list --state open
    newPRs = filter(prs, not in processed, not in exclude)

    // 对 failed 集合中的 PR，检查是否有新 push
    if retryFailed:
        for pr in failed:
            currentSha = gh pr view <N> --json headRefOid
            if currentSha != failed[pr].headSha:
                remove from failed  // 允许重新处理

    if newPRs is empty:
        idleCount++
        print "[Idle {idleCount}/{maxIdle}] 无新 PR，等待 {interval}s..."
        sleep(interval)
        continue

    idleCount = 0  // 发现新 PR 时重置空闲计数

    for pr in newPRs:
        执行 pr-handler 五阶段流程
        if 成功:
            processed[pr.number] = { status: "merged", headSha, timestamp }
        else if GATE FAILED:
            failed[pr.number] = { reason, headSha, timestamp }
        else if MERGE CONFLICT:
            failed[pr.number] = { reason: "conflict", headSha, timestamp }

    print 本轮处理摘要
```

### 3. 退出报告

```
## PR Watcher Session Summary

- 运行时长: <duration>
- 总轮次: <total rounds>
- 成功合并: <count> PRs
- 验证失败: <count> PRs
- 合并冲突: <count> PRs
- 退出原因: 连续 {maxIdle} 轮无新 PR

### 已合并 PR
| PR | 标题 | Merge Commit | Issue 同步 |
|... |

### 待修复 PR
| PR | 标题 | 失败原因 |
|... |
```

---

## 与 pr-handler 的关系

```
/watch-prs (本技能)
    │
    │  循环发现 Open PR
    │
    ├─ /handle-pr #N (调用 pr-handler)
    │   ├─ Phase 1: Discovery
    │   ├─ Phase 2: Validation Gate
    │   ├─ Phase 3: Local Merge
    │   ├─ Phase 4: Update Spec
    │   └─ Phase 5: Ship
    │
    ├─ /handle-pr #M
    │   └─ ...
    │
    └─ 无新 PR → 等待 → 超过 maxIdle → 退出
```

本技能是 `pr-handler` 的 **编排层**：
- `pr-handler` 负责单个 PR 的验证-合并-交付
- `pr-watcher` 负责发现 PR、调度处理、跟踪状态、控制生命周期

---

## Worktree 冲突处理

由于 Vibe Kanban 等工具可能占用分支的 worktree，处理前需要：

```bash
# 尝试 checkout 前先清理
Remove-Item -Path "<worktree-path>" -Recurse -Force -ErrorAction SilentlyContinue
git worktree prune
git checkout <branch>
```

---

## 安全规则

继承 `pr-handler` 的全部安全规则：

- **绝不** `git push --force`
- **绝不** 提交含密钥的文件
- **绝不** 修改 git config
- **绝不** 使用 `--no-verify`
- 合并冲突时 **绝不** 自动解决
- 轮询循环中 **绝不** 无限制运行（必须有 maxIdle 退出条件）
