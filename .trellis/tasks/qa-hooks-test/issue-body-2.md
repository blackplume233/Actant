## 测试发现

**场景**: QA Hook 系统全面测试 - explore 模式
**步骤**: Step 5 - HookRegistry 集成缺口

## 问题描述

Daemon 启动时创建了 `HookEventBus` 和 `HookCategoryRegistry`，并将 EventBus 传给 AgentManager 用于事件发射。但 `HookRegistry`（负责将 workflow hooks 绑定为 EventBus listener）从未在 `AppContext` 或 `Daemon` 中被实例化和连接。

## 影响

1. AgentManager 在 create/start/stop/destroy/crash 时正确 emit 事件到 EventBus
2. 但 EventBus 上没有任何 workflow hook listener
3. 用户定义的 workflow hooks 虽然可以加载和查看，但永远不会被执行
4. 整个 hook 触发链路断裂

## 期望行为

Daemon 启动时应该：
1. 实例化 `HookRegistry(eventBus, actionContext)`
2. 遍历 `workflowManager.list()` 并调用 `hookRegistry.registerWorkflow()` 注册每个 workflow 的 hooks
3. 在 Agent 创建时，对 instance-level workflow 调用 `hookRegistry.registerWorkflow(wf, agentName)`

## 分析

PR #179 实现了 hook 系统的底层基础设施（EventBus、CategoryRegistry、ActionRunner、HookRegistry），但上层集成（在 Daemon 启动流程中连接这些组件）尚未完成。这是 Phase 4 事件系统的关键集成步骤。
