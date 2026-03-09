# QA Round 5 - 回归测试报告

**时间**: 2026-02-25 ~12:20
**HEAD**: 7bcd996
**触发**: 新 ship (PR #170, #172)

## 统计

| 指标 | 值 |
|------|------|
| 总步骤 | 52 |
| PASS | 50 |
| WARN | 1 |
| FAIL | 1 |
| 通过率 | 96.2% |

## 与前轮对比

| 轮次 | PASS | WARN | FAIL | 通过率 |
|------|------|------|------|--------|
| R4 | 49/50 | 1 | 0 | 98% |
| **R5** | **50/52** | **1** | **1** | **96.2%** |

## FAIL 详情

### Step 23: agent restart (命令不存在)
- **命令**: `agent restart qa-r5-claude`
- **结果**: `error: unknown command 'restart'`
- **分析**: CLI 没有 `agent restart` 子命令。应使用 `agent stop` + `agent start`。属于测试设计问题，非功能退化。
- **严重度**: 低 — 功能可通过 stop+start 实现

## WARN 详情

| Step | 描述 |
|------|------|
| 28 | cursor backend 不支持 agent start（已知限制） |

## PR 特定验证

| PR | 验证 | 结果 |
|----|------|------|
| #170 | source list 命令 + community 类型 | PASS — `source list` 返回 [] |
| #172 | CJK encoding 修复 | 未覆盖（CLI 级别无法直接验证） |

## 总体评估

核心功能正常。唯一 FAIL 为测试场景使用了不存在的 `agent restart` 命令，非功能退化。建议后续测试场景统一使用 stop+start 替代 restart。
