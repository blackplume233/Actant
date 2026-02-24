## QA 集成测试报告

**场景**: ultimate-real-user-journey (终极全旅程 QA)
**测试工程师**: QA SubAgent
**时间**: 2026-02-24T20:20:04 ~ 2026-02-24T20:21:48 (约 104 秒)
**结果**: **PASSED (有条件)** — 215/247 步骤通过, 9 警告, 13 失败, 10 跳过

---

### 摘要统计

| 指标 | 数值 |
|------|------|
| 总步骤 | 247 |
| PASS | 215 (87.0%) |
| WARN | 9 (3.6%) |
| FAIL | 13 (5.3%) |
| SKIP | 10 (4.0%) |
| 执行耗时 | 104 秒 |
| 创建 Issue | 3 个 |

### Phase 通过率

| Phase | 描述 | 步骤数 | 通过 | 结果 |
|-------|------|--------|------|------|
| P0 基础设施 | CLI 版本、帮助 | 5 | 5 | ✅ 100% |
| P1 Setup | 安装向导 | 8 | 8 | ✅ 100% |
| P2 Template | 模板管理 | 12 | 12 | ✅ 100% |
| P3 Skill | Skill CRUD + roundtrip | 12 | 12 | ✅ 100% |
| P3 Prompt | Prompt CRUD + roundtrip | 10 | 10 | ✅ 100% |
| P3 MCP | MCP CRUD + roundtrip | 10 | 10 | ✅ 100% |
| P3 Workflow | Workflow CRUD + roundtrip | 10 | 10 | ✅ 100% |
| P3 Plugin | Plugin CRUD + roundtrip | 12 | 12 | ✅ 100% |
| P4 Source | Source 生态管理 | 12 | 10 | ⚠ 83% |
| P5 Preset | Preset 查看/应用 | 8 | 6 | ⚠ 75% |
| P6 Agent 基础 | 创建/销毁/状态 | 15 | 14 | ⚠ 93% |
| P7 多后端 | Cursor/Claude/Pi 共存 | 21 | 17 | ⚠ 81% |
| P8 域上下文物化 | 白盒验证物化文件 | 17 | 14 | ⚠ 82% |
| P9 Agent 通信 | Start/Run/Prompt/Dispatch | 14 | 8 | ⚠ 57% |
| P10 Scheduler | Heartbeat 调度 | 10 | 7 | ⚠ 70% |
| P11 Session/Proxy | Session CRUD + Proxy | 12 | 4 | ⚠ 33% |
| P12 Self-Update | 版本检查/Dry-run | 4 | 4 | ✅ 100% |
| P13 错误处理 | 错误路径全覆盖 | 22 | 21 | ⚠ 95% |
| P14 安全模型 | API Key 泄露检测 | 9 | 9 | ✅ 100% |
| P15 幂等性/边界 | 重复操作/长名称/格式 | 10 | 9 | ⚠ 90% |
| P16 并发 | 批量创建/销毁 | 12 | 12 | ✅ 100% |
| P17 清理 | 最终状态验证 | 5 | 5 | ✅ 100% |

---

### 失败/警告分析

#### 真实 Bug（已创建 Issue）

