---
name: "Phase 3: 通信·管理·构造·调度 — 总览"
overview: "Phase 3 拆分为 3 个独立子计划，每次聚焦一个 Issue，逐步推进"
todos:
  - id: phase3a
    content: "Phase 3a: #38 统一组件管理体系"
    status: pending
  - id: phase3b
    content: "Phase 3b: #39 Workspace 构造器（依赖 3a）"
    status: pending
  - id: phase3c
    content: "Phase 3c: #40 雇员型 Agent 调度器（独立）"
    status: pending
isProject: true
---

# Phase 3: 通信·管理·构造·调度 — 总览

拆分为 3 个独立子计划，每次聚焦一个 Issue：

## 子计划一览

| 子计划 | Issue | 依赖 | 可独立启动 |
|--------|-------|------|-----------|
| **Phase 3a** | #38 统一组件管理 | Phase 2 ✅ | ✅ 是 |
| **Phase 3b** | #39 Workspace 构造器 | #38 完成 | ❌ 需等 3a |
| **Phase 3c** | #40 雇员型 Agent 调度器 | Phase 1/2 ✅ | ✅ 是 |

## 推荐顺序

```
Phase 3a (#38) ──→ Phase 3b (#39)
Phase 3c (#40)     ↑ 可与 3a 并行
```

先做 **3a**（#38），因为 3b 依赖它。**3c** 可以与 3a/3b 并行推进。

## 详细计划文件

- `.cursor/plans/phase3a-component-management.md`
- `.cursor/plans/phase3b-workspace-builder.md`
- `.cursor/plans/phase3c-employee-scheduler.md`
