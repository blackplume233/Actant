# QA 集成测试报告 — Issue #298 项目上下文共享与空目录 Bootstrap

**场景**: Issue #298 全部 6 项验收标准端到端验证
**测试工程师**: QA SubAgent
**时间**: 2026-03-18
**环境**: mock launcher, Windows 10, 隔离 temp dir
**结果**: **PASSED** (0 FAIL, 1 WARN)

---

## 摘要

| # | 验收标准 | 步骤 | PASS | FAIL | WARN |
|---|---------|------|------|------|------|
| AC1 | 项目上下文配置能力 | 3 | 3 | 0 | 0 |
| AC2 | 必要上下文完整性 | 3 | 3 | 0 | 0 |
| AC3 | 通用 Skill | 1 | 1 | 0 | 0 |
| AC4 | 空目录 Bootstrap | 3 | 3 | 0 | 0 |
| AC5 | 上下文发现 | 2 | 2 | 0 | 0 |
| AC6 | 验证产物 | 2 | 1 | 0 | 1 |
| EDGE | 边界条件 | 2 | 2 | 0 | 0 |
| UNIT | 单元测试 | 64 | 64 | 0 | 0 |
| **合计** | | **80** | **79** | **0** | **1** |

---

## 验收标准详细结果

### AC1: 项目上下文配置能力 ✅

| 检查项 | 结果 |
|--------|------|
| actant.project.json 入口文件存在且可解析 | ✅ |
| /project/context.json VFS 端点返回完整摘要 | ✅ |
| 入口配置包含 name, version, configsDir, entrypoints | ✅ |

### AC2: 必要上下文完整性 ✅

| 检查项 | 数量 | 结果 |
|--------|------|------|
| Skills 已加载 | 4 (含 project-context-reader) | ✅ |
| Prompts 已加载 | 2 (含 project-context-bootstrap) | ✅ |
| 知识入口 PROJECT_CONTEXT.md 可访问 | 1 | ✅ |

### AC3: 通用 Skill ✅

| 检查项 | 结果 |
|--------|------|
| project-context-reader 存在 | ✅ |
| 内容不绑定单一项目（引用通用 /project/context.json 路径） | ✅ |
| tags 包含 bootstrap, project-context, discovery | ✅ |

### AC4: 空目录 Bootstrap ✅ (关键验收!)

| 检查项 | 结果 |
|--------|------|
| examples/project-context-bootstrap/ 最小集合完整 | ✅ (actant.project.json + PROJECT_CONTEXT.md + 1 skill + 1 prompt + 1 template) |
| 以 bootstrap 目录启动 Hub → active=true | ✅ |
| projectName 正确识别为 "project-context-bootstrap" | ✅ |
| components 计数匹配 (skills=1, prompts=1, templates=1) | ✅ |
| context.json 正确反映最小集合的可用资产 | ✅ |

### AC5: 上下文发现 ✅

Agent 发现四步流程全部通过：

| 步骤 | Agent 操作 | 获得信息 |
|------|-----------|---------|
| 1 | 读 /project/context.json | 项目名、描述、可用资产列表、阅读顺序 |
| 2 | 读 PROJECT_CONTEXT.md | 项目说明和发现路径 |
| 3 | 读 skill content | 操作指南（先读 context.json 再顺序读入口） |
| 4 | 读 prompt content | 行为约束（仅依赖声明的上下文） |

Agent 仅通过 VFS 读取即可回答 #298 要求的三个问题：
- **项目目标是什么** → context.json.description + PROJECT_CONTEXT.md
- **优先读哪些上下文** → entrypoints.readFirst 数组
- **可用资产** → available.skills / prompts / templates 列表

### AC6: 验证产物 ⚠️ (1 WARN)

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 模板通过 VFS 可发现 | ✅ | /hub/templates/ 列出 project-context-agent |
| 模板通过 CLI 域命令可列出 | ⚠️ | `template list` 返回空 — 查询全局 TemplateRegistry 而非项目级 |

**WARN 分析**: CLI `template list` 查询的是全局 TemplateRegistry（基于 `ACTANT_HOME/configs/templates/`），而 Hub 项目模板通过 VFS 访问。这是全局 vs 项目级的架构分层行为，不影响 #298 的核心愿景（Agent 通过 VFS 发现），但从一致性角度是改进点。

---

## 关键发现

1. **空目录 Bootstrap 闭环完全成立**: 仅放置 5 个最小必要文件（actant.project.json + PROJECT_CONTEXT.md + 1 skill + 1 prompt + 1 template），Actant 即可完整加载项目上下文并通过 VFS 暴露。

2. **context.json 是完美的发现入口**: 包含 mode、projectName、description、entrypoints.readFirst、available 列表、components 计数 — Agent 读取一个端点即可建立完整上下文地图。

3. **通用 Skill 设计合理**: project-context-reader 引用通用 `/project/context.json` 路径而非具体项目文件，可跨项目复用。

4. **Hub 项目切换流畅**: 从 monorepo 项目切换到 bootstrap 目录时，Hub 自动重新激活并加载新项目的上下文，无需手动操作。

5. **全局 vs 项目级模板的 UX gap**: `template list` CLI 命令不显示项目级模板（仅显示全局），可能让用户困惑。建议后续统一或在 `template list` 中标注来源（global/project）。

---

## 场景文件已保存

`.agents/skills/qa-engineer/scenarios/project-context-bootstrap.json` — 可供后续回归使用。