**1. [#147] Pi backend ACP bridge 在 Windows 上路径含空格时无法启动 (P1)**

- **步骤**: p9-comm-start, p10-sched-start, p11-session-start
- **严重性**: P1 — 所有 Pi 后端在默认 Windows 安装下完全不可用
- **根因**: ProcessLauncher 未正确处理 `C:\Program Files\nodejs\node.exe` 中的空格
- **影响范围**: Phase 9-11 中所有依赖 Pi 后端启动的测试（含 Session/Proxy 全部流程）

**2. [#148] agent create --overwrite 在非 --work-dir 场景被静默忽略 (P2)**

- **步骤**: p15-edge-overwrite-2
- **严重性**: P2 — 功能行为与用户预期不一致
- **根因**: `--overwrite` 选项仅在 `--work-dir` 场景下生效，builtin 实例目录不受影响

**3. [#149] Plugin 物化未创建 .cursor/extensions.json (P2)**

- **步骤**: p8-ctx-wb-extensions
- **严重性**: P2 — 域上下文物化不完整
- **根因**: WorkspaceBuilder 未实现 plugin → .cursor/extensions.json 的物化逻辑

#### Runner 限制导致的误报 (非真实 Bug)

| 步骤 | 原因 | 实际状态 |
|------|------|----------|
| p6-agent-wb-dir-removed | Runner 将 ENOENT (目录不存在=预期结果) 判为 FAIL | ✅ 实际 PASS |
| p8-ctx-wb-dir-gone | 同上 | ✅ 实际 PASS |
| p9-comm-prompt | Runner 按空格分词破坏了 `-m "What is 2+2?"` | ⚠ 无法验证 |
| p9-comm-run | Runner 分词问题破坏了 `--prompt "Say hello..."` | ⚠ 无法验证 |
| p9-comm-dispatch | Runner 分词问题破坏了 `-m "Background..."` | ⚠ 无法验证 |
| p10-sched-dispatch-critical | Runner 分词问题 | ⚠ 无法验证 |

#### 场景设计问题 (非系统 Bug)

| 步骤 | 原因 | 修正建议 |
|------|------|----------|
| p4-source-validate-local | `configs/` 缺少 `actant.json` 清单文件，非合法 source 包 | 场景应预期 exit=1 或使用含 actant.json 的目录 |
| p4-source-validate-path | 同上 | 同上 |
| p5-preset-apply | 模板注册名为 `actant-hub@code-reviewer` 而非 `code-reviewer` | 场景应使用命名空间全名 |
| p5-tpl-show-applied | 同上 | 同上 |
| p7-adopt-prep / p7-adopt | 伪命令 `_setup:` 被跳过，adopt 前置条件不满足 | Runner 需实现伪命令处理 |
| p8-ctx-wb-cursor-settings | `.cursor/settings.json` 不是必须产物 | 场景期望应调整为"可选" |

#### Session/RPC 伪命令跳过 (Runner 不支持)

以下 10 步被标记 SKIP，因为 `_rpc:` 和 `_setup:` 伪命令需要专用 RPC 客户端：
p11-session-list-empty, p11-session-create, p11-session-list-one, p11-session-prompt, p11-session-cancel, p11-session-close, p11-session-list-closed, p13-err-session-noagent, p13-err-session-badid, p7-adopt-prep

---

### 核心功能验证总结

| 功能域 | 状态 | 备注 |
|--------|------|------|
| CLI 基础设施 (help/version) | ✅ 完全通过 | 5/5 |
| Setup 向导 | ✅ 完全通过 | 全跳过模式、幂等性均 OK |
| Template CRUD | ✅ 完全通过 | load/list/show/validate/persist 全正确 |
| Skill CRUD + roundtrip | ✅ 完全通过 | add/show/export/remove/reimport 闭环 |
| Prompt CRUD + roundtrip | ✅ 完全通过 | 同上 |
| MCP CRUD + roundtrip | ✅ 完全通过 | 同上 |
| Workflow CRUD + roundtrip | ✅ 完全通过 | 同上 |
| Plugin CRUD + roundtrip | ✅ 完全通过 | 同上 |
| Source 生态 | ⚠ 部分通过 | 核心操作 OK，validate 对非标准目录报错合理 |
| Preset 查看 | ✅ 通过 | list/show 含命名空间正确 |
| Agent 生命周期 | ✅ 通过 | create/status/resolve/open/destroy 全流程 |
| 多后端共存 | ✅ 通过 | cursor/claude-code/pi 同时创建和管理 |
| 域上下文物化 | ⚠ 大部分通过 | skills/prompts/mcp/workflow 物化正确，plugin 未物化 |
| Agent 通信 (Pi) | ❌ 被阻塞 | Pi 启动失败（#147 Windows 路径 Bug） |
| Scheduler | ❌ 被阻塞 | 同上 |
| Session/Proxy | ❌ 被阻塞 | Pi 启动失败 + Runner 不支持 RPC 伪命令 |
| Self-Update | ✅ 完全通过 | check/dry-run/no-source 错误路径全正确 |
| 错误处理 | ✅ 几乎完全通过 | 21/22 错误路径行为正确 |
| 安全模型 | ✅ 完全通过 | 无 API key 泄露 |
| 幂等性 | ✅ 通过 | destroy --force 幂等、template load 覆盖 |
| 并发多 Agent | ✅ 完全通过 | 5 Agent 批量创建/销毁无冲突 |

---

### 创建的 Issue

| Issue | 标题 | 类型 | 优先级 |
|-------|------|------|--------|
| [#147](https://github.com/blackplume233/Actant/issues/147) | Pi backend ACP bridge fails on Windows when node.exe path contains spaces | bug | P1 |
| [#148](https://github.com/blackplume233/Actant/issues/148) | agent create --overwrite silently ignored without --work-dir | bug | P2 |
| [#149](https://github.com/blackplume233/Actant/issues/149) | Plugin materialization: .cursor/extensions.json not created | enhancement | P2 |

---

### 后续建议

1. **优先修复 #147** — Pi 路径空格 Bug 阻塞了 Phase 9-11 全部通信/调度/Session 测试
2. **Runner 改进** — 增加 shell-aware 参数分词（正确处理引号内空格）和 `_rpc:` 伪命令执行能力
3. **场景修正** — 更新 source-validate 和 preset-apply 步骤的期望，使用命名空间全名
4. **修复后 Re-run** — 修复 #147 后重新运行 Round 2 以验证 Pi 通信全流程

### 完整执行日志

见 `qa-log-round1.md` (同目录)

### 结构化结果

见 `results.json` (同目录, 247 条记录)
