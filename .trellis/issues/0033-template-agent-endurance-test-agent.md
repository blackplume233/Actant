---
id: 33
title: "Template: 耐久测试专用 Agent 配置 (Endurance Test Agent)"
status: open
labels:
  - feature
  - "priority:P2"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#38"
closedAs: null
createdAt: "2026-02-20T16:20:26"
updatedAt: "2026-02-20T16:20:26"
closedAt: null
---

## 目标

创建一个专门用于执行**耐久测试**（Endurance Testing）的 Agent Template，配置使用 `claude-code` 作为后端，使用默认模型提供者，能够自动化运行项目的耐久测试套件。

## 背景

Actant 已经建立了完整的耐久测试规范（`.trellis/spec/endurance-testing.md`），包含 6 个 Phase 1 场景和多个验证不变量。目前这些测试需要手动执行：

```bash
# 快速回归
ENDURANCE_DURATION_MS=5000 pnpm test:endurance

# 发版前完整验证
ENDURANCE_DURATION_MS=600000 pnpm test:endurance
```

需要一个**专用的 Agent** 来自动化执行这些测试、分析结果并生成报告。

## 需求

### 1. Agent Template 配置

创建 `configs/templates/endurance-tester.json`：

```json
{
  "name": "endurance-tester",
  "version": "1.0.0",
  "description": "专门用于执行 Actant 耐久测试的 Agent，自动运行测试、分析结果、生成报告",
  "backend": {
    "type": "claude-code",
    "config": {}
  },
  "provider": {
    "type": "anthropic",
    "config": {
      "model": "claude-3-5-sonnet-20241022"
    }
  },
  "domainContext": {
    "skills": [
      "endurance-test-executor",
      "test-result-analyzer",
      "performance-regression-detector"
    ],
    "prompts": [
      "endurance-tester-system",
      "test-report-generator"
    ],
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
      }
    ],
    "workflow": "endurance-test-workflow"
  },
  "initializer": {
    "steps": [
      { "type": "git-init" },
      { "type": "npm-install" },
      { "type": "exec", "config": { "command": "pnpm", "args": ["build"] } }
    ]
  },
  "metadata": {
    "purpose": "endurance-testing",
    "team": "platform",
    "category": "testing"
  }
}
```

### 2. 需要创建的配套资源

#### Skills（放在 `configs/skills/`）

**skill: endurance-test-executor**
```markdown
# Endurance Test Executor

执行 Actant 耐久测试套件。

## 能力
- 运行快速回归测试（5s）
- 运行完整耐久测试（10min）
- 运行深度浸泡测试（1h+）
- 并行执行多个场景

## 命令
- `pnpm test:endurance` - 默认 30s 测试
- `ENDURANCE_DURATION_MS=5000 pnpm test:endurance` - 快速回归
- `ENDURANCE_DURATION_MS=600000 pnpm test:endurance` - 完整验证
```

**skill: test-result-analyzer**
```markdown
# Test Result Analyzer

分析耐久测试结果，识别问题模式。

## 分析维度
1. 失败场景识别（E-LIFE, E-SVC, E-SHOT 等）
2. 不变量违反检测（INV-DISK, INV-CLEAN, INV-STATUS 等）
3. 性能退化检测（操作计数趋势）
4. 错误分类（状态机错误、资源泄漏、进程残留）
```

**skill: performance-regression-detector**
```markdown
# Performance Regression Detector

检测耐久测试中的性能退化。

## 检测指标
- 操作吞吐量（ops/ms）
- 内存使用趋势
- 进程启动时间
- 状态转换延迟

## 基线对比
- 与历史测试记录对比
- 阈值告警（下降 > 20%）
```

#### Prompts（放在 `configs/prompts/`）

