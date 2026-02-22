---
id: 57
title: Windows 平台 daemon start（非 foreground）fork 后立即退出
status: open
labels:
  - bug
  - "platform:windows"
  - daemon
milestone: phase-3
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/cli/src/commands/daemon/start.ts
  - packages/cli/src/daemon-entry.ts
  - packages/shared/src/platform/platform.ts
taskRef: null
githubRef: "blackplume233/Actant#57"
closedAs: null
createdAt: "2026-02-22T02:35:00Z"
updatedAt: "2026-02-22T02:35:00Z"
closedAt: null
---

**Related Files**: `packages/cli/src/commands/daemon/start.ts`, `packages/cli/src/daemon-entry.ts`, `packages/shared/src/platform/platform.ts`

---

## 现象

在 Windows 10/11 上执行 `actant daemon start`（默认后台模式），CLI 报告 `Daemon started. PID: <pid>`，但 daemon 子进程在几秒内静默退出。随后 `actant daemon status` 返回 `{ "running": false }`。

使用 `actant daemon start --foreground` 则正常运行，功能不受影响。

## 复现步骤

1. 设置隔离环境：
   ```powershell
   $env:ACTANT_HOME = "C:\temp\actant-test"
   $env:ACTANT_SOCKET = "\\.\pipe\actant-test"
   ```
2. 启动 daemon（后台模式）：
   ```powershell
   actant daemon start
   # 输出: Daemon started. PID: xxxxx
   ```
3. 检查状态：
   ```powershell
   Start-Sleep -Seconds 2
   actant daemon status -f json
   # 输出: { "running": false }
   ```

## 预期行为

`daemon start` 在后台模式下应能持久运行，与 `--foreground` 行为一致（除了不占用终端）。

## 根因分析

`packages/cli/src/commands/daemon/start.ts` 中后台模式使用 `child_process.fork()` + `detached: true` + `stdio: "ignore"`：

```typescript
const daemonScript = join(import.meta.dirname, "..", "daemon-entry.js");
const child = fork(daemonScript, [], {
  detached: true,
  stdio: "ignore",
  env: process.env,
});
child.unref();
```

可能原因：
1. **`daemon-entry.js` 路径解析错误**：`import.meta.dirname` 在 bundled (tsup) 环境下可能不指向预期目录，导致 fork 的脚本路径不正确
2. **ESM 顶层 await 兼容问题**：`daemon-entry.ts` 使用了顶层 `await daemon.start()`，fork 子进程以 CJS 方式执行时可能立即退出
3. **Windows 上 detached fork 的 IPC socket 创建失败**：Named pipe 创建可能因权限或路径问题失败，但 `stdio: "ignore"` 吞掉了错误输出

## 建议修复方向

1. fork 时暂时使用 `stdio: ["ignore", "pipe", "pipe"]`，捕获子进程 stderr 用于诊断
2. 验证 `daemonScript` 路径在 Windows tsup bundle 下的正确性
3. 考虑 Windows 平台降级为 `spawn` + `node --experimental-detect-module` 替代 `fork`
4. 添加健康检查：fork 后等待 2-3 秒，ping daemon socket 确认启动成功，失败时打印子进程 stderr

## 影响范围

- 仅影响 Windows 平台
- `--foreground` 模式不受影响
- 生产环境如使用 PM2/systemd 等进程管理器也不受影响

## 发现于

QA 场景 `bilibili-video-analysis`（2026-02-22），详见 `.trellis/tasks/02-22-rename-qa/qa-log-bilibili.md`
