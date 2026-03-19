# QA Round 4 - 回归测试报告

**时间**: 2026-02-25 ~11:15
**HEAD**: 7f57024
**触发**: 新 ship (PR #169: docs(guides): dev workflow guide)
**前轮**: R3 BUILD FAIL → 已恢复

## 统计

| 指标 | 值 |
|------|------|
| 总步骤 | 50 |
| PASS | 49 |
| WARN | 1 |
| FAIL | 0 |
| 通过率 | 98% |

## 与前轮对比

| 轮次 | PASS | WARN | FAIL | 通过率 |
|------|------|------|------|--------|
| R1 | 49/50 | 1 | 0 | 98% |
| R2 | 48/52 | 4 | 0 | 92.3% |
| R3 | BUILD FAIL | — | — | N/A |
| **R4** | **49/50** | **1** | **0** | **98%** |

- R1 Step 15 时序 WARN **未复现**
- R2 daemon version WARN 已不再标记（已知行为）
- 唯一 WARN: cursor backend start 已知限制

## WARN 详情

| Step | 描述 | 严重度 |
|------|------|--------|
| 28 | cursor backend 不支持 agent start | 低 — 已知限制 |

## 总体评估

构建恢复，回归测试通过。通过率恢复至 98%，与 R1 持平。PR #169 为纯 docs 变更，未影响功能。
