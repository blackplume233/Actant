# QA 集成测试报告 — Round 1

**场景**: 修复 #118 — toAgentTemplate() 丢失 schedule/permissions/plugins/extensions
**测试工程师**: QA SubAgent
**时间**: 2026-02-22
**结果**: PASSED (9/9 步骤通过, 0 警告)

## 摘要

| # | 步骤 | 命令 | 判定 |
|---|------|------|------|
| 1 | 启动 Daemon | `daemon start --foreground` | PASS |
| 2 | 加载含新字段的模板 | `template load full-featured-template.json` | PASS |
| 3 | template show 验证 | `template show scheduled-web-searcher` | PASS |
| 4 | JSON 完整输出验证 | `template show --format json` | PASS |
| 5 | 回归：最小模板 | `template load minimal-template.json` | PASS |
| 6 | 回归：标准模板 | `template load valid-template.json` | PASS |
| 7 | template list | `template list` | PASS |
| 8 | 单元测试 64 项 | `vitest run src/template` | PASS |
| 9 | 停止 Daemon | `daemon stop` | PASS |

## 修复验证

### #118: toAgentTemplate() 丢失 schedule/permissions/plugins/extensions

**修复内容**:
- `packages/core/src/template/loader/template-loader.ts` — `toAgentTemplate()` 函数新增 4 个字段映射:
  - `domainContext.plugins`
  - `domainContext.extensions`
  - `permissions`
  - `schedule`

**验证结果**:
- ✅ `schedule.heartbeat.intervalMs=20000` 正确保留
- ✅ `schedule.cron[0].pattern="0 */6 * * *"` 正确保留
- ✅ `schedule.hooks[0].eventName="user:request"` 正确保留
- ✅ `permissions.allow=["WebSearch","WebFetch","Read"]` 正确保留
- ✅ `permissions.deny=["Write"]` 正确保留
- ✅ `permissions.sandbox.enabled=true` 正确保留
- ✅ `domainContext.plugins=["rate-limiter","cache"]` 正确保留
- ✅ `domainContext.extensions.customSources=["rss-feed","api-endpoint"]` 正确保留
- ✅ 最小模板（无新字段）不受影响，持久化 JSON 无多余空字段

## 测试覆盖变更

| 变更 | 文件 | 详情 |
|------|------|------|
| 新增 fixture | `__fixtures__/full-featured-template.json` | 包含所有可选字段的模板 |
| 新增 3 项测试 | `template-loader.test.ts` | schedule/permissions/plugins/extensions 专项 |
| 更新 2 项测试 | `template-registry.test.ts` | 适配新增 fixture 的计数 |

## 完整执行日志

参见: `qa-log-round1.md`

## 创建的 Issue

无新 Issue（本轮全部 PASS）
