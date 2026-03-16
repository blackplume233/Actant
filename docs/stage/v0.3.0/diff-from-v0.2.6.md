# Diff Summary: v0.2.6 → v0.3.0

> Generated 2026-03-16

## Overview

| Metric | Value |
|--------|-------|
| Total commits | 44 (42 non-merge + 2 merges) |
| Files changed (all) | 685 |
| Insertions (all) | +30,772 |
| Deletions (all) | -28,604 |
| Source files changed (`packages/*/src/`) | 163 |
| Source insertions | +13,964 |
| Source deletions | -943 |
| Test files | 79 → 104 (+25) |
| Tests | ~1,000 → 1,259 (+259) |

## New Packages

| Package | Description |
|---------|-------------|
| `@actant/tui` | 统一 TUI 层：终端 chat 视图、Markdown 渲染、xterm-headless |
| `@actant/channel-claude` | Claude Agent SDK adapter：实现 ActantChannel 接口 |

## Major Changes by Area

### Core (`@actant/core`)

- **ActantChannel 抽象层** — 定义统一 channel 接口（prompt/stream/cancel/notification/readiness）
- **RecordSystem** — 合并 EventJournal + ActivityRecorder 为单一记录子系统
- **ChannelPermissions** — 协议级权限声明与验证
- **RecordingChannelDecorator / RecordingChannelManager** — channel 级自动记录装饰器
- **RoutingChannelManager** — 多 channel 路由管理
- **EventCompat** — 旧事件系统兼容层
- **VFS** — 注册式虚拟文件系统（registry + permission + lifecycle）
- **Capability-driven backend validation** — 后端能力声明式验证模型

### CLI (`@actant/cli`)

- VFS 命令组（`vfs ls/read/write/rm/mount`）
- Windows IPC 路径规范化
- 启动诊断增强
- `agent chat` 迁移至 TUI 层

### ACP (`@actant/acp`)

- `AcpChannelAdapter` — 将 ACP 连接包装为 ActantChannel
- VFS interceptor — ACP 协议中的 VFS 操作拦截
- 连接失败状态清理

### API (`@actant/api`)

- 结构化 session / ACP runtime 错误
- Event handlers 和 VFS handlers
- Schedule handlers
- Webhook event ingress 路由

### Shared (`@actant/shared`)

- JSON-RPC socket transport 核心抽象集中化

### Security

- 8 项安全修复：路径遍历、shell 注入、资源泄露、错误处理
- Review #256 发现的资源泄露、幂等性、跨平台加固
