# Migration

**副标题**：分阶段实施计划

---

## Overview

ACP-EX 分 4 个阶段增量实现。每阶段在保持向后兼容的前提下增加能力。

---

## Phase 1: Interface Migration (Current, #279)

**Status**：In progress

**Completed**：

- 在 `@actant/core` 中定义 `ActantChannelManager` / `ActantChannel` 基础接口
- 将 `AgentManager` 迁移为使用 `channelManager` 字段
- 在 `@actant/acp` 中创建 `AcpChannelManagerAdapter` 兼容层
- 更新 `AppContext` 以接入 adapter

**In Progress**：

- `ClaudeChannelAdapter` 实现（SDK 直连）

**Interface Scope**：

- `ChannelConnectOptions` 保留 ACP 兼容字段（command、args、resolvePackage）
- `StreamChunk` 不变
- 尚无 `ChannelHostServices`、`ChannelCapabilities`、`ChannelEvent`

---

## Phase 2: Protocol Upgrade

**Planned Changes**：

- 重构 `ChannelConnectOptions`：将 ACP 字段提取到 adapterOptions
- 在 connect() 中引入 `ChannelHostServices` 注入
- 在 connect() 返回值中引入 `ChannelCapabilities`
- 为 StreamChunk 添加可选 `event` 字段
- 实现 `executeTool` 以替代 ACTANT_TOOLS 环境变量 hack
- 更新 AgentManager 使用 capabilities 进行 feature 检测

---

## Phase 3: Event System

**Planned Changes**：

- 完整 `ChannelEvent` 类型系统实现
- AgentManager 从 StreamChunk 迁移为消费 ChannelEvent
- Activity recording 迁移至 `ChannelHostServices.activityRecord`
- VFS 服务实现

---

## Phase 4: External Profile

**Planned Changes**：

- `AcpProxyAdapter` 使用 Channel Protocol 替代直接 ACP SDK 调用
- REST Session API 直接映射到 Channel Protocol
- Gateway Bridge 标准化
- 端到端 ACP proxy 测试

---

## Backward Compatibility Strategy

- 保留已废弃接口（`AcpConnectionManagerLike`、`AcpConnectionLike`）
- 过渡期使用 union 类型（`ActantChannelManager | AcpConnectionManagerLike`）
- `resolveChannel()` helper 抽象 old/new manager 访问
- 逐步 adapter 迁移，不破坏现有代码
