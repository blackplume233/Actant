# QA Round 9 - 完整回归测试报告

**场景**: 50 步标准回归
**测试工程师**: QA SubAgent
**时间**: 2026-02-25
**HEAD**: 6aa2be5
**触发**: 新 ship (#159 hooks + event bus)

---

## 1. 结果摘要

| 指标 | 数值 |
|------|------|
| **总步骤** | 50 |
| **PASS** | 49 |
| **WARN** | 1 |
| **FAIL** | 0 |
| **通过率** | 98% (49/50) |

---

## 2. 与 R6 对比

| 轮次 | PASS | WARN | FAIL | 通过率 |
|------|------|------|------|--------|
| R6 | 49 | 1 (cursor start) | 0 | 98% |
| **R9** | **49** | **1 (cursor start)** | **0** | **98%** |

**结论**: 与 R6 基线一致，无回归。R7/R8 构建失败已恢复。

---

## 3. FAIL/WARN 摘要

### WARN 1: Step 28 - Cursor backend start

- **命令**: `agent start rw-cursor-1`
- **期望**: 已知 cursor backend 不支持 `start`（acp 模式）
- **实际**: `[RPC -32603] Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open]. Use agent resolve or agent open instead.`
- **判定**: PASS（预期行为），标为 WARN 仅因与 claude-code 行为差异，便于后续改进 cursor 文档或 UX

---

## 4. 总体评估

- **构建**: ✅ 恢复（R7/R8 picomatch 类型缺失已修复）
- **核心功能**: ✅ 全部通过（daemon、template、agent CRUD、生命周期、边界错误、域组件、并发、幂等）
- **已知限制**: ✅ cursor backend 不支持 `agent start`，需用 `resolve`/`open`，与 R6 一致
- **无新增 FAIL**，回归测试通过。
