## QA 集成测试报告 — Rename Verification

**场景**: 项目重命名 AgentCraft → Actant 全量校验
**测试工程师**: QA SubAgent
**时间**: 2026-02-22
**结果**: PASSED (16/16 步骤通过, 0 警告)

### 摘要

| # | 检查维度 | 范围 | R1 判定 | R2 判定 |
|---|---------|------|---------|---------|
| 1 | packages/ 源码残留 | *.ts, *.json | PASS | PASS |
| 2 | 根配置文件残留 | vitest, package.json, AGENTS.md | PASS | PASS |
| 3 | docs/ 文档残留 | *.md, *.json, *.html | PASS | PASS |
| 4 | configs/ 配置残留 | *.json | PASS | PASS |
| 5 | .trellis/spec/ 规范残留 | *.md | **FAIL → 修复** | PASS |
| 6 | .trellis/roadmap.md 残留 | md | PASS | PASS |
| 7 | .agents/ 技能残留 | *.md, *.json | PASS | PASS |
| 8 | .cursor/ 规则残留 | *.mdc, *.md | PASS | PASS |
| 9 | @agentcraft/ import 路径 | packages/*.ts | PASS | PASS |
| 10 | AGENTCRAFT_ 环境变量 | packages/*.ts | PASS | PASS |
| 11 | pnpm build | 全量构建 | PASS | PASS |
| 12 | pnpm type-check | 6 packages | PASS | PASS |
| 13 | pnpm test (全量) | 49 files, 538 tests | PASS | PASS |
| 14 | package.json name 一致性 | 6 packages | PASS | PASS |
| 15 | .trellis/issues/ githubRef | 49 files | **WARN → 修复** | PASS |
| 16 | .trellis/scripts/ GitHub API | *.sh, *.mjs | **FAIL → 修复** | PASS |

### 通过率趋势

| 轮次 | 单元测试 | 静态检查 | 新发现/修复 |
|------|---------|---------|------------|
| R1 | 538/538 | 13/16 | 3 个 FAIL/WARN |
| R2 (回归) | 538/538 | 16/16 | 0 — 全部修复 |

### Round 1 发现与修复

| 问题 | 位置 | 类型 | 修复 |
|------|------|------|------|
| "AgentCraft" 品牌名遗漏 | `.trellis/spec/frontend/index.md` (2处) | FAIL | ✅ 已修复 |
| GitHub API repo 名 | `.trellis/scripts/stage-version.sh` (2处) | FAIL | ✅ 已修复 |
| GitHub API repo 名 | `.trellis/scripts/sync-github-issues.mjs` (1处) | FAIL | ✅ 已修复 |
| githubRef 未更新 | `.trellis/issues/*.json` (43 files) | WARN | ✅ 已修复 |
| Issue #18 标题 | `.trellis/issues/0018-acp-fleet-extension.json` | WARN | ✅ 已修复 |
| Issue body 旧品牌名 | `.trellis/issues/` (11 files) | WARN | ✅ 已修复 |
| .claude/commands/qa.md | `.claude/commands/qa.md` | WARN | ✅ 已修复 |

### 预期保留项（不修改）

| 文件 | 原因 |
|------|------|
| `docs/stage/v0.1.0/changelog.md` | 记录重命名操作本身 |
| `.trellis/issues/0038-rename-agentcraft-to-actant.json` | 重命名 issue 本体 |
| `.trellis/issues/0044-*` / `0055-*` | 文件系统路径 `AgentWorkSpace/AgentCraft` |
| `.trellis/tasks/*/qa-report-*.md` | 历史 QA 报告 |
| `.trellis/tasks/*/task.json` | 历史任务数据 |

### 验收标准最终确认

- [x] `pnpm build` 成功（6/6 packages）
- [x] `pnpm type-check` 无错误（6/6 packages）
- [x] `pnpm test` 全部通过（49 files, 538 tests）
- [x] `packages/` 目录零 "agentcraft" 残留
- [x] CLI 入口 `dist/bin/actant.js`
- [x] 所有 package.json name 为 `@actant/*`
- [x] 所有 import 路径为 `@actant/*`
- [x] 所有环境变量为 `ACTANT_*`
- [x] docs/ 文档全量替换
- [x] .trellis/spec/ 规范全量替换
- [x] .trellis/issues/ githubRef 批量更新
- [x] GitHub API 脚本 repo 名更新
- [x] Git remote URL 指向 `blackplume233/Actant`
