## /qa-loop 循环验证汇总

**范围**: 定时 web 搜索 Agent (20s/60s 间隔, 6+12 轮随机网页检索)
**环境**: real (非 mock)
**总轮次**: 2 (短循环 + 长循环)
**最终结果**: PASS with WARN — Actant 核心功能正常，外部 API 兼容性问题导致 WebSearch 降级

### 通过率趋势

| 轮次 | 间隔 | 搜索轮数 | PASS | WARN | FAIL | 通过率 | 总费用 | 总时长 |
|------|------|---------|------|------|------|--------|--------|--------|
| R1 (短) | 20s | 6 | 3 | 3 | 0 | 50% | $0.675 | ~16min |
| R2 (长) | 60s | 12 | 6 | 6 | 0 | 50% | $1.448 | ~23min |

### Actant 核心功能验证

| 功能 | 状态 | 说明 |
|------|------|------|
| pnpm build | PASS | 6 packages 构建成功 |
| daemon start/stop | PASS | 隔离环境正常启停 |
| template load → schedule/permissions 保留 | PASS | Issue #118 修复确认 |
| agent create → effectivePermissions | PASS | 显式权限列表正确物化 |
| agent run → Claude Code spawn | PASS | 18/18 轮全部成功发起 |
| agent run → WebSearch 权限 | PASS | 0 permission_denials (改进!) |
| agent run → 文本结果返回 | 50% | 9/18 产出文本回答 |
| schedule roundtrip | WARN | 字段保留但 scheduler 未集成 (#103) |
| 20s/60s 间隔遵守 | PASS | 所有间隔正确等待 |
| 环境隔离 + 清理 | PASS | 临时目录创建/清理正常 |
| 边界查询处理 | PASS | 空查询/长查询/非英语查询均未崩溃 |

### 外部因素（非 Actant bug）

| 因素 | 影响 | 根因 |
|------|------|------|
| WebSearch API 400 | 搜索结果为空 | kimi-for-coding 模型的 thinking 模式与 API tool call 格式不兼容 |
| WebFetch 域名安全检查 | 无法获取网页 | Claude Code 域名白名单限制 |
| 模型路由覆盖 | 非配置模型 | 用户本地 Claude Code 配置 → kimi-for-coding |

### 新增 Issue

无新增。所有 WARN 均为已知问题或外部因素：
- Scheduler 未集成 → Issue #103 (已有)
- WebSearch API 兼容性 → Claude Code 模型路由问题，非 Actant scope
- WebFetch 域名限制 → Claude Code 安全策略，非 Actant scope

### 产出物

| 文件 | 说明 |
|------|------|
| `qa-log-round1.md` | 短循环增量日志 (10 步) |
| `qa-report-round1.md` | 短循环报告 |
| `qa-log-round2.md` | 长循环增量日志 (12 轮) |
| `qa-report-round2.md` | 长循环报告 |
| `qa-web-searcher-template.json` | web 搜索 Agent 模板 |
| `web-search-long-loop.json` | 可复用长循环场景 (已保存到 scenarios/) |

### 结论

Actant 的 Agent 生命周期管理、模板加载、权限物化、CLI 调用链路在 18 轮连续 web 搜索测试中**全部正常运行**。WebSearch 权限显式列出后不再被拒绝（对比上次 QA 的 100% 拒绝率）。50% 的 WARN 率完全由 Claude Code 外部 API 兼容性导致，非 Actant 核心功能缺陷。当 Scheduler 集成 (Issue #103) 完成后，heartbeat 自动触发将替代手动 `agent run` + `sleep` 方案。
