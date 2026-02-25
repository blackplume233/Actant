---
id: 162
title: "@agent-memory/core — 独立记忆核心包 (零 Actant 依赖)"
status: open
labels:
  - architecture
  - memory
  - feature
  - "priority:P1"
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 14
  - 163
relatedFiles:
  - packages/memory/core/src/types.ts
  - packages/memory/core/src/store.ts
taskRef: null
githubRef: null
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
---

**Related Issues**: [[0014-plugin-heartbeat-scheduler-memory]], [[0163-agent-memory-store-lancedb]]
**Related Files**: `packages/memory/core/`

---

## 目标

创建独立的 `@agent-memory/core` 包，定义通用记忆系统抽象。零 Actant 依赖，可被任何 Agent 框架使用（软耦合设计）。

## 核心内容

### MemoryRecord 统一数据模型

融合 OpenViking (L0/L1/L2 分层) + PageIndex (树状索引) + LanceDB (向量存储) 三者理念：

```typescript
const VECTOR_DIMENSION = 1024;    // 与 embedding 模型对齐, 可配置覆盖
const MAX_CHILD_URIS = 200;      // 超出时使用子查询分页

interface MemoryRecord {
  id: string;
  uri: string;                        // ac://actant/user/coding-style
  layer: "actant" | "template" | "instance";
  templateName?: string;
  instanceName?: string;
  l0_summary: string;                 // ~20 tokens
  l1_overview: string;                // ~200 tokens
  l2_content: string;                 // 完整内容
  vector: Float32Array;               // 固定维度 = VECTOR_DIMENSION
  parentUri?: string;
  childUris?: string[];               // 上限 MAX_CHILD_URIS
  depth: number;
  kind: MemoryKind;
  confidence: number;                 // [0, 1] — 见 Confidence 规则
  tags: string[];
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessedAt: string;
  promotedFrom?: string;
  contentHash?: string;               // l1_overview + kind + tags 的 hash, 用于 promote 去重
}

type MemoryKind = "preference" | "fact" | "decision" | "error" | "practice" | "tool-usage" | "other";
```

**Confidence 规则**: 新建=0.5, 被访问 +0.05 (上限 1.0), 周衰减 ×0.98, import ×0.6, Curator 审批后=0.9。

### MemoryStore 接口

三种检索模式 (一个存储，无需路由器)：

- `recall(query, opts)` — 语义检索
- `navigate(uri, depth)` — 结构导航
- `browse(prefix, level)` — 分层浏览 (L0/L1/L2)

### 通用生命周期

- `Consolidator` — 碎片凝练
- `Promoter` — 跨层提升 (通用逻辑，不含 Agent 审查)
- `DecayPolicy` — 淘汰策略

## 包结构

```
packages/memory/core/
├── src/
│   ├── types.ts           # MemoryRecord, MemoryKind, VECTOR_DIMENSION, MAX_CHILD_URIS
│   ├── store.ts           # MemoryStore 接口 (recall/navigate/browse)
│   ├── uri-validator.ts   # ac:// URI 校验 (防路径穿越 + SQL 注入)
│   ├── content-hash.ts    # contentHash 生成 (promote 去重)
│   ├── in-memory-store.ts # InMemoryMemoryStore (测试用)
│   ├── tiered/            # L0/L1/L2 分层 (借鉴 OpenViking)
│   ├── tree/              # 树状索引 (借鉴 PageIndex)
│   └── lifecycle/         # consolidator, promoter, decay
└── package.json           # 零外部依赖
```

## 验收标准

- [ ] `@agent-memory/core` 包独立发布，零外部依赖
- [ ] MemoryRecord 类型定义完整 (L0/L1/L2 + 树状 + 向量 + contentHash)
- [ ] `VECTOR_DIMENSION` 常量定义且可配置覆盖
- [ ] `MAX_CHILD_URIS` 常量定义并在 store 层强制执行
- [ ] `MemoryKind` 类型枚举完整
- [ ] `confidence` 规则文档化: 初始值/访问增量/衰减/导入打折
- [ ] `validateMemoryUri()` 函数通过安全测试 (路径穿越/SQL 注入/特殊字符)
- [ ] MemoryStore 接口定义 recall/navigate/browse 三种检索
- [ ] `RecallResult` 包含 score 和 matchedBy 调试信息
- [ ] `InMemoryMemoryStore` 测试实现可用
- [ ] Consolidator, Promoter, DecayPolicy 接口定义
- [ ] 单元测试覆盖核心类型和逻辑

## 依赖

- 无 (独立包)

## 被依赖

- #163 @agent-memory/store-lancedb
- #164 @agent-memory/embedding
- #165 @actant/memory MemoryPlugin
