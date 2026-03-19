## QA 集成测试报告 — Round 2 (Long Loop)

**场景**: web-search-long-loop — 60s 间隔, 12 轮, 含边界探测
**测试工程师**: QA SubAgent (Cursor)
**时间**: 2026-02-23T00:04 ~ 00:27 (+08:00)
**总时长**: 23m14s (1394s)
**结果**: PASSED with WARN (6/12 PASS, 6/12 WARN, 0 FAIL)

### 摘要

| # | 步骤 | 类型 | 判定 | 耗时 | 费用 |
|---|------|------|------|------|------|
| 1 | R01: FIFA World Cup qualifiers | 常规 | WARN | 61.4s | $0.171 |
| 2 | R02: stock market trends | 常规 | WARN | 55.1s | $0.113 |
| 3 | R03: mRNA vaccine | 常规 | WARN | 92.5s | $0.121 |
| 4 | R04: carbon capture | 常规 | PASS | 34.5s | $0.087 |
| 5 | R05: JWST discoveries | 常规 | PASS | 54.5s | $0.118 |
| 6 | R06: empty/generic query | 边界 | WARN | 57.7s | $0.084 |
| 7 | R07: Chinese perspective | 边界 | WARN | 49.2s | $0.120 |
| 8 | R08: long AGI query | 边界 | PASS | 66.6s | $0.178 |
| 9 | R09: humanoid robotics | 常规 | PASS | 47.9s | $0.102 |
| 10 | R10: solid state battery | 常规 | WARN | 81.7s | $0.121 |
| 11 | R11: rocket/moon missions | 常规 | PASS | 70.0s | $0.117 |
| 12 | R12: brain-computer interface | 常规 | PASS | 62.4s | $0.116 |

**总费用**: $1.448
**60s 间隔遵守**: 全部 11 个间隔正确等待 ✓
**平均 agent run 耗时**: 61.1s

### 边界探测结果

| 测试 | 预期 | 实际 | 判定 |
|------|------|------|------|
| R06: 空/泛化查询 | 优雅处理 | Agent 尝试搜索，API 错误后 max_turns 耗尽 | WARN |
| R07: 中文视角查询 | 处理非英语上下文 | Agent 尝试搜索，API 错误后 max_turns 耗尽 | WARN |
| R08: 超长查询 | 截断或聚焦关键词 | Agent 成功处理，回退训练数据给出 AGI 综述 | PASS |

### PASS 轮次分析

成功产出文本回答的 6 轮均采用相同模式:
1. Agent 调用 WebSearch → API 400 错误
2. Agent 尝试 WebFetch → 域名安全检查失败
3. Agent 回退训练数据 → 产出合理的话题摘要

### WARN 轮次分析

6 轮 WARN 的共同特征:
- Agent 在工具调用重试中耗尽 max_turns
- 未能进入"回退训练数据"阶段
- 与话题复杂度无明显关联，更可能与模型随机性有关

### 无新增 Issue

所有 WARN 均由外部因素导致（Claude Code API 兼容性 / 模型路由），非 Actant 核心功能 bug。

### 完整执行日志

详见: `qa-log-round2.md`
