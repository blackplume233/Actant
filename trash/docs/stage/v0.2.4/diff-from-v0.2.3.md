# Version Diff: v0.2.3 → v0.2.4

> 生成时间: 2026-02-26

---

## 1. RPC 方法变更

### 新增方法

- `agent.updatePermissions` — 恢复自 v0.2.2（v0.2.3 中曾移除）
- `activity.sessions` — 活动会话列表
- `activity.stream` — 活动流
- `activity.conversation` — 活动对话
- `activity.blob` — 活动 Blob
- `canvas.update` — 画布更新
- `canvas.get` — 获取画布
- `canvas.list` — 画布列表
- `canvas.clear` — 清空画布
- `events.recent` — 最近事件

### 移除方法

_无移除 RPC 方法_

### 方法数量

| 版本 | RPC 方法数 |
|------|-----------|
| v0.2.3 | 76 |
| v0.2.4 | 87 |

> 净增 11 个方法：`agent.updatePermissions` 恢复 + 5 个 `activity.*` + 4 个 `canvas.*` + 1 个 `events.recent`。

## 2. CLI 命令变更

| 版本 | CLI 子命令数 | standalone 数 |
|------|-------------|---------------|
| v0.2.3 | 62 | 3 |
| v0.2.4 | 60 | 6 |

> 注：v0.2.4 的 CLI 扫描结构有调整，子命令数略减，standalone 命令数增加（如 dashboard 等）。

## 3. 代码度量变更

| 指标 | v0.2.3 | v0.2.4 | 变化 |
|------|--------|--------|------|
| 总 LOC | 33,625 | 42,460 | +8,835 |
| 总文件数 | 302 | 415 | +113 |
| 测试数 | 64 | 66 | +2 |
| 包数 | 6 | 9 | +3 |

### 按包度量

| 包名 | v0.2.3 LOC | v0.2.4 LOC | 变化 | v0.2.3 文件 | v0.2.4 文件 | 测试变化 |
|------|------------|------------|------|-------------|-------------|----------|
| shared | 2,936 | 4,935 | +1,999 | 20 | 24 | 0 |
| core | 21,831 | 21,779 | -52 | 158 | 166 | 0 |
| cli | 5,071 | 5,538 | +467 | 96 | 109 | 0 |
| api | 2,144 | 3,160 | +1,016 | 19 | 32 | 0 |
| acp | 1,641 | 2,252 | +611 | 8 | 14 | +1 |
| mcp-server | 2 | 135 | +133 | 1 | 4 | 0 |
| pi | — | 689 | **新增** | — | 8 | +1 |
| rest-api | — | 1,049 | **新增** | — | 18 | 0 |
| dashboard | — | 2,923 | **新增** | — | 40 | 0 |

> 注：v0.2.3 的 `api` 包在 v0.2.4 中可能对应拆分/重组；`dashboard`、`rest-api`、`pi` 为 v0.2.4 新增或显著扩大的包。

## 4. Error Codes

| 版本 | 错误码数量 |
|------|-----------|
| v0.2.3 | 16 |
| v0.2.4 | 16 |

_无新增错误码。_

## 5. Breaking Changes

_无 breaking changes。_

- `agent.updatePermissions` 在 v0.2.3 中被移除，v0.2.4 中恢复；若 v0.2.3 期间已适配移除的客户端，可继续使用或切回此方法。

## 6. 总结表

| 类别 | v0.2.3 | v0.2.4 | 变化 |
|------|--------|--------|------|
| RPC 方法数 | 76 | 87 | +11 |
| CLI 子命令数 | 62 | 60 | -2 |
| 总 LOC | 33,625 | 42,460 | +8,835 |
| 总文件数 | 302 | 415 | +113 |
| 测试套件/文件 | 64 | 66 | +2 |
| 包数 | 6 | 9 | +3 |

## 7. 版本要点

v0.2.4 以 Dashboard、REST API 与画布系统为主：

- **Dashboard**：新增 Web 管理界面（约 2,923 LOC）
- **REST API**：新增 REST 层（约 1,049 LOC）
- **Canvas**：新增 `canvas.*` RPC 方法（update/get/list/clear）
- **Activity**：新增 `activity.*` 方法（sessions/stream/conversation/blob）
- **Events**：新增 `events.recent` 查询最近事件
- **agent.updatePermissions**：恢复权限更新 RPC
- **MCP Server**：从 2 LOC 扩展至 135 LOC
- **Pi 后端**：作为独立包纳入度量（689 LOC）
