---
id: 191
title: GPU Embedding Sidecar — CUDA 加速 (可选)
status: closed
labels:
  - memory
  - "priority:P3"
  - performance
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#191"
closedAs: completed
createdAt: "2026-02-26T01:47:59Z"
updatedAt: "2026-03-18T06:38:35"
closedAt: "2026-03-18T06:35:37Z"
---

**Related Issues**: [[0164-agent-memory-embedding]]

---

## 目标

可选的 Python GPU Embedding 服务，为有 NVIDIA GPU 的用户提供 CUDA 加速的向量生成。

## 实现

~50 行 FastAPI 脚本，暴露 `/embed` 和 `/embed_batch` HTTP 端点。

```
tools/embedding-sidecar/
├── server.py          # FastAPI 服务
├── requirements.txt   # sentence-transformers, fastapi, uvicorn
└── README.md
```

**推荐模型**: `BAAI/bge-m3` (多语言, 1024d) 或 `intfloat/multilingual-e5-large` (768d)

## 性能预期

| 操作 | CPU | GPU (CUDA) | 加速比 |
|------|-----|-----------|--------|
| 单条 Embedding | ~50ms | ~5ms | 10x |
| 批量 100 条 | ~5s | ~100ms | 50x |

## 依赖

- #164 @agent-memory/embedding (sidecar provider)

## 验收标准

- [ ] FastAPI 服务启动正常
- [ ] `/embed` 和 `/embed_batch` 端点可用
- [ ] @agent-memory/embedding 的 sidecar provider 正确调用
- [ ] 无 GPU 时不影响系统 (自动降级)

---
_Synced from `.trellis/issues` (local ID: 168)_

**Author:** cursor-agent
**Milestone:** phase-5
**Related files:** `tools/embedding-sidecar/server.py`, `tools/embedding-sidecar/requirements.txt`
**Related local issues:** #164
