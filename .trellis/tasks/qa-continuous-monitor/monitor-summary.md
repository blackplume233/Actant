# QA 持续监测汇总

**启动时间**: 2026-02-25 09:55
**当前时间**: 2026-02-25 22:00
**总运行时长**: ~12h
**基线 HEAD 变迁**: aec18f7a → ... → c375bd3
**配置**: interval=10min, mock=true, scenario=random-walk-comprehensive

## 测试轮次

| 轮次 | 时间 | 触发 | HEAD | PASS | WARN | FAIL | 通过率 |
|------|------|------|------|------|------|------|--------|
| R1 | 10:00 | 初始测试 | afc2ae0 | 49/50 | 1 | 0 | 98% |
| R2 | 10:25 | 新 ship | 0e4ed49 | 48/52 | 4 | 0 | 92.3% |
| R3 | 10:40 | 新 ship | 51ec005 | BUILD FAIL | — | — | N/A |
| R4 | 11:15 | 新 ship | 7f57024 | 49/50 | 1 | 0 | 98% |
| R5 | 12:20 | 新 ship | 7bcd996 | 50/52 | 1 | 1 | 96.2% |
| R6 | 13:50 | 新 ship | 2c860a9 | 49/50 | 1 | 0 | 98% |
| R7 | 14:05 | 新 ship | 2f4c3e7 | BUILD FAIL | — | — | N/A |
| R8 | 14:50 | 新 ship | 8aa4d83 | BUILD FAIL | — | — | N/A |
| R9 | 15:15 | 新 ship | 6aa2be5 | 49/50 | 1 | 0 | 98% |
| R10 | 15:50 | 新 ship | 3c84b02 | 47/50 | 3 | 0 | 94% |
| R11 | 16:10 | 新 ship | 3305ea1 | 46/50 | 4 | 0 | 92% |
| R12 | 17:40 | 新 ship | c375bd3 | 48/50 | 2 | 0 | 96% |

## 覆盖的 PR

| PR | 标题 | 回归结果 |
|----|------|---------|
| #162 | feat(core): backend-aware provider env injection | R1 PASS |
| #164 | docs(trellis): update developer identity spec | R1 PASS |
| #165 | feat(phase4): wave-1 bug fixes | R2 PASS |
| #166 | fix(scripts): harden install.ps1 | R2 未覆盖 |
| #167 | fix(api): initialize EmployeeScheduler | R2 PASS |
| #168 | fix(scripts): install.ps1 merge | R3 BUILD FAIL → R4 PASS |
| #169 | docs(guides): dev workflow guide | R4 PASS |
| #170 | feat(source): community source type | R5 PASS |
| #172 | fix(issue-cli): CJK encoding | R5 未覆盖 |
| #174 | docs(issues): scheduler 4-mode design | R6 PASS |
| #175 | feat: Instance Interaction Archetype | R7 BUILD FAIL → R9 PASS |
| #159 | feat(hooks): Hook type system + event bus | R9 PASS |
| — | feat(backend): Pi builtin backend | R10 PASS (94%) |
| #176 | docs(wiki): VitePress wiki | R11 PASS (92%) |
| #179 | feat(hooks): unified event system + schedule refactoring | R12 PASS (96%) |

## 通过率趋势

```
R1:  █████████░ 98%
R2:  █████████░ 92%
R3:  ░░░░░░░░░░ BUILD FAIL
R4:  █████████░ 98%
R5:  █████████░ 96%
R6:  █████████░ 98%
R7:  ░░░░░░░░░░ BUILD FAIL
R8:  ░░░░░░░░░░ BUILD FAIL
R9:  █████████░ 98%
R10: █████████░ 94%
R11: █████████░ 92%
R12: █████████░ 96%
```

## 统计总结

- **总轮次**: 12 (9 次完整测试 + 3 次 BUILD FAIL)
- **成功测试中平均通过率**: 95.6%
- **总 FAIL**: 1 (R5 的 agent restart，测试设计问题)
- **0 个功能性 FAIL**
- **常见 WARN**: cursor backend start 限制, mock 模式时序, agent list 缓存

## 状态

持续监测中 — 等待新 ship
