---
id: 198
title: "[Test] Add unit tests for HookRegistry"
status: closed
labels: []
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#198"
closedAs: completed
createdAt: "2026-02-26T03:44:03Z"
updatedAt: "2026-03-18T06:38:39"
closedAt: "2026-03-18T06:35:46Z"
---

## 问题描述

`packages/core/src/hooks/hook-registry.ts` 缺少单元测试。该类是 Hook 系统的核心组件，负责工作流注册、事件绑定和生命周期管理，需要完整的测试覆盖。

## 需要测试的场景

### 1. registerWorkflow 基础功能
- [ ] Actant-level workflow 全局注册
- [ ] Instance-level workflow 绑定到特定 agent
- [ ] Instance-level 缺少 agentName 时的警告和跳过
- [ ] 已禁用工作流 (enabled: false) 的跳过
- [ ] 无 hooks 的工作流跳过

### 2. 实例级别过滤
- [ ] Instance-level hook 只响应匹配的 agentName
- [ ] 不同 agent 的事件不会触发其他 agent 的 hook

### 3. allowedCallers 权限检查
- [ ] 只允许特定 caller type 触发 hook
- [ ] 非授权 caller 的事件被忽略
- [ ] 空 allowedCallers 允许所有调用者

### 4. 动作执行
- [ ] Action 顺序执行
- [ ] 单个 action 失败不中断后续 actions
- [ ] Action 失败记录日志

### 5. 注销功能
- [ ] unregisterWorkflow 正确清理 eventBus 监听器
- [ ] unregisterAgent 清理该 agent 的所有 hooks
- [ ] dispose 完整释放所有资源

### 6. 查询功能
- [ ] listHooks 返回正确信息
- [ ] hookCount 统计正确

## 依赖

需要 Mock:
- HookEventBus
- ActionContext

## 关联

- 父 Issue: #197
- 相关代码: `packages/core/src/hooks/hook-registry.ts`
