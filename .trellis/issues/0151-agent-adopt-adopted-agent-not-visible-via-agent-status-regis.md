---
id: 151
title: "agent adopt: adopted agent not visible via agent status (registry/manager cache desync)"
status: open
labels:
  - bug
  - qa
milestone: null
author: unknown
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#151"
closedAs: null
createdAt: "2026-02-24T12:47:22Z"
updatedAt: "2026-02-24T15:18:40"
closedAt: null
---

## 测试发现

**场景**: ultimate-real-user-journey
**步骤**: p7-adopt → p7-adopt-status

## 复现方式

```bash
# 1. 创建模拟工作区
mkdir /tmp/mock-workspace
echo '{"id":"mock","name":"mock","templateName":"tpl","templateVersion":"1.0.0","backendType":"cursor","status":"stopped","launchMode":"direct","workspacePolicy":"persistent","processOwnership":"managed","createdAt":"2026-01-01","updatedAt":"2026-01-01"}' > /tmp/mock-workspace/.actant.json

# 2. Adopt
actant agent adopt /tmp/mock-workspace --rename adopted-agent
# => 成功，返回 agent info

# 3. Status
actant agent status adopted-agent
# => [RPC -32003] Agent instance "adopted-agent" not found
```

## 期望行为

`agent adopt` 成功后，`agent status <name>` 应能查到该 Agent。

## 实际行为

adopt 返回成功，但 status 报 Agent not found。

## 分析

`handleAgentAdopt` 使用 `ctx.instanceRegistry.adopt()` 注册 Agent，但 `agent status` 通过 `ctx.agentManager.getAgent()` 查询。两者使用不同的数据存储：
- `instanceRegistry`: 文件系统级别的实例注册表
- `agentManager.cache`: 内存中的 Agent 元数据缓存

adopt 写入 instanceRegistry 但未同步到 agentManager cache，导致 agent status 找不到。

**修复建议**: adopt 成功后应调用 `agentManager.refreshCache(name)` 或在 adopt 处理中同时更新 agentManager cache。
