---
id: 199
title: "[Test] Add unit tests for ActionRunner"
status: closed
labels: []
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#199"
closedAs: completed
createdAt: "2026-02-26T03:44:06Z"
updatedAt: "2026-03-18T06:38:40"
closedAt: "2026-03-18T06:35:49Z"
---

## 问题描述

`packages/core/src/hooks/action-runner.ts` 缺少单元测试。该模块负责执行 Hook 动作（shell、built-in、agent），需要测试确保执行逻辑正确。

## 需要测试的场景

### 1. runActions 顺序执行
- [ ] 多个 actions 按顺序执行
- [ ] 每个 action 的结果被收集
- [ ] 失败 action 不中断后续执行

### 2. Shell Action
- [ ] 基本命令执行
- [ ] 模板插值（${agent.name}, ${event}, ${timestamp}）
- [ ] 自定义 vars 插值
- [ ] 命令执行失败返回错误
- [ ] 空 run 字段处理

### 3. Builtin Action
- [ ] actant.log 执行
- [ ] actant.healthcheck 执行
- [ ] actant.notify 执行
- [ ] 未知 builtin action 返回错误
- [ ] 空 action 字段处理

### 4. Agent Action
- [ ] promptAgent 调用成功
- [ ] 模板插值应用到 prompt
- [ ] promptAgent 调用失败处理
- [ ] 无 promptAgent 函数时的错误
- [ ] 空 target/prompt 字段处理

### 5. 模板插值
- [ ] payload.agentName 替换
- [ ] payload.event 替换
- [ ] payload.timestamp 替换
- [ ] ctx.vars 自定义变量替换
- [ ] 特殊字符处理（安全考虑）

## 依赖

需要 Mock:
- child_process.exec
- promptAgent 函数

## 关联

- 父 Issue: #197
- 相关代码: `packages/core/src/hooks/action-runner.ts`
