---
name: Phase 3 Issue 收尾与状态同步
overview: 关闭已完成的 Phase 3 issues、修正 phase3-todo.md 不一致状态、处理遗留 QA issue
todos:
  - id: close-phase3a-issues
    content: "P0: 关闭 Phase 3a 子 issues (#43, #44, #45) 和 epic (#38)"
    status: completed
  - id: close-phase3b-issues
    content: "P0: 关闭 Phase 3b 子 issues (#46, #47) 和 epic (#39)"
    status: completed
  - id: close-phase3c-issues
    content: "P0: 关闭 Phase 3c 子 issues (#48, #49, #50) 和 epic (#40)"
    status: completed
  - id: handle-design-issues
    content: "P1: 处理设计类 issue (#37 雇员调度设计 — 添加 MVP 完成备注)"
    status: completed
  - id: handle-qa-issue-42
    content: "P1: 处理 QA issue #42 (api-contracts 不一致) — 验证并关闭"
    status: completed
  - id: fix-phase3-todo
    content: "P0: 修正 phase3-todo.md 中不一致的勾选状态"
    status: completed
isProject: false
---

# Phase 3 Issue 收尾与状态同步

Phase 3 全部功能代码已实现完毕（538/538 测试通过），spec 文档已同步更新，QA Round 1 已完成。但 14 个 Phase 3 相关 issues 全部仍为 open 状态，需要系统性关闭并同步各处状态。

---

## 一、背景分析

### 当前状态
- **代码**: 100% 完成，全量测试 538/538 通过（1 个已知 flaky 与 Phase 3 无关）
- **Spec 文档**: `api-contracts.md` 和 `config-spec.md` 已包含 Phase 3 全部新增内容
- **QA**: Round 1 完成，2 个发现的问题已修复（formatter 缺 plugins 字段、scaffold 缺 AGENTS.md）
- **Issues**: 14 个 Phase 3 实现 issues 全部仍为 open

### 根因
Phase 3 实现过程中专注于代码交付，完成后未执行 issue 关闭流程。

---

## 二、方案设计

### 分类处理策略

| 类别 | Issues | 操作 |
|------|--------|------|
| **已完成实现 issue** | #43, #44, #45, #46, #47, #48, #49, #50 | close --as completed |
| **已完成 epic issue** | #38, #39, #40 | close --as completed（所有子 issue 已完成） |
| **设计 issue (MVP done)** | #37 | 添加 comment 说明 MVP 完成，保持 open（webhook/watch 未实现） |
| **独立设计 issue** | #36 | 保持 open（权限管理非 Phase 3 范畴） |
| **QA 文档 issue** | #42 | 验证修复后 close --as completed |
| **Phase3 TODO 文档** | phase3-todo.md | 勾选已完成的 spec 更新项 |

---

## 三、实施计划

### Phase 1: 关闭已完成 Issues

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 1 | 关闭 #43, #44, #45 (Phase 3a sub-issues) + #38 (epic) | P0 | - | 5min |
| 2 | 关闭 #46, #47 (Phase 3b sub-issues) + #39 (epic) | P0 | - | 3min |
| 3 | 关闭 #48, #49, #50 (Phase 3c sub-issues) + #40 (epic) | P0 | - | 5min |

### Phase 2: 处理设计和 QA Issues

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 4 | #37: 添加 MVP 完成 comment | P1 | - | 3min |
| 5 | #42: 验证修复并关闭 | P1 | - | 5min |

### Phase 3: 文档同步

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 6 | 修正 phase3-todo.md 不一致项 | P0 | Phase 1 | 3min |

---

## 四、影响范围

### Files to Modify
- `.trellis/issues/0043-base-component-manager-crud.json`: close
- `.trellis/issues/0044-plugin-manager-schema.json`: close
- `.trellis/issues/0045-component-rpc-cli-crud.json`: close
- `.trellis/issues/0046-backend-builder-implementations.json`: close
- `.trellis/issues/0047-workspace-builder-migration.json`: close
- `.trellis/issues/0048-task-queue-dispatcher.json`: close
- `.trellis/issues/0049-input-router-sources.json`: close
- `.trellis/issues/0050-employee-scheduler-integration.json`: close
- `.trellis/issues/0038-unified-component-management.json`: close
- `.trellis/issues/0039-workspace-builder.json`: close
- `.trellis/issues/0040-employee-scheduler-n8n.json`: close
- `.trellis/issues/0037-employee-agent-scheduling.json`: add comment
- `.trellis/issues/0042-api-contracts-doc-inconsistencies.json`: close
- `.trellis/phase3-todo.md`: fix checkboxes

### Risk Assessment
- **低风险**: 仅修改 issue JSON 状态和文档，不涉及代码变更

---

## 五、验收标准

- [x] Phase 3a 子 issues (#43, #44, #45) 和 epic (#38) 已关闭
- [x] Phase 3b 子 issues (#46, #47) 和 epic (#39) 已关闭
- [x] Phase 3c 子 issues (#48, #49, #50) 和 epic (#40) 已关闭
- [x] #37 添加 Phase 3c MVP 完成 comment
- [x] #42 验证后关闭
- [x] phase3-todo.md 所有已完成项正确勾选

---

## 六、相关参考

- `.trellis/phase3-todo.md` — Phase 3 实施追踪
- `.trellis/spec/api-contracts.md` — 已更新的接口文档
- `.trellis/spec/config-spec.md` — 已更新的配置规范
- `.trellis/tasks/qa-phase3/qa-log-round1.md` — QA 验证日志
