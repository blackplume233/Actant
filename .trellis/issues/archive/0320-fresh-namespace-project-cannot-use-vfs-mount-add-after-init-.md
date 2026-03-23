---
id: 320
title: Fresh namespace project cannot use vfs mount add after init + hub status
status: closed
labels:
  - bug
  - "priority:P1"
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - package.json
  - packages/cli/src/commands/hub/index.ts
  - packages/api/src/services/namespace-authoring.ts
taskRef: null
githubRef: "blackplume233/Actant#320"
closedAs: completed
createdAt: "2026-03-23T04:36:27"
updatedAt: "2026-03-23T06:03:53"
closedAt: "2026-03-23T06:03:53"
---

**Related Files**: `package.json`, `packages/cli/src/commands/hub/index.ts`, `packages/api/src/services/namespace-authoring.ts`

---

## 测试发现

**场景**: 空目录 + Codex CLI 驱动的真实用户初始化流程
**步骤**: `actant init --scaffold minimal` -> `actant hub status` -> `actant vfs mount add --type hostfs --path /extra --host-path ./extra`

## 复现方式

```bash
TEST_ROOT=$(mktemp -d -t actant-codex-e2e-XXXXXX)
mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/workspace" "$TEST_ROOT/home"

cat > "$TEST_ROOT/bin/actant" <<'SH'
#!/bin/sh
exec /opt/homebrew/opt/node@22/bin/node /Users/muyuli/Workspace/AgentCraft/scripts/run-workspace-entry.mjs /Users/muyuli/Workspace/AgentCraft/packages/cli/src/bin/actant.ts "$@"
SH
chmod +x "$TEST_ROOT/bin/actant"

export PATH="$TEST_ROOT/bin:$PATH"
export ACTANT_HOME="$TEST_ROOT/home"
export ACTANT_SOCKET="$TEST_ROOT/home/actant.sock"
cd "$TEST_ROOT/workspace"

actant init --scaffold minimal
actant hub status
mkdir extra
actant vfs mount add --type hostfs --path /extra --host-path ./extra
```

## 期望行为

在 fresh project 完成 `init` 和 `hub status` 之后，用户应当能直接通过 `actant vfs mount add` 修改 namespace 配置并立即看到结果，或者 CLI 至少应给出清晰且自动可达的下一步。

## 实际行为

命令稳定失败：

```text
[RPC -32000] VFS mutation is disabled in context profile for path "/extra". Start a runtime host for write operations.
```

补充观察：
- `actant namespace validate` 在 `hub status` 之后顺序执行是可通过的。
- `actant vfs mount list` 只显示 `/workspace` 和 `/config`，说明 `/extra` 未写入配置。
- `actant hub list /` 仍然可读，说明 fresh project 处于“可读、不可写”的半可用状态。

## 分析

当前 CLI 用户面把 `vfs mount add/remove/list` 描述为 namespace authoring surface，但真实 fresh-project 路径默认只启动 `context` host。结果是：用户按照最自然的 next step 继续操作时，立刻被 runtime host 前置条件拦住，而且 `init` / `hub status` 没有显式把这个约束说清楚。对外部 agent（如 Codex CLI）尤其不友好，因为它会把 `mount add` 当作普通配置写操作，而不是需要另一种 host profile 的 runtime mutation。

---

## Comments

### ### cursor-agent — 2026-03-23T06:03:51

--body-file

### cursor-agent — 2026-03-23T06:03:53

Closed as completed
