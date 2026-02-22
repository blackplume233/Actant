---
id: 44
title: "E2E CLI 测试: ESM 模块解析失败 (ERR_MODULE_NOT_FOUND)"
status: open
labels:
  - bug
  - testing
  - qa
  - "priority:P1"
milestone: short-term
author: qa-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/cli/src/__tests__/e2e-cli.test.ts
  - packages/shared/dist/index.js
  - packages/shared/tsconfig.json
taskRef: null
githubRef: "blackplume233/Actant#96"
closedAs: null
createdAt: "2026-02-21T20:05:00"
updatedAt: "2026-02-21T20:05:00"
closedAt: null
---

**Related Files**: `packages/cli/src/__tests__/e2e-cli.test.ts`, `packages/shared/dist/index.js`, `packages/shared/tsconfig.json`

---

## 测试发现

**场景**: /qa-loop 单元测试套件执行
**步骤**: `npx vitest --reporter=verbose`

## 问题描述

`packages/cli/src/__tests__/e2e-cli.test.ts` 中 12 个测试全部失败。

失败分为两类：
1. **9 个测试** — 命令退出码为 1（期望为 0），根因是 CLI 二进制执行时抛出 ESM 模块解析错误
2. **3 个测试** — 错误消息不匹配，根因同上

## 错误信息

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'G:\Workspace\AgentWorkSpace\AgentCraft\packages\shared\dist\types\index'
imported from G:\Workspace\AgentWorkSpace\AgentCraft\packages\shared\dist\index.js
```

## 根因分析

编译后的 `packages/shared/dist/index.js` 使用 ESM `import` 语法导入 `./types/index`（无 `.js` 扩展名）。在 Node.js ESM 模式下，模块解析要求显式的文件扩展名。

`packages/shared/dist/types/index.js` 文件实际存在，但 ESM 解析器不会自动补全 `.js` 扩展名。

可能原因：
- tsconfig `module`/`moduleResolution` 配置不匹配 ESM 要求
- 缺少构建时的路径重写插件（如 tsc-alias 或 tsup）
- 或 dist 产物未重建（与源码不同步）

## 复现方式

```bash
npx vitest packages/cli/src/__tests__/e2e-cli.test.ts --reporter=verbose
```

## 影响范围

- 12/412 单元测试失败（97.1% 通过率）
- 全部失败集中在 E2E CLI 测试文件
- 非 E2E 的 400 个单元测试全部通过
