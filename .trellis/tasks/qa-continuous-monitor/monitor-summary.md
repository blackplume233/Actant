# QA 持续监测汇总

**启动时间**: 2026-02-25 09:55
**当前时间**: 2026-02-25 09:55
**总运行时长**: 0 分钟
**基线 HEAD 变迁**: aec18f7a → afc2ae0 → 0e4ed49 → 51ec005 → 7f57024 → 7bcd996 → 2c860a9 → 2f4c3e7
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

## 监测检查记录

| 检查时间 | 基线 | 结果 |
|----------|------|------|
| 10:15 | afc2ae0 | 新 ship → Round 2 |
| 10:35 | 0e4ed49 | 新 ship → Round 3 (BUILD FAIL) |
| 10:50 | 51ec005 | 无变化 |
| 11:00 | 51ec005 | 无变化 (连续2次) |
| 11:10 | 51ec005 | 新 ship → Round 4 |
| 11:25 | 7f57024 | 无变化 |
| 11:35 | 7f57024 | 无变化 (连续2次) |
| 11:45 | 7f57024 | 无变化 (连续3次) |
| 11:55 | 7f57024 | 无变化 (连续4次) |
| 12:05 | 7f57024 | 新 ship → Round 5 |
| 12:30-13:30 | 7bcd996 | 无变化 (连续8次) |
| 13:40 | 7bcd996 | 新 ship → Round 6 |
| 14:00 | 2c860a9 | 新 ship → Round 7 (BUILD FAIL) |

## 覆盖的 PR

| PR | 标题 | 回归结果 |
|----|------|---------|
| #164 | docs(trellis): update developer identity spec | R1 PASS |
| #162 | feat(core): backend-aware provider env injection | R1 PASS |
| #165 | feat(phase4): wave-1 bug fixes | R2 PASS (version WARN) |
| #166 | fix(scripts): harden install.ps1 | R2 未覆盖（脚本级） |
| #167 | fix(api): initialize EmployeeScheduler | R2 PASS |
| #168 | fix(scripts): harden install.ps1 (#166 merge) | R3 BUILD FAIL, R4 PASS |
| #169 | docs(guides): dev workflow guide | R4 PASS |
| #170 | feat(source): community source type | R5 PASS |
| #172 | fix(issue-cli): CJK encoding | R5 未覆盖（CLI 级） |
| #174 | docs(issues): scheduler 4-mode design | R6 PASS |
| #175 | feat: Instance Interaction Archetype | R7 BUILD FAIL (picomatch types) |

## 通过率趋势

```
R1: █████████░ 98%
R2: █████████░ 92%
R3: ░░░░░░░░░░ BUILD FAIL
R4: █████████░ 98%
R5: █████████░ 96%
R6: █████████░ 98%
R7: ░░░░░░░░░░ BUILD FAIL
```

## 状态

持续监测中 — 等待新 ship
