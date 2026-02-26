---
id: 164
title: "@agent-memory/embedding — 多后端 Embedding 客户端"
status: open
labels:
  - memory
  - feature
  - "priority:P1"
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 162
  - 163
  - 168
relatedFiles:
  - packages/memory/embedding/src/embedding-client.ts
taskRef: null
githubRef: "blackplume233/Actant#187"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-25T00:00:00"
closedAt: null
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
