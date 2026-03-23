---
id: 319
title: Local Actant installation paths fail in real-machine E2E setup
status: open
labels:
  - bug
  - "priority:P1"
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - scripts/install-local.mjs
  - scripts/build-standalone.mjs
  - packages/actant/package.json
taskRef: null
githubRef: "blackplume233/Actant#319"
closedAs: null
createdAt: "2026-03-23T04:36:27"
updatedAt: "2026-03-23T04:36:27"
closedAt: null
---

**Related Files**: `scripts/install-local.mjs`, `scripts/build-standalone.mjs`, `packages/actant/package.json`

---

## 测试发现

**场景**: 真实机器上尝试将当前仓库安装为可执行 `actant` CLI，以便在空目录中做黑盒 E2E 测试。
**步骤**: `node scripts/install-local.mjs --skip-build`，随后运行 `actant --version`；再尝试 `node scripts/install-local.mjs --standalone --force --install-dir /tmp/actant-self-host-bin`。

## 复现方式

```bash
cd /Users/muyuli/Workspace/AgentCraft

# link mode
node scripts/install-local.mjs --skip-build
actant --version

# standalone mode
node scripts/install-local.mjs --standalone --force --install-dir /tmp/actant-self-host-bin
```

## 期望行为

至少应有一种本地安装路径可稳定产出可执行的 `actant` CLI，供用户在仓库外真实使用。

## 实际行为

### 1. link mode 安装后 CLI 损坏

`actant --version` 直接报错，引用到了旧 worktree 的依赖路径：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/muyuli/Workspace/trellis-worktrees/codex/03-19-m1-contract-type-replacement/packages/cli/dist/program'
```

`npm list -g --depth=1 actant @actant/cli --json` 同时显示全局安装的 `actant` 依赖指向了旧 worktree：

```text
invalid: @actant/cli@0.5.0 /Users/muyuli/Workspace/AgentCraft/packages/actant/node_modules/@actant/cli
resolved: file:../../../../../trellis-worktrees/codex/03-19-m1-contract-type-replacement/packages/cli
```

### 2. standalone mode 构建失败

构建在 `postject` 注入阶段失败：

```text
Error: Can't read and write to target executable
```

对应命令：

```text
npx postject /Users/muyuli/Workspace/AgentCraft/dist-standalone/actant NODE_SEA_BLOB /Users/muyuli/Workspace/AgentCraft/dist-standalone/actant.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA
```

## 分析

这不是仓库内部测试问题，而是用户最接近真实分发的两条本地安装路径都不可靠：
- link mode 会继承或固化脏的 workspace / worktree 依赖解析，导致全局 CLI 指向过时路径。
- standalone mode 在当前 macOS 环境下无法完成 SEA 注入，无法提供“脱离仓库”的可执行入口。

结果是：即便仓库内部 `pnpm test:self-host` 和 `pnpm test:e2e` 通过，用户仍然可能拿不到一个真正可执行的外部 `actant` 命令。
