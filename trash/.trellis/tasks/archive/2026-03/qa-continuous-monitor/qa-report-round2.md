# QA Round 2 - 回归测试报告

**时间**: 2026-02-25 ~10:25
**HEAD**: 0e4ed49
**触发**: 新 ship (afc2ae0 → 0e4ed49)
**涉及 PR**: #162, #164, #165, #166, #167

## 统计

| 指标 | 值 |
|------|------|
| 总步骤 | 52 |
| PASS | 48 |
| WARN | 4 |
| FAIL | 0 |
| 通过率 | 92.3% |

## 与 R1 对比

| 项目 | R1 | R2 | 变化 |
|------|-----|-----|------|
| PASS | 49/50 | 48/52 | 新增步骤 |
| WARN | 1 | 4 | +3 (新发现 + 已知限制) |
| FAIL | 0 | 0 | 持平 |

- **改善**: R1 Step 15 (agent list 时序) 本次未复现
- **新 WARN**: daemon version="unknown", cursor start 限制, mock 时序

## WARN 详情

| Step | 描述 | 严重度 |
|------|------|--------|
| 1 | daemon status version="unknown" | 中 — PR #165 修了 ping version 但可能需要环境配置 |
| 28 | cursor backend 不支持 agent start | 低 — 已知限制 |
| 49 | EmployeeScheduler agent status 时序 | 低 — mock 模式特有 |
| 51 | daemon version 仍为 "unknown" | 中 — 同 Step 1 |

## PR 特定验证

| PR | 验证 | 结果 |
|----|------|------|
| #167 | EmployeeScheduler 初始化 | PASS — agent 可正常 start/stop/destroy |
| #165 | ping version 修复 | WARN — version 仍为 "unknown" |
| #166 | install.ps1 改进 | 未覆盖（脚本级别，非 CLI 测试） |
| #164 | docs 更新 | N/A |
| #162 | provider env injection | 隐式覆盖于模板加载 |

## 总体评估

回归通过，无 FAIL。核心功能（agent 生命周期、模板、边界处理、并发、幂等）均正常。建议对 daemon version 显示问题单独开 Issue。
