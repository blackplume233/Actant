---
generated: true
---

<!-- GENERATED -->

# 核心概念

Actant 是一个面向 AI Agent 的底层平台：负责工作区物化、运行时管理、协议桥接和自治能力承载。它不是单一的"员工 Agent 产品"，而是承载多种上层交付形态的基础设施。

## 平台定位

Actant 的核心职责是把 Agent 从"一段 prompt"提升为可组装、可运行、可治理的系统单元。

- **底层平台**：统一模板解析、实例创建、进程生命周期、ACP/MCP 桥接、状态持久化
- **上层承载**：在平台之上可以构建 Agent App、SOP 自动化、CI 任务代理，以及面向外部引擎/工具链的集成
- **治理边界**：Actant 管理的是 Agent 的运行与组合，不直接等同于某个具体业务壳层

## Docker 类比（辅助理解）

Docker 类比仍然有助于理解 Actant 的分层，但它只是辅助说明，不是产品主叙事。

| Docker | Actant | 本质 |
|--------|--------|------|
| Dockerfile | **Agent Template** | 声明式蓝图 |
| Image | 解析后的模板 + 组件 | 可复用定义 |
| Container | **Agent Instance** | 隔离的运行单元 |
| docker run | `agent create + start` | 创建并启动 |
| Docker Daemon | **Actant Daemon** | 平台守护进程 |
| docker CLI | `actant` CLI | 用户入口 |
| Registry | **Component Source** | 组件分发仓库 |

## Agent Template

一个 JSON 文件，描述 Agent"是什么"——后端、技能、提示词、工具、权限、初始化方式与 archetype。模板定义底层运行蓝图，可被反复实例化。

## Agent Instance

从模板创建的运行实体。实例拥有独立工作区、持久化元数据和可选的运行进程。是否长期运行、是否接受平台调度，取决于 archetype 与 launch mode。

## 管理深度模型

Actant 用 `repo -> service -> employee` 表示平台对 Agent 的管理深度递进，而不是三个彼此割裂的产品类别：

```text
repo -> service -> employee
工作区管理   运行时管理   自治增强
```

| 层级 | 平台负责什么 | 典型使用方式 |
|------|-------------|-------------|
| **repo** | 物化模板、维护工作区、承载人工或外部工具操作 | 打开 IDE、进行代码协作、作为上层交付的基础工作区 |
| **service** | 在 repo 基础上增加进程生命周期、会话、keepAlive 与 API 交互 | 作为默认主交付形态，被 CLI / API / App / SOP / CI 被动调用 |
| **employee** | 在 service 基础上增加调度、心跳、事件驱动与自治执行 | 作为增强自治层，适合巡检、守护、持续运营任务 |

在模板中通过 `archetype` 字段声明：

```json
{
  "name": "my-reviewer",
  "archetype": "service",
  "backend": { "type": "claude-code" }
}
```

- **repo** 是最浅层的承载形态，强调工作区和人工主导协作
- **service** 是当前最稳定、最通用的主交付形态，应优先作为产品与集成默认目标
- **employee** 不是对 service 的替代，而是在其上叠加自治能力的增强层

## Domain Context

`Domain Context` 是模板层的知识与工具组合入口，用来声明 Agent 需要引用哪些 Skill、Prompt、MCP Server、Workflow、Plugin 等组件。

| 组件 | 职责 |
|------|------|
| **Skill** | 规则和知识 |
| **Prompt** | 系统提示词 |
| **MCP Server** | 外部工具集成 |
| **Workflow** | 工作流或 Hook Package 引用 |
| **Plugin** | Agent-side 扩展能力引用 |

需要注意：`domainContext` 属于**模板/配置层**，而运行中的进程管理、调度、上下文注入、系统插件等能力属于**平台 runtime 层**。二者相关，但不是同一层概念。

## Daemon

后台守护进程，负责 Agent 实例生命周期、进程监控、ACP 通信、运行时恢复和平台能力挂载。CLI、Dashboard 与 API 都通过它与平台交互。

## Component Source

组件的分发仓库（GitHub 或本地目录）。类似 Homebrew Tap，用于共享模板和领域组件，而不是替代运行时平台本身。

## 一图概览

```text
Template / Domain Context
          |
       create
          v
      Instance (repo)
          |
       start / session
          v
   Service Runtime Layer
          |
   schedule / hooks / autonomy
          v
    Employee Enhancement Layer
```
