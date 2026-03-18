---
id: 276
title: "qa: daemon start foreground reports success but CLI cannot connect in isolated ACTANT_SOCKET environment"
status: closed
labels: []
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#276"
closedAs: completed
createdAt: "2026-03-11T10:48:14Z"
updatedAt: "2026-03-18T06:39:14"
closedAt: "2026-03-18T06:36:47Z"
---

## 测试发现

**场景**: QA loop after #265 #266 #268 #273
**步骤**: isolated daemon startup / connectivity check

## 复现方式

```bash
ACTANT_HOME="C:/Users/black/AppData/Local/Temp/ac-qa-loop-cq68y9fm" \
ACTANT_SOCKET="C:/Users/black/AppData/Local/Temp/ac-qa-loop-cq68y9fm/actant.sock" \
ACTANT_LAUNCHER_MODE="mock" \
node packages/cli/dist/bin/actant.js daemon start --foreground

# In another shell / process, same env:
ACTANT_HOME="C:/Users/black/AppData/Local/Temp/ac-qa-loop-cq68y9fm" \
ACTANT_SOCKET="C:/Users/black/AppData/Local/Temp/ac-qa-loop-cq68y9fm/actant.sock" \
ACTANT_LAUNCHER_MODE="mock" \
node packages/cli/dist/bin/actant.js daemon status -f json
```

## 期望行为

`daemon start --foreground` 成功后，使用相同 `ACTANT_HOME/ACTANT_SOCKET` 的 CLI 命令应立即能够连接 daemon 并返回 running 状态。

## 实际行为

前台 daemon 输出：
```text
Daemon started (foreground). PID: 137972
Press Ctrl+C to stop.
```

但随后 CLI 仍然输出：
```text
Cannot connect to daemon.
Start with: actant daemon start
```

同时测试目录中仅看到：
- daemon.pid
- error-tpl.json
- instances/
- journal/
- logs/

未看到与 `ACTANT_SOCKET` 对应的可见 socket 文件。

## 分析

这看起来像 Windows / IPC 路径解析回归：
- daemon 报告启动成功
- CLI 无法用相同环境连接
- `ACTANT_SOCKET` 提供的是 `.sock` 风格路径
- 近期刚修改过 `ACTANT_SOCKET` / named pipe 规范化逻辑（#259）以及 transport 层（#265）

高概率是 CLI 与 daemon 对 `ACTANT_SOCKET` 的解释不一致，或 foreground 启动路径没有正确暴露可连接 IPC endpoint。
