# Project Review — 项目审查

以独立审查员角色审查 Actant 项目的进度、质量与 Roadmap 合理性。

**核心约束**：只读审查，不修改任何文件。审查意见通过创建 Issue（`review` 标签）和添加 Comment 输出。

## 前置准备

读取审查技能定义：

```
@.agents/skills/project-reviewer/SKILL.md
```

按照技能文件中的完整流程执行审查。

## 快速审查流程

### 1. 收集上下文

```bash
./.trellis/scripts/get-context.sh
cat .trellis/roadmap.md
./.trellis/scripts/issue.sh stats
./.trellis/scripts/issue.sh list
./.trellis/scripts/task.sh list
git log --oneline -20 --format="%h %s (%cr)"
```

### 2. 进度审查

- Roadmap「当前进行中」是否与实际开发活动一致
- 是否有 Issue 长期停滞
- 依赖链是否畅通
- 已完成项是否正确标记

### 3. 质量审查

```bash
# Forbidden Patterns 扫描
rg '\bany\b' --type ts packages/ --glob '!*.test.ts' --glob '!*.d.ts' || true
rg 'console\.(log|warn|error)' --type ts packages/ || true
rg 'TODO|FIXME|HACK' --type ts packages/ || true

# 测试配对检查
# 对比源文件和测试文件

# 构建/类型检查
pnpm typecheck 2>&1 || true
```

### 4. Roadmap 合理性审查

- Issue 编号/标题/状态与实际数据一致性
- 依赖关系完整性
- 优先级合理性
- 风险项覆盖度

### 5. 输出审查意见

对于发现的问题：

```bash
# 创建前先搜索避免重复
./.trellis/scripts/issue.sh search "<关键词>"

# 创建 Issue 时必须指定类型标志和优先级：
#   --bug          缺陷（测试失败、运行时错误、数据不一致等）
#   --feature      新功能需求
#   --enhancement  改进建议（流程优化、规范完善等）

# Critical 级别（P0/P1）
./.trellis/scripts/issue.sh create "<标题>" \
  --bug --priority P1 --label review \
  --body "<详情>"

# Warning 级别（P2）
./.trellis/scripts/issue.sh create "<标题>" \
  --enhancement --priority P2 --label review \
  --body "<详情>"

# 对已有 Issue 补充观点
./.trellis/scripts/issue.sh comment <id> "[Review] <审查意见>"
```

### 6. 输出审查报告摘要

按以下格式向用户输出：

```markdown
## 审查报告摘要

**审查时间**: YYYY-MM-DD
**审查范围**: 进度 / 质量 / Roadmap

### 发现统计
| 严重度 | 数量 |
|--------|------|
| Critical | N |
| Warning  | N |
| Info     | N |

### 本次创建的 Issue
| Issue | 标题 | 类型 | 优先级 | 摘要 |
|-------|------|------|--------|------|
| #XX | <标题> | bug/enhancement/feature | P1 | <一句话摘要> |
...

### 本次添加的 Comment
| Issue | 摘要 |
|-------|------|
| #XX | <一句话摘要> |
...

### 关键发现
1. [严重度] #Issue — 标题（简要描述）
...

### 整体评价
<总结>
```
