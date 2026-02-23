# Changelog — v0.1.2

> **日期**: 2026-02-23
> **变更范围**: v0.1.0 → v0.1.2

---

## ✨ 新功能 (Features)

- feat(core): add initializer pipeline, template hot-reload, and process log capture (#8 #9 #37) (e97f8eb)
- feat: implement dual-layer agent tool permission management (#36) (73cbe54)

## 🐛 修复 (Fixes)

- fix(cli): use spawn instead of fork for daemon background start on Windows (#57) (20dcc47)
- fix(workflow): use gh CLI directly for issue sync in ship command (9eb9e5d)
- fix(core): preserve schedule, permissions, plugins, extensions in template loader (#118) (249609a)
- fix(cli): correct daemon-entry.js path resolution and add startup health check (#57) (c453057)
- fix(acp): implement terminal callback forwarding in Gateway via TerminalHandle map (#95) (17abeb9)

## ♻️ 重构 (Refactoring)

- refactor(core): unify config abstraction and validation (#119) (58ad981)
- refactor(core): unify template auto-loading into loadDomainComponents flow (ce00b8e)

## 📝 文档 (Documentation)

- docs: sync spec docs for #119 and enforce spec check in ship workflow (ad06c11)
- docs: add Issue sync phase to trellis-ship workflow (b75ad60)
- docs: add Phase 4 Issue Sync to trellis-ship command workflow (a8809e8)
- docs: update README for v0.1.0 with full feature overview, architecture, and usage guide (272e8f2)

## 🔧 杂项 (Chores)

- chore(issues): mark #57 as closed in local issue cache (94cdd0a)
- chore: reconcile issue tracker with GitHub, close expired issues, and update roadmap (c373864)
- chore: close issues #51-#56, #58, #59 after v0.1.0 implementation and sync to GitHub (d691824)

---

## 📋 Issue 变更

### 待处理 (Open Issues)

_无待处理 issue_

---

## 统计

| 指标 | 数量 |
|------|------|
| 提交总数 | 16 |
| 变更文件 | 162 |
| 已关闭 Issue | 0 |
| 待处理 Issue | 0 |
