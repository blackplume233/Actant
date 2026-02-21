# /qa-loop 循环验证汇总

**范围**: `docs/design/acp-complete-server-architecture.md` — 设计文档 vs 代码一致性
**环境**: Windows 10 / Node.js 22.17.1 / real mode
**总轮次**: 2
**最终结果**: **PASS**

---

## 通过率趋势

| 轮次 | 单元测试 | 文档一致性 (56项) | 新建 Issue |
|------|---------|------------------|-----------|
| R1   | 400/412 (97.1%) | 51 PASS, 3 WARN, 4 FAIL | #43 #44 |
| R2   | **412/412 (100%)** | 51 PASS, 3 WARN, 4 FAIL→已标注 | — |

## 修复的 Issue

| Issue | 标题 | 修复文件 |
|-------|------|---------|
| #44 | E2E CLI 测试 ESM 模块解析失败 | shared/core/acp/api/cli 全包 dist/ 重建 |
| (文档) | Phase 2 状态标注不精确 | docs/design/acp-complete-server-architecture.md |

## 残留问题

| Issue | 标题 | 状态 | 原因 |
|-------|------|------|------|
| #43 | ACP Gateway Terminal 回调 IDE 转发 stub | open | SDK AgentSideConnection 未暴露接口，需底层扩展 |

## 验证覆盖范围

| 模块 | 文件数 | 检查项数 | 通过率 |
|------|--------|---------|--------|
| ACP Gateway | 2 (gateway.ts, callback-router.ts) | 19 | 78.9% (4 FAIL) |
| ACP Connection | 1 (connection.ts) | 14 | 100% |
| Terminal Manager | 1 (terminal-manager.ts) | 6 | 100% (1 WARN) |
| Proxy | 1 (proxy.ts) | 3 | 100% |
| Types/Exports | 3 (rpc.types.ts, index.ts, communicator.ts) | 10 | 100% |
| Session/Manager | 2 (session-handlers.ts, connection-manager.ts) | 3 | 100% |
| Backend Resolver | 1 (backend-resolver.ts) | 1 | 100% |

## 报告文件

- [Round 1 详细报告](qa-report-round1.md)
- [Round 2 回归报告](qa-report-round2.md)
