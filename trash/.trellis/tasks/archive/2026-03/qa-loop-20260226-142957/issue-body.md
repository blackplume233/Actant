## 问题描述

QA Loop Round 1 (2026-02-26) 发现 6 个 FAIL，全部为**场景设计问题**而非代码缺陷：

## 发现的问题

### 1. cursor backend 不支持 acp mode (4 steps)

**场景**: basic-lifecycle, error-handling
**问题**: 场景模板使用 cursor backend，但 agent start 使用 acp launch mode。Cursor 仅支持 resolve/open。
**错误**: Backend "cursor" does not support "acp" mode. Supported modes: [resolve, open]

**修复建议**:
- 方案 A: 将场景模板 backend 改为 claude-code（支持 acp）
- 方案 B: 将 start/stop 步骤改为 resolve/open 测试流程
- 方案 C: 添加 mock backend 支持 acp 模式的测试 fixture

### 2. destroy --force 幂等行为 (1 step)

**场景**: error-handling/destroy-nonexistent
**问题**: destroy --force 设计为幂等，对不存在 Agent 返回 exit 0。场景期望 exit 1。
**修复**: 更新 expect 为 "exit 0, 输出 already absent"

### 3. 环境预加载模板导致 list 非空 (1 step)

**场景**: template-management/list-empty
**问题**: Daemon 自动加载 actant-hub 模板。场景期望空列表。
**修复**: 更新 expect 为 "不含本场景特有模板" 而非 "空列表"

## QA 报告引用

完整日志: .trellis/tasks/qa-loop-20260226-142957/qa-log-round1.md
报告: .trellis/tasks/qa-loop-20260226-142957/qa-report-round1.md
