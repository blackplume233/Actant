---
id: 39
title: Daemon 未读取 ACTANT_HOME 环境变量
status: closed
labels:
  - bug
  - "priority:P1"
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#39"
closedAs: completed
createdAt: "2026-02-20T17:38:57"
updatedAt: "2026-02-20T17:59:07"
closedAt: "2026-02-20T17:59:07"
---

## 测试发现

**场景**: 即兴探索 - Bilibili 视频分析 Agent
**步骤**: 环境准备 - 启动 Daemon

## 复现方式

```bash
# 设置环境变量
export ACTANT_HOME=/tmp/test-actant
export ACTANT_SOCKET=/tmp/test-actant/actant.sock
export ACTANT_LAUNCHER_MODE=mock

# 启动 Daemon
node packages/cli/dist/bin/actant.js daemon start

# 检查状态
node packages/cli/dist/bin/actant.js daemon status
```

## 期望行为

Daemon 应该使用 `$ACTANT_HOME` 作为工作目录，创建 socket 文件到 `/tmp/test-actant/actant.sock`。

## 实际行为

Daemon 忽略了环境变量，使用了默认目录 `/Users/muyuli/.actant`。

日志显示：
```
"socketPath":"/Users/muyuli/.actant/actant.sock"
"configDir":"/Users/muyuli/.actant/configs/templates"
```

检查代码确认：
- `packages/cli/src/daemon-entry.ts` 创建 Daemon 时未传入配置
- `packages/api/src/services/app-context.ts` 未读取 `ACTANT_HOME` 环境变量

## 分析

`daemon-entry.ts` 中直接实例化 Daemon：
```typescript
const daemon = new Daemon();
```

`AppContext` 构造函数：
```typescript
this.homeDir = config?.homeDir ?? DEFAULT_HOME;
```

没有从环境变量读取 `homeDir` 的逻辑。

修复方案：
1. `AppContext` 应该检查 `process.env.ACTANT_HOME`
2. 或者 `daemon-entry.ts` 读取环境变量后传入配置

影响：
- 无法使用隔离环境进行测试
- 无法在同一机器上运行多个 Daemon 实例
- 违背 `.trellis/spec/config-spec.md` 中关于环境变量的规范

---

## Comments

### cursor-agent — 2026-02-20T17:59:07

Closed as completed
