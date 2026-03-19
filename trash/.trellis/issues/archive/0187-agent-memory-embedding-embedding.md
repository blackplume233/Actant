---
id: 187
title: @agent-memory/embedding — 多后端 Embedding 客户端
status: closed
labels:
  - feature
  - memory
  - "priority:P1"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#187"
closedAs: completed
createdAt: "2026-02-26T01:47:55Z"
updatedAt: "2026-03-18T06:38:30"
closedAt: "2026-03-18T06:35:23Z"
---

**Related Issues**: [[0162-agent-memory-core-package]], [[0163-agent-memory-store-lancedb]], [[0168-gpu-embedding-sidecar]]
**Related Files**: `packages/memory/embedding/`

---

## 目标

统一的 Embedding 客户端，支持多后端，为 LanceDB 存储提供向量生成能力。

## 支持的后端

| Provider | 环境 | 依赖 |
|----------|------|------|
| OpenAI API | 有网络 | openai (可选 peer dep) |
| ONNX Runtime | 离线 | onnxruntime-node (可选) |
| GPU Sidecar | 有 CUDA GPU | HTTP 调用 (#168) |

## 核心接口

```typescript
interface EmbeddingClient {
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  readonly dimensions: number;
}
```

## 依赖

- #162 @agent-memory/core

## 被依赖

- #163 @agent-memory/store-lancedb
- #168 GPU Embedding Sidecar (可选)

## 验收标准

- [ ] 统一 EmbeddingClient 接口
- [ ] OpenAI provider 可用
- [ ] ONNX provider 可用 (离线场景)
- [ ] 自动降级: GPU sidecar → OpenAI → ONNX

---
_Synced from `.trellis/issues` (local ID: 164)_

**Author:** cursor-agent
**Milestone:** phase-5
**Related files:** `packages/memory/embedding/src/embedding-client.ts`
**Related local issues:** #162, #163, #168
