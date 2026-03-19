# 接口契约 (API Contracts)

> 本文档定义 ContextFS V1 的对外文件式操作面。旧 `ContextManager` / 旧 tool registry / 旧 manager API 不再是当前契约入口。

---

## 1. Contract Scope

ContextFS V1 对外只承诺统一文件式接口：

- `read`
- `write`
- `list`
- `stat`
- `watch`
- `stream`

说明：

- 这是 V1 的唯一主操作面
- V1 不单独承诺 `workflow` API
- V1 不把旧 tool registry 继续作为独立顶层系统

---

## 2. Standard Paths

V1 固定标准路径：

- `/_project.json`
- `/skills/*`
- `/mcp/configs/*`
- `/mcp/runtime/*`
- `/agents/*`
- `/projects/*`

这些路径属于当前契约的一部分，后续实现必须与此保持一致。

---

## 3. File Operations

### 3.1 `read(path)`

返回目标节点内容。

适用对象：

- `_project.json`
- skills
- mcp config
- runtime status
- agent status / schema / config

### 3.2 `write(path, content)`

向目标节点写入内容。

V1 允许的典型用法：

- 更新 skill
- 更新 mcp config
- 写入控制节点触发执行

### 3.3 `list(path)`

列举路径下的目录项。

### 3.4 `stat(path)`

返回节点元信息。

### 3.5 `watch(path)`

订阅目标节点变化。

V1 主要用于：

- runtime 状态变更
- agent 状态变更
- 动态资源变更通知

### 3.6 `stream(path)`

消费持续输出。

V1 主要用于：

- agent 输出流
- runtime 输出流

---

## 4. Execution Contract

V1 的执行能力通过控制节点和流节点表达，而不是通过旧 tool registry 或旧 manager API 表达。

最小路径约定：

- `/agents/<name>/control/request.json`
- `/agents/<name>/streams/<id>`
- `/mcp/runtime/<name>/streams/<id>`

规则：

- 向控制节点 `write` 触发执行
- 从流节点 `stream` 消费输出
- 执行与输出都仍然处在文件式资源契约内

---

## 5. Built-In Source Surface

### 5.1 SkillSource

- `read`
- `write`
- `list`
- 可选 `grep`

### 5.2 McpConfigSource

- `read`
- `write`
- `list`

### 5.3 McpRuntimeSource

- `read`
- `list`
- `watch`
- `stream`

### 5.4 AgentRuntime

- `read`
- `list`
- `watch`
- `stream`

---

## 6. Error Semantics

V1 最少需要以下错误类别：

- path not found
- permission denied
- capability not supported
- invalid project boundary
- invalid control request
- stream not found

具体错误码可以在实现阶段细化，但不得绕开上述语义类别。

---

## 7. Deprecated Contract Surface

以下旧接口面不再作为当前契约真相：

- 旧 `ContextManager` 驱动的上下文装配接口
- 旧 `DomainContext` 聚合式资源契约
- 旧 tool registry 作为平台中心
- 任何把 workflow 写入 V1 主契约的接口定义

若仓库中仍保留历史描述，只能标记为废弃/待移除，不能与本契约并列为双真相。
