# QA 循环验证流程

## 概述

循环验证是 QA 工程师在发现缺陷后持续修复-回归的标准化流程。核心原则：**修复后必须重新执行完整随机漫步测试，直到 100% 通过为止**。

## 流程图

```
测试 → 报告 → Issue → 修复 → 回归测试 ─→ 全部PASS → 内化场景
                                  │
                                  └─ 仍有FAIL → 修复 → 回归测试（循环）
```

## 标准流程

### Phase 1: 随机漫步测试

1. **环境准备**
   - `pnpm build` 构建项目
   - 创建隔离临时目录（`mktemp -d`）
   - 设置环境变量：`ACTANT_HOME`, `ACTANT_SOCKET`, `ACTANT_LAUNCHER_MODE=mock`
   - 在 Windows 上，`ACTANT_SOCKET` 需设为命名管道路径（`getIpcPath(homeDir)` 的返回值）
   - 启动 Daemon（`daemon start --foreground`）

2. **执行测试场景组**
   - 场景组 1: Agent 生命周期基线
   - 场景组 2: Session Lease 完整生命周期
   - 场景组 3: Direct Bridge 模式
   - 场景组 4: Session Lease Proxy 模式
   - 场景组 5: 边界条件和错误处理
   - 场景组 6: 单元测试套件（`pnpm test`）
   - 场景组 7: 文档一致性白盒验证

3. **随机漫步策略**
   - 在场景组内随机交叉执行步骤
   - 随机插入干扰操作
   - 随机重复操作验证幂等性
   - 随机化参数

4. **增量写入日志（边执行边记录）**
   - 每步执行完毕后立即将以下内容追加到 `.trellis/tasks/<task>/qa-log-roundN.md`：
     - **原始输入**：完整命令/工具调用及所有参数
     - **原始输出**：stdout 全文、stderr 全文、exit_code（不省略不截断）
     - **判断**：PASS/WARN/FAIL + 判断依据（紧跟输出之后）
   - 严禁积攒到执行结束后再回忆填写，日志是给人类审查的第一手证据链
   - 执行结束后从日志汇总生成 `.trellis/tasks/<task>/qa-report-roundN.md`

### Phase 2: Issue 创建

| 判定 | 操作 | Issue 类型 |
|------|------|-----------|
| FAIL | 必须创建 | `--bug --priority P1 --label qa` |
| WARN | 酌情创建 | `--enhancement --priority P2 --label qa` |
| PASS | 不创建 | -- |

- 创建前搜索避免重复
- Issue body 包含完整复现步骤

### Phase 3: Agent 修复

- 读取每个新建 Issue
- 分析根因，修改源码
- 运行 `pnpm test:changed` 验证
- `pnpm build` 重新构建

### Phase 4: 回归验证（循环直到全部通过）

- 重新执行**完整的**随机漫步测试（不仅是失败步骤）
- 如果仍有 FAIL → 回到 Phase 3 继续修复
- 循环直到 100% PASS
- 记录每轮通过率趋势

### Phase 5: 内化场景

- 将测试步骤保存为 `.agents/skills/qa-engineer/scenarios/*.json`
- 更新此文档记录经验

## 触发条件

何时应执行循环验证：

1. **功能交付时**: 新 Issue 实现完成后，执行该功能相关的 QA 场景
2. **回归测试时**: PR 合并前，执行 `pnpm test` + 相关 QA 场景
3. **手动触发**: 用户执行 `/qa run <scenario>` 或 `/qa explore`
4. **斜杠命令**: 用户执行 `/qa-loop [scope] [options]` 自动编排完整循环（参见 `.cursor/rules/qa-loop.mdc`）

## 实践经验（Issue #35 验证记录）

### 2026-02-21 首次循环验证

**Round 1 (Phase 1)**:
- 测试时长: ~9 分钟
- 结果: 34/40 PASS, 3 FAIL, 3 WARN
- 发现 4 个 Issue (#39-#42)

**修复 (Phase 3)**:
- Issue #40: daemon stop 错误处理 — 修改 `stop.ts` 添加 printer 输出
- Issue #41: session param validation — 在 4 个 handler 中添加参数校验
- Issue #42: api-contracts.md — 更新 5 处文档不一致

**Round 2 (Phase 4)**:
- 单元测试: 412/412 全部通过（从 411/412 提升）
- 黑盒测试: 所有可测试路径通过
- Issue #39 (mock 模式限制): 架构性问题，推荐添加 session-handlers.test.ts

**关键发现**:
1. Windows 环境下 `ACTANT_SOCKET` 需要使用命名管道路径
2. Mock launcher 的假 PID 会被 ProcessWatcher 检测为死亡
3. Session Lease API 需要真实 ACP 连接（claude-code 后端）
4. PowerShell 写入 JSON 文件会添加 BOM，需用 `[System.IO.File]::WriteAllText`
5. `issue.sh` 在 Windows 上有 CRLF 兼容问题

### 覆盖缺口（待补充）

| 场景 | 状态 | 原因 |
|------|------|------|
| session.create 正向流程 | 未覆盖 | 需要真实 ACP 后端 |
| session.prompt 正向流程 | 未覆盖 | 同上 |
| session.cancel ACP 集成 | 未覆盖 | 同上 |
| agent chat 双模式切换 | 未覆盖 | 需要交互式终端 |
| Session TTL 过期 | 未覆盖 | 需要时间控制 |
| 多客户端隔离 | 未覆盖 | 需要真实 ACP 后端 |
| SessionRegistry 单元测试 | 缺失 | 应添加 session-registry.test.ts |

## RPC 测试工具

在 QA 测试中通过命名管道发送 JSON-RPC 需要辅助脚本。参考 `qa-rpc.cjs`：

```javascript
// 用法: node qa-rpc.cjs <method> <base64-encoded-params>
// 示例: node qa-rpc.cjs "session.create" "eyJhZ2VudE5hbWUiOiJ0ZXN0In0="
const net = require("net");
const sock = process.env.ACTANT_SOCKET;
const method = process.argv[2];
const params = JSON.parse(Buffer.from(process.argv[3] || "e30=", "base64").toString("utf8"));
const request = JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) + "\n";
const client = net.createConnection(sock, () => client.write(request));
// ... 处理响应
```

## 场景文件清单

| 场景 | 文件 | 模式 | 覆盖功能 |
|------|------|------|---------|
| session-lifecycle | `scenarios/session-lifecycle.json` | mock | Session 错误路径 |
| session-cancel-integration | `scenarios/session-cancel-integration.json` | mock | Cancel 参数验证 |
| proxy-lease-mode | `scenarios/proxy-lease-mode.json` | mock | Proxy 双模式 |
| session-error-handling | `scenarios/session-error-handling.json` | mock | 参数验证+边界 |
| multi-session-isolation | `scenarios/multi-session-isolation.json` | real | 多 Session 隔离 |
| basic-lifecycle | `scenarios/basic-lifecycle.json` | mock | Agent 生命周期 |
| template-management | `scenarios/template-management.json` | mock | 模板 CRUD |
| daemon-connectivity | `scenarios/daemon-connectivity.json` | mock | Daemon 连接 |
| error-handling | `scenarios/error-handling.json` | mock | 通用错误处理 |
| bilibili-video-analysis | `scenarios/bilibili-video-analysis.json` | real | 端到端任务 |
