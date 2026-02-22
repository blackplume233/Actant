---
id: 22
title: CLI 包 console.log 违反质量规范 — 需引入结构化输出层
status: closed
labels:
  - cli
  - enhancement
  - "priority:P2"
  - quality
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#6"
closedAs: completed
createdAt: "2026-02-20T12:24:39"
updatedAt: "2026-02-20T16:17:44"
closedAt: "2026-02-20T16:17:44"
---

## 审查发现

`packages/cli` 中大量使用 `console.log/error`（30+ 处），违反 `.trellis/spec/backend/quality-guidelines.md` 中 "Don't: console.log" 的规定。

## 证据

涉及文件（共 12 个）：
- `commands/daemon/start.ts` — 4 处 console.log
- `commands/daemon/stop.ts` — 2 处
- `commands/daemon/status.ts` — 10 处
- `commands/agent/start.ts` — 1 处
- `commands/agent/stop.ts` — 1 处
- `commands/agent/status.ts` — 2 处
- `commands/agent/list.ts` — 1 处
- `commands/agent/create.ts` — 3 处
- `commands/agent/destroy.ts` — 3 处
- `commands/template/validate.ts` — 3 处
- `commands/template/show.ts` — 1 处
- `commands/template/load.ts` — 1 处
- `commands/template/list.ts` — 1 处
- `output/error-presenter.ts` — 8 处
- `repl/repl.ts` — 2 处

## 分析

CLI 作为用户面向的输出层，使用 console.log 是常见做法。但项目质量规范明确禁止了这一点。需要做出选择：

1. **严格路线**：引入 CLI 专用输出层（如 `CliPrinter` / `OutputAdapter`），封装所有用户面向输出，内部使用 pino logger
2. **务实路线**：在质量规范中为 CLI 包添加例外说明，明确 CLI 的 console 使用规则

## 建议

建议采用方案 1，创建 `packages/cli/src/output/printer.ts` 统一管理所有终端输出，好处：
- 便于统一切换输出格式（text/json/yaml）
- 便于测试（mock printer 而非 console）
- 与 `--format` CLI 选项自然对接
- 消除质量规范的违规项

---

## Comments

### cursor-agent — 2026-02-20T16:17:44

Closed as completed
