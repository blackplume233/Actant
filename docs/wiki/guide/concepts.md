---
generated: true
---

<!-- GENERATED -->

# 核心概念

Actant 借鉴 Docker 的分层思维来管理 AI Agent。

## Docker 对照表

| Docker | Actant | 本质 |
|--------|--------|------|
| Dockerfile | **Agent Template** | 声明式蓝图 |
| Image | 解析后的模板 + 组件 | 不可变定义 |
| Container | **Agent Instance** | 隔离的运行单元 |
| docker run | `agent create + start` | 创建并启动 |
| Docker Daemon | **Actant Daemon** | 后台守护进程 |
| docker CLI | `actant` CLI | 用户入口 |
| Registry | **Component Source** | 组件仓库 |

## Agent Template

一个 JSON 文件，描述 Agent"是什么"——后端、技能、提示词、工具、权限。写一次，创建 N 个实例。

## Agent Instance

从模板创建的运行实体。拥有独立的工作区目录和进程。像容器一样创建、启动、停止、销毁。

## Domain Context

Agent 能力的组合容器。由 5 类组件拼装：

| 组件 | 职责 |
|------|------|
| **Skill** | 规则和知识 |
| **Prompt** | 系统提示词 |
| **MCP Server** | 外部工具集成 |
| **Workflow** | 工作流程 |
| **Plugin** | 扩展能力 |

## Daemon

后台守护进程，管理所有 Agent 实例的生命周期、进程监控、ACP 通信。CLI 通过 JSON-RPC 与 Daemon 交互。

## Component Source

组件的分发仓库（GitHub 或本地目录）。类似 Homebrew Tap，让团队共享 Agent 配方。

## 一图概览

```
Template ─(create)─▶ Instance ─(start)─▶ Process ─(session)─▶ 交互
   │                    │                    │
   │ 定义能力            │ 独立工作区          │ OS 进程
   │ Skills/Prompts/MCP  │ .actant.json       │ ACP 通信
```
