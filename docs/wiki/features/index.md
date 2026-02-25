---
generated: true
---

<!-- GENERATED -->

# 功能总览

Actant v0.2.2 的全部能力一览。

## 已发布

| 功能 | 说明 | 起始版本 |
|------|------|---------|
| [Agent 模板](./agent-template) | JSON 定义可复用的 Agent 类型 | v0.1.0 |
| [Agent 生命周期](./lifecycle) | 创建、启动、运行、停止、销毁 | v0.1.0 |
| [领域上下文](./domain-context) | 5 类组件自由拼装 Agent 能力 | v0.1.0 |
| [多后端](./multi-backend) | Claude Code / Cursor / Pi / Custom | v0.2.2 |
| [权限控制](./permissions) | 4 级预设 + 自定义安全边界 | v0.1.0 |
| [雇员调度器](./scheduler) | 心跳 / Cron / Hook 自动任务 | v0.2.0 |
| [ACP 连接](./acp-proxy) | Direct Bridge + Session Lease | v0.2.1 |
| [组件源](./component-source) | GitHub / 本地仓库同步组件 | v0.1.2 |
| [可扩展架构](./extensibility) | Handler 注册模式添加组件类型 | v0.2.0 |
| [CLI](./cli) | 68 子命令 + REPL 模式 | v0.2.1 |

## 开发中

| 功能 | 阶段 |
|------|------|
| Hook / Plugin 体系 | Phase 4 |
| 记忆系统 | Phase 5 |
| ACP-Fleet 集群编排 | Phase 6 |

## 建议阅读顺序

**新手**：模板 → 生命周期 → CLI → 领域上下文

**进阶**：调度器 → ACP → 组件源 → 可扩展架构
