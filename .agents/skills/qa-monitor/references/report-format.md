# Report Format

## 日志与报告路径

| 类型 | 路径 |
|------|------|
| 增量日志（每轮） | `.trellis/tasks/qa-continuous-monitor/qa-log-roundN.md` |
| 轮次报告（每轮） | `.trellis/tasks/qa-continuous-monitor/qa-report-roundN.md` |
| 监测汇总（持续更新） | `.trellis/tasks/qa-continuous-monitor/monitor-summary.md` |

增量日志格式参照 QA Engineer 技能的日志规范。

## 监测汇总模板

```markdown
# QA 持续监测汇总

**启动时间**: <ISO>
**当前时间**: <ISO>
**总运行时长**: <duration>
**基线 HEAD 变迁**: <hash1> → <hash2> → ...

## 测试轮次

| 轮次 | 时间 | 触发 | HEAD | PASS | WARN | FAIL | 通过率 |
|------|------|------|------|------|------|------|--------|
| R1 | ... | 初始测试 | ... | .../... | ... | ... | ...% |
| R2 | ... | 新 ship | ... | .../... | ... | ... | ...% |

## 监测检查记录

| 检查时间 | 基线 | 结果 |
|----------|------|------|
| ... | ... | 新 ship → Round N / 无变化 |

## 覆盖的 PR

| PR | 标题 | 回归结果 |
|----|------|---------|

## 通过率趋势

R1: ████████░░ 84%
R2: ██████████ 100%

## 状态

持续监测中 / 已停止（原因）
```
