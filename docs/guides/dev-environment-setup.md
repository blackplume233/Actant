# Development Environment Setup

本指南只保留当前阶段仍然安全的最小环境信息。  
当前优先级是文档基线统一，而不是推广旧 CLI/daemon 使用流。

## Baseline Requirements

- Node.js 22+
- pnpm 9+
- Git

## Repository Bootstrap

```bash
git clone https://github.com/blackplume233/Actant.git
cd Actant
pnpm install
```

如需本地校验仓库可构建，再执行：

```bash
pnpm build
```

## Before Any Development

先读当前文档基线，而不是直接相信仓库里所有旧路径：

1. `.trellis/spec/index.md`
2. `docs/design/contextfs-architecture.md`
3. `docs/design/actant-vfs-reference-architecture.md`
4. `docs/planning/contextfs-roadmap.md`

## Current Warning

当前仓库并不是“所有历史功能文档都仍然有效”的状态。  
如果某份环境说明、功能说明或站点文案没有明确围绕 ContextFS 基线展开，就不应作为实现依据。
