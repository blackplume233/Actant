# Actant Site Content

当前站点文案只应表达一件事：

- Actant 正在收敛为面向 Agent 的 `ContextFS`
- 当前优先级是统一路径视图、挂载模型、节点模型、权限与生命周期
- `VFS` 是实现内核，不是产品名称

## Public Message

Actant is converging on ContextFS with Linux-style filesystem semantics.

The current public baseline is:

- Product layer: `ContextFS`
- Implementation layer: `VFS`
- Core objects: `mount namespace`, `mount table`, `filesystem type`, `mount instance`, `node type`
- V1 filesystem types: `hostfs`, `runtimefs`, `memfs`
- V1 node types: `directory`, `regular`, `control`, `stream`
- V1 operations: `read`, `write`, `list`, `stat`, `watch`, `stream`

## Public Warning

The repository is in a documentation-first convergence stage.
Read the active spec, design, and roadmap before trusting older narratives or legacy terminology.
