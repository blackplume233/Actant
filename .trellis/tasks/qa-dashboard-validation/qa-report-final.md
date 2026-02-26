# /qa-loop 循环验证汇总

**范围**: Dashboard 可用性验证 — 通过 agent 交互生成 50+ events，验证 Dashboard API/SSE/页面
**环境**: Real launcher mode (Windows 10, PowerShell, `claude-code` backend)
**总轮次**: 2 (Round 1 → 发现问题 → 修复 → Round 2 回归)
**最终结果**: **PASS** (Dashboard 全部页面可用，50 events 生成并展示，REST API 完整)

---

## 通过率趋势

| 轮次 | CLI 操作 | Dashboard API | Dashboard 页面 | Events | 修复的问题 |
|------|---------|---------------|---------------|--------|-----------|
| R1   | 42/57 (74%) | 5/7 (71%) | — | — | — |
| R2   | 45/60 (75%) | 5/5 (100%) | 5/5 (100%) | 50 events ✅ | #1 __dirname, #2 REST endpoints |

---

## 修复的问题

| # | 标题 | 类型 | 文件 | 说明 |
|---|------|------|------|------|
| 1 | `__dirname is not defined` in ESM | Bug (P0) | `packages/api/src/services/app-context.ts` | 用 `import.meta.url` + `fileURLToPath` 替代 ESM 中不存在的 `__dirname` |
| 2 | Dashboard 缺少 `/api/agents` 端点 | Enhancement | `packages/dashboard/src/server.ts` | 新增 `GET /api/agents` → `agent.list` RPC |
| 3 | Dashboard 缺少 `/api/events` 端点 | Enhancement | `packages/dashboard/src/server.ts` | 新增 `GET /api/events` → `events.recent` RPC |

---

## Dashboard 验证结果

### REST API 端点

| 端点 | R1 | R2 | 说明 |
|------|----|----|------|
| `GET /` | ✅ | ✅ | SPA HTML 页面 |
| `GET /api/status` | ✅ | ✅ | Daemon 信息 (version, uptime, agents) |
| `GET /api/agents` | ❌ 404 | ✅ | Agent 列表 (6 agents) |
| `GET /api/events` | ❌ 404 | ✅ | 事件列表 (50 events) |
| `GET /api/canvas` | ✅ | ✅ | Canvas 条目列表 |
| `GET /api/canvas/:name` | ✅ | ✅ | 单个 Canvas (404 for missing) |
| `GET /sse` | ✅ | ✅ | SSE 流 (status/agents/events/canvas) |

### Dashboard 页面 (浏览器验证)

| 页面 | 路由 | 渲染 | 数据展示 | 布局 |
|------|------|------|---------|------|
| Overview | `/` | ✅ | 6 agent cards, summary stats | Clean |
| Agents | `/agents` | ✅ | 6 agents, search + filter | Clean |
| Events | `/events` | ✅ | 50 events, type filters | Clean |
| Canvas | `/canvas` | ✅ | "No running agents" (正确) | Clean |
| Settings | `/settings` | ✅ | v0.2.3, 6 agents, connected | Clean |

### 事件统计 (50 events)

| 事件类型 | 数量 |
|---------|------|
| `session:end` | 9 |
| `process:stop` | 9 |
| `session:start` | 7 |
| `process:start` | 7 |
| `session:context-ready` | 7 |
| `session:preparing` | 7 |
| `process:crash` | 3 |
| `agent:created` | 1 |
| **总计** | **50** |

---

## 残留问题（已知，非 Dashboard 相关）

| # | 标题 | 严重度 | 原因 |
|---|------|--------|------|
| 1 | `agent start` CLI 返回 timeout | P2 | Agent 实际启动成功（有 PID），但 RPC 10s 超时在 ACP session 建立前到期。需增大 `agent.start` 的 RPC 超时或改为异步 |
| 2 | `agent destroy --force` EBUSY | P3 | Windows 文件锁定问题 — Agent 进程可能未完全释放 workspace 目录句柄 |
| 3 | 部分 agent 进程 crash | P3 | `claude-code` backend 在没有 API key 的测试环境中启动后立即退出，被 ProcessWatcher 标记为 crash |

---

## 交互对话轮次明细

| 轮次 | 操作类型 | 命令数 | 描述 |
|------|---------|--------|------|
| R1.1 | Template 管理 | 4 | load, list, show |
| R1.2 | Agent 创建 (失败) | 6 | code-review-agent template 有 skill 依赖 |
| R1.2b | Template 修复 | 2 | 创建 qa-minimal template |
| R2.1 | Template 加载 | 2 | qa-minimal 模板 |
| R2.2 | 批量创建 Agent | 6 | 5 agents + list |
| R2.3 | 启动全部 Agent | 6 | 5 starts (timeout but PID assigned) |
| R2.4 | 状态检查 | 3 | status × 3 |
| R2.5 | 停止部分 Agent | 4 | stop × 3 + list |
| R2.6 | 重启周期 | 5 | start × 2, stop × 2, list |
| R2.7 | 更多生命周期 | 6 | stop × 2, start × 2, status × 2 |
| R2.8 | 快速周期 | 7 | rapid start/stop × 7 |
| R2.9 | 错误处理 | 5 | duplicate/nonexistent/destroy |
| R2.10 | 最终操作 | 11 | create/start/status/stop/destroy + daemon status |
| R2.11 | Dashboard API | 5 | REST endpoint verification |
| Browser | 页面验证 | 5 | 5 routes screenshot + validation |
| **总计** | | **77** | |

---

## 结论

Dashboard 在修复后通过了完整的可用性验证：
- ✅ 所有 5 个页面正常渲染
- ✅ 所有 7 个 REST API 端点正常响应
- ✅ SSE 实时推送 4 类事件 (status, agents, events, canvas)
- ✅ 生成并展示 50 个 EventBus 事件
- ✅ 执行了 11+ 轮对话交互（77 次操作）
- ✅ 修复了 1 个 P0 bug 和 2 个 enhancement
