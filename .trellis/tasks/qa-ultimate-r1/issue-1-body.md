## 测试发现

**场景**: ultimate-real-user-journey
**步骤**: p9-comm-start, p10-sched-start, p11-session-start

## 复现方式

```bash
# 环境: Windows 10, Node.js installed at C:\Program Files\nodejs\
set ACTANT_HOME=%TEMP%\ac-qa-test
actant daemon start --foreground
actant agent create comm-agent -t qa-pi-tpl
actant agent start comm-agent
```

## 期望行为

Pi 后端 ACP bridge 进程正常启动，Agent 进入 running 状态。

## 实际行为

```
[RPC -32008] Failed to launch agent "comm-agent"
Context: {"cause":"ACP agent process exited unexpectedly (code=1, signal=null).
Command: C:\Program Files\nodejs\node.exe ...packages\pi\dist\acp-bridge.js
stderr: 'C:\Program' is not recognized as an internal or external command"}
```

## 分析

ProcessLauncher 在构造 ACP bridge 启动命令时，未正确引用包含空格的 Node.js 可执行文件路径。`C:\Program Files\nodejs\node.exe` 被 shell 解析为 `C:\Program`（第一个空格前的部分），导致命令找不到。

**根因**: ProcessLauncher 或 AcpLauncher 在 Windows 上使用 child_process.spawn/exec 时，未对可执行文件路径加双引号或使用 shell: false + 完整路径数组形式。

**影响**: 所有 Pi 后端 Agent 在 Node.js 安装在含空格路径（如默认 C:\Program Files\）的 Windows 系统上无法启动。
