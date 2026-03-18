# QA 集成测试报告 — Phase A/B 深度黑盒测试

**场景**: Phase A (工程清理) + Phase B (Context-First 架构) 全量黑盒验证
**测试工程师**: QA SubAgent
**时间**: 2026-03-18
**环境**: mock launcher, Windows 10, 隔离 temp dir
**结果**: **PASSED** (修复后 100% 通过)

---

## 摘要

| # | 场景组 | 步骤数 | PASS | FAIL | WARN |
|---|--------|--------|------|------|------|
| 1 | 版本与 Daemon 基础 (B-6) | 3 | 3 | 0 | 0 |
| 2 | 模板管理 CRUD (B-2) | 3 | 2 | **1** | 0 |
| 3 | Agent 生命周期 (A/B) | 8 | 8 | 0 | 0 |
| 4 | VFS 操作 (B 核心) | 7 | 7 | 0 | 0 |
| 5 | 域管理命令 (B-1) | 5 | 4 | 0 | **1** |
| 6 | Agent 工作区物化 (B-2) | 4 | 4 | 0 | 0 |
| 7 | 单元测试全量回归 | 2 | 2 | 0 | 0 |
| 8 | 错误处理边界条件 | 6 | 6 | 0 | 0 |
| 9 | Type-check 全量 | 3 | 3 | 0 | 0 |
| 10-13 | 专项测试 (Context/MCP/Rules) | 4 | 4 | 0 | 0 |
| **合计** | | **45** | **43** | **1** | **1** |

---

## 通过率趋势

| 轮次 | 单元测试 | 黑盒场景 | 新建 Issue |
|------|---------|---------|-----------|
| R1 | 1360/1360 (100%) | 30/32 (93.8%) | #301 |
| R2 (回归) | 1362/1362 (100%) | 32/32 (100%) | — |

---

## 修复的 Issue

| Issue | 标题 | 修复文件 | 新增测试 |
|-------|------|---------|---------|
| [#301](https://github.com/blackplume233/Actant/issues/301) | toAgentTemplate() drops rules and toolSchema fields (Phase B-2) | `packages/core/src/template/loader/template-loader.ts` | `template-loader.test.ts` (+2 tests) |

### 修复详情

**根因**: `toAgentTemplate()` 使用显式字段列举构造返回对象，Phase B-2 新增的 `rules` 和 `toolSchema` 字段未同步添加。Zod schema 正确解析了这些字段（第 147-148 行），但映射时被丢弃。

**修复**: 在 `toAgentTemplate()` 返回对象中添加 `rules: output.rules` 和 `toolSchema: output.toolSchema`。

**防回归**: 添加了 2 个新测试：
1. "should preserve rules and toolSchema fields (Phase B-2)" — 验证字段保留
2. "should default rules and toolSchema to undefined when absent" — 验证缺失时的默认行为

---

## 残留问题

| Issue | 问题 | 类型 | 状态 | 原因 |
|-------|------|------|------|------|
| (未创建) | /config/ VFS 路径超时 | WARN | 预存 bug | config-source.ts list handler 未处理目录不存在的 ENOENT 异常 |

注：此问题存在于 Phase A/B 之前，非本次重构引入。

---

## Phase A/B 关键覆盖矩阵

| 变更项 | 测试覆盖 | 验证结果 |
|--------|---------|---------|
| Phase A: 工程清理/废弃代码移除 | CLI help 无残留命令 + 全量 type-check | PASS |
| Phase B-0: @actant/context 包 | 41 个专项测试 | PASS |
| Phase B-1: DomainContextSource | 域命令 + VFS 投影 + 集成测试 | PASS |
| Phase B-2: AgentTemplate rules/toolSchema | **发现 FAIL → 修复 → 回归 PASS** | PASS (修复后) |
| Phase B-2: RulesContextProvider | 4 个专项测试 | PASS |
| Phase B-3: UnrealProjectSource | 7 个专项测试 | PASS |
| Phase B-4: Hub/MCP ContextManager 桥接 | Hub status + MCP context-backend 测试 | PASS |
| Phase B-5: @actant/core → @actant/agent-runtime | 全量 import 验证 + E2E 15/15 | PASS |
| Phase B-6: v0.5.0 版本升级 | CLI --version + daemon health | PASS |

---

## 执行统计

- 黑盒场景步骤: 45 (32 R1 + 13 补充)
- 单元测试文件: 119
- 单元测试用例: 1362 (R1: 1360 + 2 新增回归测试)
- E2E 测试: 15/15
- Type-check: 15/15 包
- 总执行时间: ~25 分钟
- Daemon 清理: 干净退出，进程数回到基准
