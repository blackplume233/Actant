# QA 集成测试报告 — #228 Archetype Deep Review

**场景**: #228 Agent 三层分类重定义 (tool→repo) 深度审查
**测试工程师**: QA SubAgent
**时间**: 2026-02-27T13:10–13:15
**结果**: **PASSED** (10/10 步骤通过, 修复后 100% 回归)

## 摘要

| # | 步骤 | 命令/操作 | 判定 | 备注 |
|---|------|----------|------|------|
| 1 | 全量单元测试 | `pnpm test` | PASS | 72 files, 942 tests |
| 2 | 代码审查 (10文件) | Research SubAgent | FAIL→Fixed | 发现 4 个问题 |
| 3 | 验证 Dashboard | Grep agent-card.tsx | FAIL→Fixed | 3 处 "tool" 残留 |
| 4 | 全源码 grep | Grep "tool" in packages/ | PASS | 仅 migration layer 保留 |
| 5 | QA 脚本检查 | Read dash-test-agent-flow.py | WARN→Fixed | |
| 6 | Fix F1: Dashboard | StrReplace ×3 | PASS | |
| 7 | Fix F2: QA 脚本 | StrReplace ×1 | PASS | |
| 8 | Fix F3: undefined guard | StrReplace ×1 | PASS | |
| 9 | Fix F4: migration test | 新增 1 测试 | PASS | |
| 10 | 全量回归 | `pnpm test` | PASS | 72 files, 943 tests |

## 通过率趋势

| 轮次 | 单元测试 | 代码审查 | 修复项 |
|------|---------|---------|--------|
| R1 (检测) | 942/942 | 4 findings | — |
| R1 (修复后) | 943/943 | 0 open | F1, F2, F3, F4 |

## 发现与修复

### F1 [FAIL → Fixed]: Dashboard agent-card.tsx 残留 "tool" 引用
- **文件**: `packages/dashboard/client/src/components/agents/agent-card.tsx`
- **问题**: `archetypeStyles` 对象有 `tool` key 无 `repo` key；fallback 值为 `"tool"`
- **影响**: Dashboard AgentCard 对 `repo` archetype 显示错误文本
- **修复**: 
  - `archetypeStyles.tool` → `archetypeStyles.repo`
  - `agent.archetype ?? "tool"` → `agent.archetype ?? "repo"`
  - style fallback: `archetypeStyles.tool` → `archetypeStyles.repo`

### F2 [WARN → Fixed]: QA 测试脚本过期断言
- **文件**: `.trellis/tasks/qa-restapi-blackbox/dash-test-agent-flow.py`
- **问题**: 检查 `"tool" in body` 而非 `"repo"`
- **修复**: `"tool"` → `"repo"`

### F3 [WARN → Fixed]: ToolScope undefined archetype 无防护
- **文件**: `packages/core/src/context-injector/session-context-injector.ts`
- **问题**: `ARCHETYPE_LEVEL[undefined]` 在 JS 中为 `undefined`，`undefined < N` 为 `false`，导致所有工具对 undefined archetype 都可用
- **修复**: `const level = ARCHETYPE_LEVEL[meta.archetype] ?? 0;` — undefined 回退到最低权限 (repo=0)

### F4 [WARN → Fixed]: 缺少 "tool"→"repo" 迁移测试
- **文件**: `packages/core/src/state/instance-meta-io.test.ts`
- **问题**: Zod migration layer (`z.literal("tool").transform(() => "repo")`) 无显式测试覆盖
- **修复**: 新增测试 `should migrate legacy archetype 'tool' to 'repo' on read`

## 残留问题
无。所有发现均已修复并通过回归验证。

## 详细日志
见 `qa-log-round1.md`
