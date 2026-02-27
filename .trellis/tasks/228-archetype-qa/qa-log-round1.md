# QA Log — Round 1: #228 Archetype Deep Review

## [Step 1] Full Unit Test Suite
**时间**: 2026-02-27T13:10:01

### 输入
```
pnpm test
```

### 输出
```
exit_code: 0

--- stdout ---
Test Files  72 passed (72)
     Tests  942 passed (942)
  Duration  16.56s
```

### 判断: PASS
全量 942 个单元测试全部通过，无失败、无跳过。

---

## [Step 2] Code Review — Static Analysis of #228 Changes
**时间**: 2026-02-27T13:10:20

### 输入
Research subagent 对 10 个核心变更文件进行深度代码审查

### 发现

#### Finding 2a: Dashboard agent-card.tsx 仍引用 "tool" [CRITICAL]
- `packages/dashboard/client/src/components/agents/agent-card.tsx` 中:
  - `archetype ?? "tool"` fallback 未更新为 `"repo"`
  - `archetypeStyles` 对象有 `tool` key 但无 `repo` key
- **影响**: Dashboard 显示错误的 archetype 标签和样式

#### Finding 2b: ToolScope 层级比较 undefined 安全性 [LOW]
- `session-context-injector.ts` 的 `ARCHETYPE_LEVEL[meta.archetype]`:
  - 若 archetype 为 undefined，`undefined < N` 在 JS 中为 false
  - 结果：undefined archetype → 所有工具都可用（含 employee-only 工具）
- **影响**: 理论上的安全问题，实际上 Zod schema 保证 archetype 始终有值

#### Finding 2c: Canvas handler undefined archetype [LOW]
- `canvas-handlers.ts` 的 `meta.archetype === "repo"`:
  - 若 archetype 为 undefined，不等于 "repo"，canvas 更新被允许
- **影响**: 同上，Zod default 保证不会出现

#### Finding 2d: 缺少 "tool" → "repo" 迁移测试 [LOW]
- `instance-meta-io.test.ts` 未测试写入 archetype: "tool" 后读取是否变为 "repo"
- **影响**: 迁移逻辑虽已实现但缺乏显式测试覆盖

### 判断: FAIL (Finding 2a), WARN (2b, 2c, 2d)
Dashboard 是面向用户的界面，archetype 显示错误是可见的 Bug。

---

## [Step 3] Verify Finding 2a — Dashboard agent-card.tsx
**时间**: 2026-02-27T13:11:30

### 输入
```
grep "tool" packages/dashboard/client/src/components/agents/agent-card.tsx
```

### 输出
```
Line 31:  tool: "bg-purple-50 text-purple-700 border-purple-200",
Line 38:  const archetype = agent.archetype ?? "tool";
Line 140: className={archetypeStyles[archetype] ?? archetypeStyles.tool}
```

### 判断: FAIL
确认 3 处 "tool" 引用未更新：
1. `archetypeStyles` 对象有 `tool` key 但无 `repo` key
2. `archetype ?? "tool"` fallback 使用旧名称
3. fallback 样式引用 `archetypeStyles.tool`

**影响分析**：
- 当 agent.archetype 为 "repo"（新默认值）时，`archetypeStyles["repo"]` 为 undefined，回退到 `archetypeStyles.tool`（紫色），**样式正确（碰巧）但 key 名错误**
- 当 agent.archetype 未定义时，显示文本为 "tool" 而非 "repo"
- 总体：UI 文本错误 + 代码维护性问题

---

## [Step 4] Grep "tool" across all source files (excluding node_modules/dist)
**时间**: 2026-02-27T13:12:00

### 输入
```
grep archetype.*"tool"|"tool".*archetype in packages/**/*.{ts,tsx}
```

### 输出
仅以下位置有 "tool" 残留（排除 migration layer 和 build artifacts）：
- `packages/dashboard/client/src/components/agents/agent-card.tsx` (3处)
- `packages/core/src/state/instance-meta-schema.ts` (migration layer, 正确保留)

### 判断: PASS
除 Dashboard 外，所有代码正确。Migration layer 是有意保留的。

---

## [Step 5] Verify QA test script
**时间**: 2026-02-27T13:12:15

### 输入
```
Read .trellis/tasks/qa-restapi-blackbox/dash-test-agent-flow.py line 115
```

### 输出
```python
has_archetype = "tool" in body
```

### 判断: WARN
QA 临时脚本引用旧 archetype，但该文件是一次性测试脚本，不影响生产。建议更新但不阻塞。

---

## [Step 6] Fix F1 — Dashboard agent-card.tsx
**时间**: 2026-02-27T13:13:00

### 输入
StrReplace 3 次修改 `packages/dashboard/client/src/components/agents/agent-card.tsx`:
1. `archetypeStyles` key: `tool` → `repo`
2. Fallback: `agent.archetype ?? "tool"` → `agent.archetype ?? "repo"`
3. Style fallback: `archetypeStyles.tool` → `archetypeStyles.repo`

### 判断: PASS (修复确认)

---

## [Step 7] Fix F2 — QA test script
**时间**: 2026-02-27T13:13:05

### 输入
StrReplace `dash-test-agent-flow.py` line 115: `"tool"` → `"repo"`

### 判断: PASS (修复确认)

---

## [Step 8] Fix F3 — session-context-injector.ts undefined guard
**时间**: 2026-02-27T13:13:10

### 输入
```typescript
// Before
if (ARCHETYPE_LEVEL[meta.archetype] < SCOPE_MIN_LEVEL[tool.scope]) continue;
// After
const level = ARCHETYPE_LEVEL[meta.archetype] ?? 0;
if (level < SCOPE_MIN_LEVEL[tool.scope]) continue;
```

### 判断: PASS (修复确认)
undefined archetype 现在 fallback 到 level 0 (repo)，最受限权限。

---

## [Step 9] Fix F4 — 添加 migration 测试
**时间**: 2026-02-27T13:13:15

### 输入
新增测试 `instance-meta-io.test.ts`:
```typescript
it("should migrate legacy archetype 'tool' to 'repo' on read", ...)
```

### 输出
```
pnpm test:changed → 22 files, 280 tests passed (含新增测试)
```

### 判断: PASS

---

## [Step 10] Phase 4 回归 — 全量测试
**时间**: 2026-02-27T13:14:14

### 输入
```
pnpm test
```

### 输出
```
exit_code: 0
Test Files  72 passed (72)
     Tests  943 passed (943)
  Duration  21.00s
```

### 判断: PASS
全量 943 测试通过（Round 1 为 942，+1 为新增 migration 测试）。

---
