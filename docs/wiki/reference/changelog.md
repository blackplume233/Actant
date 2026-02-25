---
generated: true
---

<!-- GENERATED -->

# Changelog

## v0.2.2 <Badge type="tip" text="当前" />

> 2026-02-24

- **refactor(backend)**：后端转换为 VersionedComponent，新增 BackendManager、Hub 分发、存在性检查
- **refactor**：后端依赖解析从硬编码 map 迁移到 BackendDescriptor.resolvePackage

## v0.2.1

- ACP 协议集成（Direct Bridge + Session Lease）
- CLI 扩展至 68 子命令
- Proxy 和 Chat 完整实现
- Session 管理 API

## v0.2.0

- 雇员调度器（Heartbeat / Cron / Hook）
- 实例注册表（adopt / reconcile）
- ComponentTypeHandler 可扩展架构
- WorkspaceBuilder 重构

## v0.1.3

- 组件版本管理（Semver 引用、SyncReport、Breaking Change 检测）

## v0.1.2

- 组件源系统（GitHub Source / Local Source）
- Preset 预设
- SKILL.md 格式支持

## v0.1.0

- Agent Template 系统
- Domain Context 拼装（5 类组件）
- Agent 生命周期管理
- 权限预设
- 交互式 CLI 基础

---

完整变更日志见仓库中 `docs/stage/v<version>/changelog.md`。
