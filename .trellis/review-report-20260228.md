## 审查范围
- 范围：`packages/core`、`packages/acp`、`packages/api`、`packages/rest-api` 的核心运行时实现（仅源码，排除 `dist/node_modules`）
- 重点：设计边界、可扩展性、语义对齐（协议/事件/版本/鉴权）
- 审查方式：静态代码审查（本次未执行完整回归测试）

## 总体结论
当前代码主架构可运行，但在**生命周期语义一致性**与**可扩展运行稳定性**上存在系统性风险：
1. 一些核心路径将“状态语义”与“事件语义”混用，导致上层消费方可能误判。
2. 连接/启动失败路径的资源清理不完整，放大会话规模后有泄漏风险。
3. 对外接口的安全边界和版本声明存在不一致，影响集成方预期。

## 发现清单（合并报告）

### 1) [高] ACP 连接失败路径清理不完整，存在内存与状态泄漏风险
- 证据：
  - `packages/acp/src/connection-manager.ts:62-66` 连接前将 `enforcers` 写入 Map
  - `packages/acp/src/connection-manager.ts:90-93` 连接前将 `recordingHandlers` 写入 Map
  - `packages/acp/src/connection-manager.ts:161-166` catch 中仅清理 `connections/primarySessions/routers`，未清理 `enforcers/recordingHandlers`（`gateways` 也未显式兜底）
- 风险：连续失败重连会累积无主 handler/enforcer，导致内存增长、策略污染、诊断困难。
- 建议：在 `catch` 中统一清理所有按 `name` 建立的容器状态；新增 `connect-fail-cleanup` 单测覆盖 spawn/initialize/newSession 三类失败点。

### 2) [高] REST API 将 `/v1/sse` 设为鉴权豁免，存在事件面暴露风险
- 证据：
  - `packages/rest-api/src/server.ts:27-33` 明确对 `/v1/sse` 跳过 `checkAuth`
- 风险：在 API Key 模式下，SSE 仍可被未授权客户端订阅，造成实时事件泄露；与“开启 API Key 即统一受保护”的语义不一致。
- 建议：为 SSE 增加受控鉴权方案（例如短期 token、query token、cookie/session）并默认启用；至少提供显式配置开关而非硬编码豁免。

### 3) [中] 进程退出事件语义与状态更新不一致，影响上层订阅者判断
- 证据：
  - `packages/core/src/manager/agent-manager.ts:1030` 计算 `exitStatus`
  - `packages/core/src/manager/agent-manager.ts:1039-1041` 无条件发出 `process:crash`
- 风险：即使是“可预期停止/mark-stopped”路径，订阅端也收到 `crash` 语义，触发错误恢复、告警、会话清理等误动作。
- 建议：按 `action.type` 或 `exitStatus` 区分发出 `process:stop` / `process:crash`，并补充回归测试验证事件-状态一致性。

### 4) [中] 初始化重试缺少幂等防护，失败后重入可能重复注册事件监听
- 证据：
  - `packages/api/src/services/app-context.ts:214-216` 在 `initialized=true` 之前调用 `listenForInstanceHooks`
  - `packages/api/src/services/app-context.ts:391-423` `listenForInstanceHooks` 每次都会 `eventBus.on(...)`
- 风险：若 `init()` 中后续步骤失败，再次调用会重复绑定监听，导致回调重复执行（重复 close lease / 重复 unregister / 重复日志）。
- 建议：为监听注册加一次性门闩（flag）或在失败回滚时移除监听。

### 5) [中] 版本语义硬编码，跨模块对外标识不一致
- 证据：
  - `packages/api/src/daemon/daemon.ts:85` 事件中写死 `version: "0.1.0"`
  - `packages/rest-api/src/server.ts:117` OpenAPI 信息写死 `version: "1.0.0"`
- 风险：运行时事件、API 描述、包版本三套版本语义不一致，影响外部平台兼容判断与问题排查。
- 建议：统一从单一版本源（root/package 或构建注入）读取，并在 CI 增加版本一致性检查。

### 6) [中] REST API 启动过程重复注册进程信号监听，存在 listener 泄漏
- 证据：
  - `packages/rest-api/src/index.ts:51-57` 每次 `startApiServer` 都执行 `process.on(SIGINT/SIGTERM)`
- 风险：在同进程多次启动/关闭 API Server 的场景下会重复注册监听，造成重复回调与 `MaxListenersExceededWarning`。
- 建议：改为 `process.once` + 可移除 handler，或将信号托管至上层 daemon 生命周期。

## 设计层综合建议
1. 建立“状态机事件契约”：明确定义 `stop/crash/restart` 事件触发条件，并作为跨模块公共契约。
2. 建立“失败路径资源清理规范”：所有 manager 在失败分支必须执行对称清理（可通过统一 helper 模板化）。
3. 建立“对外语义一致性闸门”：鉴权策略、版本号、对外文档在 CI 做一致性校验。

## 建议验收标准
- [ ] 修复后新增或更新单元测试覆盖上述 6 项场景
- [ ] API key 开启时，SSE 未授权访问应失败（或必须携带受控 token）
- [ ] `process:*` 事件与 `meta.status` 语义一一对应
- [ ] 版本号来源统一并可追溯
