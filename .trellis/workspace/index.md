# Workspace Index

`.trellis/workspace/` 只用于当前协作会话产生的临时工作记录。  
历史 journal 已移入 `trash/`，不再作为当前架构、实现或规范依据。

如果需要新建本地工作记录，可在此目录下重新创建新的开发者工作区。

当前工作目录治理基线：

- 活跃术语统一使用 `mount namespace`、`mount table`、`filesystem type`、`mount instance`、`node type`
- 当前默认配置入口是 `actant.namespace.json`
- `docs/design/contextfs-v1-linux-terminology.md` 是 Linux 术语主设计文档
