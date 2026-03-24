# Actant Channel Protocol (ACP-EX)

> **版本**：0.1.0-draft  
> **日期**：2026-03-15  
> **关联 Issue**：#279

---

## 概述

Actant Channel Protocol（ACP-EX）是 Actant 自有的 Agent 通信协议。它在概念上借鉴 ACP（Agent Client Protocol）的良好设计，在 ACP 已覆盖的操作上保持语义一致，同时针对 Actant 作为 Agent 上下文平台（ContextFS）的需求进行扩展。ACP-EX 不是 ACP 的分支，而是 ACP 的应用层超集——站在 ACP 的设计基础上，增加 ACP 未涉及的能力维度。

> **变更流程 (MANDATORY)**
>
> 对通信层协议的任何修改——包括但不限于类型定义（`ChannelConnectOptions`、`ActantChannel`）、接口签名、行为语义、权限模型——MUST 遵循以下顺序：
>
> 1. **先更新本白皮书**中对应的文档（如 `initialization.md`、`tool-calls.md`）
> 2. **同步更新** `.trellis/spec/communication-layer.md`（权威 spec）
> 3. **然后修改** `packages/agent-runtime/src/channel/types.ts` 等代码
> 4. **最后更新**适配器实现（`@actant/channel-claude`、`@actant/acp` 等）
>
> 违反此顺序的 PR 应被 reject。

---

## 设计原则


| 原则                             | 描述                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **可选性（Optionality）**           | 协议中只有 `prompt()` 是 required；其余操作（streaming、cancel、resume、callbacks）均为 optional，通过能力协商决定是否激活。                            |
| **对称性（Symmetry）**              | Host 和 Backend 均可主动发起操作。Host 通过 `ActantChannel` 调用 Backend，Backend 通过 `ChannelHostServices` 回调 Host。                    |
| **后端能力释放（Backend Leverage）**   | 协议不截断后端的独特能力。Claude SDK 的 hooks/structured output、Pi 的 personality 等通过 `adapterOptions`/`backendOptions` 透传，协议层不解读也不限制。 |
| **ACP 兼容性（ACP Compatibility）** | 在 ACP 已覆盖的操作上保持相同的语义和命名，降低认知成本和适配器映射成本。扩展部分用 `x_` 前缀清晰区分。                                                               |


---

## ACP vs ACP-EX 对比


| 维度   | ACP                             | ACP-EX                                 |
| ---- | ------------------------------- | -------------------------------------- |
| 定位   | IDE 与 Agent 通信标准（"Agent 版 LSP"） | Agent Platform 与 Backend 通信协议          |
| 设计者  | Zed Industries + JetBrains      | Actant                                 |
| 角色模型 | Client（IDE）与 Agent              | Host（Actant）与 Backend                  |
| 对称性  | 非对称（Client 调用，Agent 回调）         | 对称（双方都可发起操作）                           |
| 可选性  | Callback 全量 required            | 所有操作按能力声明 optional                     |
| 后端支持 | 单一 ACP 实现                       | 多后端适配（Claude SDK、Pi、ACP bridge、Custom） |
| 扩展性  | 协议升级                            | `x_` 命名空间 + `adapterOptions` 透传        |


---

## 文档索引


| 文档                                             | 描述                          |
| ---------------------------------------------- | --------------------------- |
| [Architecture](./architecture.md)              | 角色、Profile、适配器架构            |
| [Initialization](./initialization.md)          | 连接建立与能力协商                   |
| [Session Setup](./session-setup.md)            | 创建与恢复 Session               |
| [Prompt Turn](./prompt-turn.md)                | 核心对话流程                      |
| [Content](./content.md)                        | 内容块类型                       |
| [Session Events](./session-events.md)          | 核心与扩展事件类型                   |
| [Session Config](./session-config.md)          | 运行时 Session 配置              |
| [Tool Calls](./tool-calls.md)                  | 工具调用上报与权限                   |
| [File System](./file-system.md)                | Host 文件 I/O 服务              |
| [Terminals](./terminals.md)                    | Host 终端服务                   |
| [MCP](./mcp.md)                                | MCP 服务器管理                   |
| [Host Tools](./host-tools.md)                  | Host 提供工具管理                 |
| [Tool Ownership](./tool-ownership.md)          | 工具所有权模型与策略                  |
| [Extended Services](./extended-services.md)    | VFS、Activity Recording、通用扩展 |
| [Channel Manager](./channel-manager.md)        | 多连接管理                       |
| [Extensibility](./extensibility.md)            | 扩展机制                        |
| [External Profile](./external-profile.md)      | ACP Proxy 模式                |
| [Adapters](./adapters.md)                      | 适配器实现指南                     |
| [StreamChunk Compatibility](./stream-chunk.md) | 旧版 StreamChunk 映射           |
| [Migration](./migration.md)                    | 分阶段实施计划                     |
| [Appendix](./appendix.md)                      | 术语、RFD 映射、能力矩阵              |


---

## 相关文档

- [Unified Communication Layer](../../../.trellis/spec/communication-layer.md)
