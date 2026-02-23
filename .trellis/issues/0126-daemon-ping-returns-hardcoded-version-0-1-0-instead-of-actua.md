---
id: 126
title: daemon.ping returns hardcoded version 0.1.0 instead of actual package version
status: open
labels:
  - bug
  - "priority:P3"
  - api
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#126"
closedAs: null
createdAt: "2026-02-23T12:56:10Z"
updatedAt: "2026-02-23T12:56:43"
closedAt: null
---

## 现象

`actant daemon status -f json` 返回的 `version` 字段始终为 `"0.1.0"`，与实际安装版本不一致。

## 复现步骤

1. 安装 `@actant/cli@0.1.3`
2. `actant daemon start`
3. `actant daemon status -f json`
4. 输出 `{ "running": true, "version": "0.1.0", ... }`

## 期望行为

`version` 字段应返回 `@actant/api` 包的实际版本号（如 `0.1.3`）。

## 实际行为

`daemon.ping` handler 或 Daemon 类中的 version 为硬编码 `"0.1.0"`。

## 方案建议

与 CLI 的 `program.ts` 修复类似，从 `@actant/api/package.json` 动态读取版本号：

```typescript
const pkgPath = join(import.meta.dirname, "..", "package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf-8"));
```

## 相关文件

- `packages/api/src/daemon/daemon.ts` 或 daemon ping handler
