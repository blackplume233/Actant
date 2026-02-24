# QA 集成测试报告 — Round 2 (Edge Cases + Regression)

**场景**: Phase 3 边缘用例深度测试 + 修复回归
**测试工程师**: QA SubAgent
**时间**: 2026-02-22 14:04–14:09
**结果**: **PASSED** (579/579 单元测试, 所有 FAIL 已修复)

## Round 2 发现与修复

### FAIL-1: Manager Zod schemas 丢失 VersionedComponent 字段 (已修复)

**问题**: 5 个 domain manager (skill/prompt/mcp/workflow/plugin) 的 Zod schema 使用默认行为（strip unknown fields），导致 `version`、`$type`、`$version`、`origin`、`tags` 字段在 `validate()` 时被丢弃。

**影响**: 通过 `loadFromDirectory()` 或 `importFromFile()` 加载的组件会丢失版本信息和来源追踪元数据，破坏 #53 版本控制和 #58 公共信封功能。

**修复**: 为所有 5 个 manager 的 Zod schema 添加 `.passthrough()`。

**修复文件**:
- `packages/core/src/domain/skill/skill-manager.ts`
- `packages/core/src/domain/prompt/prompt-manager.ts`
- `packages/core/src/domain/mcp/mcp-config-manager.ts`
- `packages/core/src/domain/workflow/workflow-manager.ts`
- `packages/core/src/domain/plugin/plugin-manager.ts`

### FAIL-2: SKILL.md parser 不支持多行 YAML (已修复)

**问题**: `parseSkillMdContent` 使用单行正则解析 YAML frontmatter，无法处理 `description: |` 块标量语法。

**修复**: 新增 `parseYamlFrontmatter()` 函数，支持:
- 块标量 (`|` 保留换行, `>` 折叠)
- 引号字符串 (含转义)
- 单行值 (原有行为)

**修复文件**: `packages/core/src/source/skill-md-parser.ts`
**新增测试**: multi-line YAML 值解析

### TypeScript 类型错误修复

`parseYamlFrontmatter` 中数组索引访问未做空值断言，导致 12 个 TS18048/TS2345 错误。已通过非空断言 (`!`) 修复。

## 回归验证

| 指标 | 值 |
|------|---|
| 测试文件 | 51 |
| 总测试数 | 579 |
| 通过 | 579 |
| 失败 | 0 |
| 新增测试 | +1 (SKILL.md multi-line YAML) |

## 通过率趋势

| 轮次 | 单元测试 | 白盒检查 | 黑盒 CLI | 修复 |
|------|---------|---------|---------|------|
| R1 | 578/578 | 63/66 (3 WARN) | 4/4 | 1 doc fix |
| R2 | 579/579 | 20/20 | 8/8 | 2 code fixes + 1 TS fix |

## 残留 WARN (非关键，不需修复)

| WARN | 描述 | 原因 |
|------|------|------|
| InstanceRegistry.load() | 不主动创建 registry.json | 可接受 — 首次 save() 创建 |
| 并发 save() | 最后写入胜出 | 低风险 — 单 Daemon 进程 |
| manifest.json content 缺失 | 使用路径原值 | 已有 warn 日志 |
| 无 template sync 测试 | source-manager 测试覆盖 skill 但未专门测 template delta | 低优先级 |
