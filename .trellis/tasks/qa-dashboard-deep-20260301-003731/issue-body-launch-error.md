## 测试发现

**场景**: qa-dashboard-deep-20260301-003731
**步骤**: Step 9 - 启动 Agent（qa-dash-a）

## 复现方式

```bash
ACTANT_HOME="G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tmp\ac-qa-dashboard-deep-20260301-003731" \
  node packages/cli/dist/bin/actant.js daemon start

ACTANT_HOME="G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tmp\ac-qa-dashboard-deep-20260301-003731" \
  node packages/cli/dist/bin/actant.js agent create qa-dash-a -t actant-hub@actant-spark -f json

ACTANT_HOME="G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tmp\ac-qa-dashboard-deep-20260301-003731" \
  node packages/cli/dist/bin/actant.js agent start qa-dash-a
```

## 期望行为

启动失败时，错误输出应包含可读的根因（例如缺失后端依赖、命令路径、spawn 错误码）。

## 实际行为

CLI 仅输出：

```text
[RPC -32008] Failed to launch agent "qa-dash-a"
  Context: {"instanceName":"qa-dash-a","cause":"[object Object]"}
```

`cause` 被序列化成 `[object Object]`，丢失诊断信息。

## 分析

异常上下文对象在错误展示链路中被字符串化（`String(object)`）而非结构化展开，导致根因不可见，降低可观测性与排障效率。
