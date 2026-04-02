---
name: qa-monitor
description: "Continuous QA monitoring daemon that watches git HEAD for new commits, automatically triggers full regression tests on each new ship, delegates test execution to qa-engineer, tracks pass-rate trends across rounds, and exits after configurable idle rounds. Use when invoking /qa-watch, setting up continuous QA monitoring, watching for new ships, or running automated regression testing on code changes."
license: MIT
allowed-tools: Shell, Read, Write, Glob, Grep, Task
dependencies:
  - skill: qa-engineer
    path: .agents/skills/qa-engineer
    usage: 每轮测试的执行引擎（场景回放、智能判断、日志写入）
  - skill: issue-manager
    path: .agents/skills/issue-manager
    usage: 测试发现问题时创建/更新 Issue
---

# QA 持续监测 SubAgent

## 指令解析

指令格式：`/qa-watch [options]`

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--interval N` | 轮询间隔（分钟） | `10` |
| `--mock` | 使用 mock launcher 模式 | 不设置（真实模式） |
| `--scenario <name>` | 指定测试场景 | `random-walk-comprehensive` |
| `--skip-initial` | 跳过初始测试，直接进入监测循环 | 不设置 |
| `--max-idle N` | 最大连续空闲轮数（0 = 无限） | `0` |

## 执行流程

### Phase 0: 初始化

```bash
LAST_HEAD=$(git rev-parse HEAD)
mkdir -p .trellis/tasks/qa-continuous-monitor/
pnpm build
```

创建 `monitor-summary.md`，记录启动时间、基线 HEAD、配置参数。

### Phase 1: 初始测试（除非 `--skip-initial`）

1. 创建隔离临时目录（见 [environment-config.md](references/environment-config.md)）
2. 启动 Daemon，加载测试模板（见 [delegation-and-templates.md](references/delegation-and-templates.md)）
3. 委托 QA Engineer SubAgent 执行指定场景
4. 收集结果、写入报告（见 [report-format.md](references/report-format.md)）
5. 清理：停止 Daemon + 删除临时目录

### Phase 2: 监测循环

```bash
while true; do
  sleep "${INTERVAL}m"
  CURRENT_HEAD=$(git rev-parse HEAD)
  if [ "$CURRENT_HEAD" != "$LAST_HEAD" ]; then
    git log --oneline "$LAST_HEAD".."$CURRENT_HEAD"
    pnpm build || { echo "Build failed → Round FAIL"; continue; }
    # Run full regression (same as Phase 1, round number increments)
    # Log: qa-log-roundN.md / Report: qa-report-roundN.md
    LAST_HEAD="$CURRENT_HEAD"
    IDLE_COUNT=0
  else
    IDLE_COUNT=$((IDLE_COUNT + 1))
    [ "$MAX_IDLE" -gt 0 ] && [ "$IDLE_COUNT" -ge "$MAX_IDLE" ] && break
  fi
done
```

### Phase 3: 每轮测试执行

1. Record new commits: `git log --oneline <LAST_HEAD>..HEAD`
2. Rebuild: `pnpm build` (if build fails, record Round FAIL and continue monitoring)
3. Run full regression test (same flow as Phase 1, round number increments)
4. Update `monitor-summary.md` with round results

## 清理策略

每轮测试结束后（无论成败）**必须**执行：

1. `agent destroy <name> --force` for all residual agents (ignore errors)
2. `daemon stop`
3. `rm -rf $TEST_DIR` / `Remove-Item -Recurse -Force $TEST_DIR`

## References

| File | Content |
|------|---------|
| [environment-config.md](references/environment-config.md) | Platform-specific env setup (Windows/Unix), CLI execution pattern |
| [delegation-and-templates.md](references/delegation-and-templates.md) | Test templates, delegation prompt, regression test phases (A-G) |
| [report-format.md](references/report-format.md) | Log paths, report structure, monitor-summary template |