**prompt: endurance-tester-system**
```markdown
你是一个专门的耐久测试工程师 Agent。你的任务是自动化执行 Actant 的耐久测试套件，确保系统在长期运行下的稳定性和正确性。

## 核心职责
1. 执行耐久测试（快速回归、完整验证、深度浸泡）
2. 分析测试结果，识别失败模式和性能退化
3. 生成结构化的测试报告
4. 对发现的问题进行分类和优先级排序

## 耐久测试场景（Phase 1）
- E-LIFE: 完整生命周期循环
- E-SVC: acp-service 崩溃重启
- E-SHOT: one-shot 执行与清理
- E-EXT: 外部 Spawn 完整流程
- E-DAEMON: Daemon 重启恢复
- E-MIX: 混合并发操作

## 不变量检查
- INV-DISK: 磁盘/缓存一致性
- INV-CLEAN: 资源清理完整性
- INV-STATUS: 状态值合法性
- INV-COUNT: 缓存计数准确性
- INV-PID: PID 无残留
- INV-OWNER: 所有权正确性

## 输出格式
所有测试报告使用以下结构：
```yaml
test_run:
  timestamp: ISO8601
  duration_ms: number
  scenarios_tested: string[]
results:
  passed: number
  failed: number
  errors: []
performance:
  baseline_comparison: {}
regressions_detected: []
recommendations: []
```
```

**prompt: test-report-generator**
```markdown
生成耐久测试报告的详细指南。

## 报告结构
1. 执行摘要（通过/失败状态）
2. 场景覆盖详情
3. 不变量验证结果
4. 性能指标趋势
5. 发现的 issues
6. 修复建议

## 优先级分类
- P0: 状态机错误、数据丢失风险
- P1: 资源泄漏、性能显著退化
- P2: 边缘 case 失败、轻微性能下降
- P3: 建议优化项
```

#### Workflow（放在 `configs/workflows/`）

**workflow: endurance-test-workflow**
```markdown
# Endurance Test Workflow

## Phase 1: 环境准备
- [ ] 检查 Node.js 版本 (>= 22)
- [ ] 检查 pnpm 版本 (>= 9)
- [ ] 安装依赖 `pnpm install`
- [ ] 构建项目 `pnpm build`

## Phase 2: 快速回归
- [ ] 运行 5s 快速耐久测试
- [ ] 验证所有 Phase 1 场景通过
- [ ] 检查 6 个不变量

## Phase 3: 完整验证（可选）
- [ ] 运行 10 分钟耐久测试
- [ ] 收集性能基线数据
- [ ] 对比历史趋势

## Phase 4: 报告生成
- [ ] 汇总测试结果
- [ ] 识别失败模式
- [ ] 生成 YAML 格式报告
- [ ] 输出到 `.trellis/reports/endurance-{timestamp}.md`
```

### 3. 初始化器步骤依赖

此 Template 依赖 Issue #32（Initializer 框架）完成后才能完全工作：
- `git-init`: 初始化 workspace
- `npm-install`: 安装依赖
- `exec`: 执行构建命令

在 #32 完成前，可以使用以下 workaround：

```bash
# 手动创建实例并初始化
actant agent create --template endurance-tester --id tester-1
cd ~/.actant/instances/tester-1
pnpm install
pnpm build
```

### 4. Agent 使用方式

#### One-shot 模式（CI 集成）
```bash
actant agent start tester-1 --mode one-shot --task "run-quick-regression"
```

#### Service 模式（长期监控）
```bash
actant agent start tester-1 --mode acp-service
# 然后定期通过 ACP 调用执行测试
```

## 验收标准

- [ ] `configs/templates/endurance-tester.json` 模板文件
- [ ] `configs/skills/endurance-test-executor.md` Skill 定义
- [ ] `configs/skills/test-result-analyzer.md` Skill 定义
- [ ] `configs/skills/performance-regression-detector.md` Skill 定义
- [ ] `configs/prompts/endurance-tester-system.md` Prompt 定义
- [ ] `configs/prompts/test-report-generator.md` Prompt 定义
- [ ] `configs/workflows/endurance-test-workflow.md` Workflow 定义
- [ ] 模板通过验证 `actant template validate`
- [ ] 可成功创建实例 `actant agent create --template endurance-tester`
- [ ] 文档：使用指南和示例报告

## 依赖

- Issue #32: Initializer 框架（用于自动执行 `pnpm install` 和 `pnpm build`）
- 可选：Template hot-reload（Issue #5）可简化配置迭代

## 关联文档

- `.trellis/spec/endurance-testing.md` - 耐久测试规范
- `.trellis/spec/config-spec.md` - 配置规范
