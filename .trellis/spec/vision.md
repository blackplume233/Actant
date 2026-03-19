# Actant 愿景

> 定位：面向 Agent 的上下文文件系统 / 上下文操作系统

---

## 核心愿景

Actant 的长期目标不再表述为“Agent 平台优先”，而是：

> **把上下文本身做成统一、可操作、可授权、可持续的系统。**

Agent 依然重要，但不再是平台唯一中心。  
平台真正需要统一的是：

- 上下文表示
- 上下文寻址
- 上下文操作
- 权限与生命周期
- 不同 Agent 之间共享同一套资源模型

---

## 核心判断

### 1. Agent 是资源，不是唯一顶层对象

Agent 是系统中最复杂、最有价值的一类资源：

- 它消费上下文
- 它暴露上下文
- 它有执行能力
- 它有流式输出
- 它有生命周期

但它仍然属于统一资源模型的一部分，而不是凌驾于其上的第二套中心系统。

### 2. 一切上下文都应以文件式资源接口暴露

Actant 采用 Unix 风格接口哲学：

- 不是要求底层都存成真实文件
- 而是要求对外统一表现为可读、可写、可列举、可监听、可流式消费的资源

这意味着：

- 项目上下文是资源
- MCP 配置和运行时状态是资源
- Agent 状态和能力描述是资源
- Tool 是带执行/流能力的资源

### 3. 平台核心是 ContextFS

Actant 的产品层核心是 `ContextFS`：

- `Project`
- `Source`
- `Capability`
- 文件式资源路径

其实现内核是 `VFS Kernel`，负责把这些语义真正落到统一访问层。

---

## V1 收敛方向

V1 只做最小闭环，不追求大而全：

- 4 个内置 Source
  - `SkillSource`
  - `McpConfigSource`
  - `McpRuntimeSource`
  - `AgentRuntime`
- 统一操作面
  - `read`
  - `write`
  - `list`
  - `stat`
  - `watch`
  - `stream`
- `Project` 作为编排单元与权限边界
- 用控制节点与流节点表达执行能力

---

## V1 非目标

V1 明确不做：

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 旧 `ContextManager` 中心模型
- 旧 `DomainContext` 聚合模型
- 旧 tool registry 顶层系统

---

## 成功标准

当 V1 文档和实现完成时，应满足：

- 仓库中只有 `ContextFS` / `VFS Kernel` 这一套有效叙述
- `Project`、`Source`、`Capability` 已成为单一对象模型
- Agent、Tool、MCP runtime 都能用同一套文件式资源接口表达
- 后续实现者无需再决定平台核心到底是 Agent 还是上下文
