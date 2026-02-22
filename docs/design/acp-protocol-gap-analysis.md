# ACP 协议功能点完整性对比

> 基于 [Agent Client Protocol v1](https://agentclientprotocol.com) 官方规范
> 对比 Actant `@actant/acp` 包 (`packages/acp/`) 及 CLI Proxy 实现
> 生成日期: 2026-02-21

---

## 状态图例


| 符号  | 含义                    |
| --- | --------------------- |
| ✅   | 已实现                   |
| ⚠️  | 部分实现                  |
| ❌   | 未实现                   |
| ➖   | 不适用（协议草案 / Agent 端职责） |


---

## A. 传输层 (Transports)


| #   | 协议要求                                   | 状态  | Actant 实现                                               |
| --- | -------------------------------------- | --- | ----------------------------------------------------------- |
| A1  | stdio 传输 (JSON-RPC, newline-delimited) | ✅   | `connection.ts` → `ndJsonStream` over `child_process` stdio |
| A2  | Streamable HTTP 传输                     | ➖   | 协议草案中，尚未正式化                                                 |
| A3  | 自定义传输扩展点                               | ➖   | 非必需                                                         |


## B. 初始化 (Initialization — `initialize`)


| #   | 协议要求                                                  | 状态  | Actant 实现                |
| --- | ----------------------------------------------------- | --- | ---------------------------- |
| B1  | 调用 `initialize` 方法                                    | ✅   | `AcpConnection.initialize()` |
| B2  | 协议版本协商 `protocolVersion`                              | ✅   | 固定发 `protocolVersion: 1`     |
| B3  | 声明 `clientCapabilities.fs.readTextFile`               | ✅   | `{ readTextFile: true }`     |
| B4  | 声明 `clientCapabilities.fs.writeTextFile`              | ✅   | `{ writeTextFile: true }`    |
| B5  | 声明 `clientCapabilities.terminal`                      | ⚠️  | 声明 `terminal: true` 但无回调实现   |
| B6  | 提供 `clientInfo` (name, title, version)                | ✅   | `name: "actant"`         |
| B7  | 接收并存储 `agentCapabilities`                             | ⚠️  | 存储 `initResponse` 但不根据能力做分支  |
| B8  | 检测 `loadSession` 能力                                   | ❌   | 不检查                          |
| B9  | 检测 `promptCapabilities` (image/audio/embeddedContext) | ❌   | 不检查                          |
| B10 | 检测 `mcpCapabilities` (http/sse)                       | ❌   | 不检查                          |
| B11 | 接收 `authMethods`                                      | ❌   | 不处理                          |
| B12 | 接收 `agentInfo` (name, title, version)                 | ✅   | 日志记录                         |


## C. 认证 (Authentication — `authenticate`)


| #   | 协议要求                    | 状态  | Actant 实现 |
| --- | ----------------------- | --- | ------------- |
| C1  | 调用 `authenticate` 方法    | ❌   | 完全缺失          |
| C2  | 根据 `authMethods` 选择认证方式 | ❌   | —             |


## D. Session 管理 (Session Setup)


| #   | 协议要求                                | 状态  | Actant 实现                |
| --- | ----------------------------------- | --- | ---------------------------- |
| D1  | `session/new` 创建会话                  | ✅   | `AcpConnection.newSession()` |
| D2  | 传递 `cwd` 参数                         | ✅   |                              |
| D3  | 传递 `mcpServers` — stdio 传输          | ❌   | 始终传 `mcpServers: []`         |
| D4  | 传递 `mcpServers` — HTTP 传输           | ❌   |                              |
| D5  | 传递 `mcpServers` — SSE 传输            | ❌   |                              |
| D6  | 接收 `sessionId`                      | ✅   |                              |
| D7  | 接收 `modes` (Session Modes)          | ✅   | 存入 `AcpSessionInfo`          |
| D8  | 接收 `configOptions` (Config Options) | ❌   |                              |
| D9  | `session/load` 加载已有会话               | ❌   |                              |
| D10 | 接收 `session/load` 历史回放通知            | ❌   |                              |


## E. Prompt Turn (`session/prompt`)


| #   | 协议要求                               | 状态  | Actant 实现            |
| --- | ---------------------------------- | --- | ------------------------ |
| E1  | 发送 `session/prompt`                | ✅   | `AcpConnection.prompt()` |
| E2  | 发送 `ContentBlock::Text`            | ✅   | 仅此类型                     |
| E3  | 发送 `ContentBlock::Image`           | ❌   |                          |
| E4  | 发送 `ContentBlock::Audio`           | ❌   |                          |
| E5  | 发送 `ContentBlock::Resource` (嵌入资源) | ❌   |                          |
| E6  | 发送 `ContentBlock::ResourceLink`    | ❌   |                          |
| E7  | 多 ContentBlock 组合发送                | ❌   | `prompt()` 只构建单个 text    |
| E8  | 接收 `stopReason` 响应                 | ✅   |                          |
| E9  | 处理 `end_turn`                      | ✅   |                          |
| E10 | 处理 `max_tokens`                    | ❌   | 不区分                      |
| E11 | 处理 `max_turns`                     | ❌   |                          |
| E12 | 处理 `refusal`                       | ❌   |                          |
| E13 | 处理 `cancelled`                     | ❌   |                          |


## F. Session Update 通知 (`session/update`)


| #   | 协议要求                                         | 状态  | Actant 实现                 |
| --- | -------------------------------------------- | --- | ----------------------------- |
| F1  | `agent_message_chunk` — text                 | ✅   | `prompt()` + `streamPrompt()` |
| F2  | `agent_message_chunk` — 其他内容类型               | ❌   | 仅处理 text                      |
| F3  | `user_message_chunk` (session/load 回放)       | ❌   |                               |
| F4  | `thought_message_chunk`                      | ❌   |                               |
| F5  | `tool_call`                                  | ⚠️  | `streamPrompt()` yield 但不解析   |
| F6  | `tool_call_update`                           | ⚠️  | 同上                            |
| F7  | `plan` (Agent Plan)                          | ❌   |                               |
| F8  | `available_commands_update` (Slash Commands) | ❌   |                               |
| F9  | `current_mode_update` (Session Modes)        | ❌   |                               |
| F10 | `config_options_update` (Config Options)     | ❌   |                               |


## G. 取消 (`session/cancel`)


| #   | 协议要求                                           | 状态  | Actant 实现            |
| --- | ---------------------------------------------- | --- | ------------------------ |
| G1  | 发送 `session/cancel` 通知                         | ✅   | `AcpConnection.cancel()` |
| G2  | 取消时回复 pending `request_permission` 为 cancelled | ❌   |                          |
| G3  | 正确处理 `cancelled` stop reason                   | ❌   |                          |
| G4  | 取消后仍接收剩余 tool_call_update                      | ⚠️  | 未显式处理                    |


## H. 权限请求 (`session/request_permission`)


| #   | 协议要求                       | 状态  | Actant 实现 |
| --- | -------------------------- | --- | ------------- |
| H1  | `requestPermission` 回调     | ✅   | Client impl   |
| H2  | Auto-approve 模式            | ✅   | 选择第一个 option  |
| H3  | 交互式权限 UI                   | ❌   | 无用户交互界面       |
| H4  | Permission option kinds 处理 | ❌   | 不区分 kind      |
| H5  | 取消时返回 `cancelled` outcome  | ❌   |               |


## I. 文件系统回调 (Client → Agent)


| #   | 协议要求                      | 状态  | Actant 实现            |
| --- | ------------------------- | --- | ------------------------ |
| I1  | `fs/read_text_file` 读取文件  | ✅   | `readTextFile` callback  |
| I2  | `line` 参数 (起始行号, 1-based) | ❌   | 读取整文件                    |
| I3  | `limit` 参数 (最大行数)         | ❌   |                          |
| I4  | `fs/write_text_file` 写入文件 | ✅   | `writeTextFile` callback |
| I5  | 自动创建不存在的文件/目录             | ✅   | `mkdir` + `writeFile`    |


## J. Terminal 回调 (Client → Agent)


| #   | 协议要求                                   | 状态  | Actant 实现 |
| --- | -------------------------------------- | --- | ------------- |
| J1  | `terminal/create` 创建终端                 | ❌   | 声明能力但无回调      |
| J2  | `command`, `args`, `env`, `cwd` 参数     | ❌   |               |
| J3  | `outputByteLimit` 参数                   | ❌   |               |
| J4  | 返回 `terminalId`                        | ❌   |               |
| J5  | `terminal/output` 获取输出                 | ❌   |               |
| J6  | `output`, `truncated`, `exitStatus` 响应 | ❌   |               |
| J7  | `terminal/wait_for_exit` 等待完成          | ❌   |               |
| J8  | `terminal/kill` 终止命令                   | ❌   |               |
| J9  | `terminal/release` 释放终端                | ❌   |               |
| J10 | 终端嵌入 tool_call content                 | ❌   |               |


## K. Session Modes


| #   | 协议要求                        | 状态  | Actant 实现          |
| --- | --------------------------- | --- | ---------------------- |
| K1  | 接收 modes 初始状态               | ✅   | `AcpSessionInfo.modes` |
| K2  | `session/set_mode` 方法       | ❌   |                        |
| K3  | 处理 `current_mode_update` 通知 | ❌   |                        |


## L. Session Config Options


| #   | 协议要求                           | 状态  | Actant 实现 |
| --- | ------------------------------ | --- | ------------- |
| L1  | 接收 `configOptions` 初始状态        | ❌   |               |
| L2  | `session/set_config_option` 方法 | ❌   |               |
| L3  | 处理 `config_options_update` 通知  | ❌   |               |


## M. Slash Commands


| #   | 协议要求                              | 状态  | Actant 实现 |
| --- | --------------------------------- | --- | ------------- |
| M1  | 处理 `available_commands_update` 通知 | ❌   |               |
| M2  | 在 prompt 中包含命令文本                  | ❌   |               |


## N. Agent Plan


| #   | 协议要求                                     | 状态  | Actant 实现 |
| --- | ---------------------------------------- | --- | ------------- |
| N1  | 处理 `plan` 通知                             | ❌   |               |
| N2  | Plan entries (content, priority, status) | ❌   |               |
| N3  | 动态 Plan 更新 (全量替换)                        | ❌   |               |


## O. Tool Call 展示


| #   | 协议要求                                                           | 状态  | Actant 实现          |
| --- | -------------------------------------------------------------- | --- | ---------------------- |
| O1  | 接收 `tool_call`                                                 | ⚠️  | streamPrompt yield 不解析 |
| O2  | 接收 `tool_call_update`                                          | ⚠️  | 同上                     |
| O3  | status (pending/in_progress/completed/errored)                 | ❌   |                        |
| O4  | content: 常规 Content                                            | ❌   |                        |
| O5  | content: Diff (`type: "diff"`)                                 | ❌   |                        |
| O6  | content: Terminal (`type: "terminal"`)                         | ❌   |                        |
| O7  | kinds (read/edit/delete/move/search/execute/think/fetch/other) | ❌   |                        |
| O8  | `locations` (文件位置追踪)                                           | ❌   |                        |
| O9  | `rawInput` / `rawOutput`                                       | ❌   |                        |


## P. Content Types


| #   | 协议要求                                    | 状态  | Actant 实现 |
| --- | --------------------------------------- | --- | ------------- |
| P1  | Text (`type: "text"`)                   | ✅   |               |
| P2  | Image (`type: "image"`, base64)         | ❌   |               |
| P3  | Audio (`type: "audio"`, base64)         | ❌   |               |
| P4  | Embedded Resource (`type: "resource"`)  | ❌   |               |
| P5  | Resource Link (`type: "resource_link"`) | ❌   |               |
| P6  | Content annotations                     | ❌   |               |


## Q. 扩展性 (Extensibility)


| #   | 协议要求                                       | 状态  | Actant 实现 |
| --- | ------------------------------------------ | --- | ------------- |
| Q1  | `_meta` 字段支持                               | ❌   |               |
| Q2  | 自定义方法 (`_` 前缀)                             | ❌   |               |
| Q3  | 自定义能力广告                                    | ❌   |               |
| Q4  | W3C trace context (traceparent/tracestate) | ❌   |               |


## R. 错误处理


| #   | 协议要求                      | 状态  | Actant 实现      |
| --- | ------------------------- | --- | ------------------ |
| R1  | JSON-RPC 2.0 错误响应         | ✅   | `writeAcpError()`  |
| R2  | Method not found (-32601) | ✅   | proxy default case |
| R3  | 对未识别 notification 静默忽略    | ⚠️  | 未显式验证              |


---

## 统计


| 状态      | 数量     | 占比  |
| ------- | ------ | --- |
| ✅ 已实现   | 24     | 29% |
| ⚠️ 部分实现 | 8      | 10% |
| ❌ 未实现   | 48     | 58% |
| ➖ 不适用   | 3      | 4%  |
| **合计**  | **83** |     |


---

## 已知 Bug

1. `**session.cancel` Session ID 错位** — `handleSessionCancel` 将 Lease `sessionId` 传给 `conn.cancel()`，但 ACP 需要 primary ACP session ID
2. **Terminal 能力虚假声明** — 声明 `terminal: true` 但未实现任何回调
3. **Session Lease Proxy 提前发送 initialize** — 未等待连接就发送

---

## 优先级排序

### P0 — 必须修复（协议违规）

- B5/J1-J9: Terminal 能力声明与实现不匹配
- G2-G3: Cancel 完整性
- Bug #1-3

### P1 — 核心功能（完备 ACP Server 必需）

- D3: MCP Servers 传递
- E3-E7: 多内容类型
- F5-F10: 完整通知处理
- K2-K3: Session Modes
- L1-L3: Config Options
- H3: 交互式权限

### P2 — 增强功能

- D9-D10: Session Load
- M1-M2: Slash Commands
- I2-I3: 文件读取 line/limit
- Q1-Q4: 扩展性

