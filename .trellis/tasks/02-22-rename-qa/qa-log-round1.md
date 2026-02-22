# QA Log — Rename Verification Round 1

**范围**: 项目重命名 AgentCraft → Actant 全量校验
**环境**: Windows, 静态分析 + 构建 + 测试
**时间**: 2026-02-22

---

### [Step 1] packages/ 源码残留检查
**输入**: `Grep -i "agentcraft" packages/ --count`
**输出**: No matches found
**判断: PASS** — packages/ 目录零残留

---

### [Step 2] 根配置文件残留检查
**输入**: `Grep -i "agentcraft" vitest.config.ts vitest.endurance.config.ts package.json AGENTS.md README.md`
**输出**: No matches found
**判断: PASS** — 根配置文件零残留

---

### [Step 3] docs/ 文档残留检查
**输入**: `Grep -i "agentcraft" docs/ --count`
**输出**: `docs/stage/v0.1.0/changelog.md:1`
**详情**: `#38 项目重命名：AgentCraft → Actant` — 描述重命名操作本身
**判断: PASS** — 唯一匹配是 Issue #38 标题，属于历史记录，保留正确

---

### [Step 4] configs/ 配置文件残留检查
**输入**: `Grep -i "agentcraft" configs/ --count`
**输出**: No matches found
**判断: PASS** — 配置文件零残留

---

### [Step 5] .trellis/spec/ 规范文档残留检查
**输入**: `Grep -i "agentcraft" .trellis/spec/ --count`
**输出**: `.trellis/spec/frontend/index.md:2`
**详情**:
- Line 3: `> Guidelines for AgentCraft's user-facing interfaces.`
- Line 9: `AgentCraft follows a **CLI-First** strategy.`
**判断: FAIL** — 遗漏 2 处品牌名未替换，需修复

---

### [Step 6] .trellis/roadmap.md 残留检查
**输入**: `Grep -i "agentcraft" .trellis/roadmap.md`
**输出**: No matches found
**判断: PASS** — 路线图零残留

---

### [Step 7] .agents/ 技能文件残留检查
**输入**: `Grep -i "agentcraft" .agents/ --count`
**输出**: No matches found
**判断: PASS** — 代理技能配置零残留

---

### [Step 8] .cursor/ 规则残留检查
**输入**: `Grep -i "agentcraft" .cursor/ --count`
**输出**: No matches found
**判断: PASS** — Cursor 规则配置零残留

---

### [Step 9] @agentcraft/ import 路径残留检查
**输入**: `Grep "@agentcraft/" packages/ --count`
**输出**: No matches found
**判断: PASS** — import 路径全部已替换

---

### [Step 10] AGENTCRAFT_ 环境变量残留检查
**输入**: `Grep "AGENTCRAFT_" packages/ --count`
**输出**: No matches found
**判断: PASS** — 环境变量全部已替换

---

### [Step 11] pnpm build
**输入**: `npx pnpm build`
**输出**: 6/6 packages built successfully, CLI entry: dist/bin/actant.js
**判断: PASS** — 构建成功

---

### [Step 12] pnpm type-check
**输入**: `npx pnpm run type-check`
**输出**: 6/6 packages passed type-check
**判断: PASS** — 类型检查通过

---

### [Step 13] pnpm test (全量)
**输入**: `npx pnpm test`
**输出**: Test Files: 49 passed (49), Tests: 538 passed (538)
**判断: PASS** — 全部 538 测试通过

---

### [Step 14] package.json name 字段一致性
**输入**: `Grep '"name":\s*"@actant/' packages/ --glob package.json`
**输出**: 6 packages all with @actant/* names (shared, core, cli, api, acp, mcp-server)
**判断: PASS** — 包名全部正确

---

### [Step 15] .trellis/issues/ 残留分析
**输入**: `Grep -i "agentcraft" .trellis/issues/ --count`
**输出**: 49 files with matches
**分析**:
- **githubRef 字段** (~35 files): `"blackplume233/AgentCraft#XX"` — 历史 GitHub 链接，GitHub 已设置重定向
- **Issue #38 body** (1 file): 重命名 issue 本身，包含新旧名称映射表
- **Issue #18 title** (1 file): 标题含 "AgentCraft API"，需更新
- **Issue body 中的代码引用** (~12 files): 历史记录中的旧代码路径引用
**判断: WARN** — githubRef 可更新但不影响功能（GitHub 重定向有效），个别 issue 标题/body 可选更新

---

### [Step 16] .trellis/spec/frontend/index.md 残留 — FAIL 确认
**输入**: Read .trellis/spec/frontend/index.md lines 1-10
**输出**:
```
> Guidelines for AgentCraft's user-facing interfaces.
...
AgentCraft follows a **CLI-First** strategy.
```
**判断: FAIL** — 明确的遗漏，需修复

---

