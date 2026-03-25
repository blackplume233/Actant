# Actant 愿景

> 定位：面向 agent 的上下文文件系统 / 上下文操作系统

---

## 核心愿景

Actant 的长期目标不再表述为“资源分类平台优先”，而是：

> **把上下文本身做成统一、可操作、可授权、可持续的文件系统。**

平台真正需要统一的是：

- 路径视图
- 挂载模型
- 节点模型
- 权限与生命周期
- 不同 agent 之间共享同一套访问语义

---

## 核心判断

### 1. Agent 是 consumer 与 producer，不是唯一顶层对象

Agent 很重要，但它仍然属于 ContextFS 中的一类运行时参与者：

- 它消费上下文
- 它暴露上下文
- 它通过 `control node` 触发动作
- 它通过 `stream node` 暴露输出

### 2. 一切上下文都应以文件系统对象暴露

Actant 采用 Unix 风格接口哲学：

- 不是要求底层都存成真实文件
- 而是要求对外统一表现为可读、可写、可列举、可监听、可流式消费的对象

### 3. 平台核心是 ContextFS + VFS

Actant 的产品层核心是 `ContextFS`，实现核心是 `VFS`。

当前有效主对象是：

- `mount namespace`
- `mount table`
- `filesystem type`
- `mount instance`
- `node type`

---

## V1 收敛方向

V1 只做最小闭环，不追求大而全：

- `hostfs`、`runtimefs`
- `directory`、`regular`、`control`、`stream`
- `read`、`write`、`list`、`stat`、`watch`、`stream`
- 无常驻进程普通读取
- 运行时伪文件系统统一走 VFS

---

## V1 非目标

V1 明确不做：

- `workflow`
- query/view mount
- overlay/fallback 行为实现
- 旧资源分类中心模型
- 旧 `Prompt` 一级对象

---

## 成功标准

当 V1 文档和实现完成时，应满足：

- 仓库中只有 `ContextFS` / `VFS` 这一套有效叙述
- `mount namespace`、`filesystem type`、`node type` 成为单一对象模型
- agent、runtime、普通文件树都能用同一套文件系统接口表达
- 后续实现者无需再决定平台核心到底是资源分类还是路径/挂载/节点系统
