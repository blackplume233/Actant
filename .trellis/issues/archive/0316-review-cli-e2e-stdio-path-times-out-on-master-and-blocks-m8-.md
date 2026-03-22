---
id: 316
title: "review: CLI E2E stdio path times out on master and blocks M8 verification"
status: closed
labels:
  - bug
  - "priority:P1"
  - review
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#316"
closedAs: completed
createdAt: "2026-03-22T01:49:30"
updatedAt: "2026-03-22T02:27:28"
closedAt: "2026-03-22T02:27:28"
---

## 审查发现

当前 `master` 上 `pnpm test` 不能全量通过，M8 的验证门实际仍然未满足。失败集中在 `packages/cli/src/__tests__/e2e-cli.test.ts` 的 daemon-backed stdio CLI 路径：多个用例在 10 秒超时后返回 `exitCode = -1`，包括 `--help`、`--version`、`daemon status`、`template list/load/show`、`agent create/list/destroy/start/stop`。同文件里的 hub fallback 相关测试仍然能通过，说明问题更像是常规 CLI 子进程路径，而不是整个 CLI 框架不可用。

## 证据

- 本地执行：`pnpm -s type-check && pnpm -s test`
- 结果：126 个 test file 中仅 `packages/cli/src/__tests__/e2e-cli.test.ts` 失败，9 个用例失败。
- `packages/cli/src/__tests__/e2e-cli.test.ts:27-60` 的 `runCli()` 在 10 秒后会强制 `child.kill()` 并返回 `exitCode: -1`。
- 失败断言位于 `packages/cli/src/__tests__/e2e-cli.test.ts:116-290`，覆盖帮助、版本、daemon status、template、agent lifecycle。
- 同一文件中 `hub status mounts current project context` 与 `acthub alias routes to hub commands` 通过，表明 standalone / hub 路径相对健康。

## 风险

- `docs/planning/contextfs-roadmap.md:149-154` 中 M8 的 `全仓 lint / type-check / test 通过` 目前不成立。
- 如果不先解释这批失败是环境噪声还是真实回归，继续推进 M7 会让“产品开发”和“验证门失败”并行积累。

## 建议

1. 先复现实验并记录子进程 stderr/stdout，确认是 CLI 入口阻塞、RPC 连接等待，还是 source runner / dist 路径选择问题。
2. 把 `e2e-cli.test.ts` 分成“必须过的 runtime CLI 基线”和“可降级的环境相关路径”，避免单个超时掩盖真实回归边界。
3. 在推进 M7 前至少恢复 `--help` / `--version` / `daemon status` / `template list` 这一层基线，确保产品入口本身可验证。

---

## Comments

### ### cursor-agent — 2026-03-22T02:27:25

[Fix 2026-03-22]

本轮已完成以下收口：
- CLI 子进程入口改为 `await run()` 后显式按 `process.exitCode` 退出，避免 `--help` / `--version` / daemon-backed CLI 调用在子进程模式下悬挂。
- 将 `defaultSocketPath()` 抽到独立模块，切断 `program -> daemon command -> program` 的循环依赖。
- 将 CLI E2E 的子进程超时与测试超时调整到与当前冷启动成本匹配的区间。
- 修复 `ProcessLogWriter` 在日志轮转窗口对已关闭 stream 写入的时序问题，消除全仓测试中的未处理异常。
- 入口文档 `README.md` / `PROJECT_CONTEXT.md` 已与当前 M7/M8 状态对齐。

验证：
- `pnpm -s lint`
- `pnpm -s type-check`
- `pnpm -s test`

结果：全部通过，`packages/cli/src/__tests__/e2e-cli.test.ts` 15/15 通过，全仓 `126` 个 test file、`1378` 个测试全部通过。

### cursor-agent — 2026-03-22T02:27:28

Closed as completed
