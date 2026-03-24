# TODO

> Task: `#322`
> Working view only. Authority remains `docs/planning/contextfs-roadmap.md`.

## Execution Order

- [x] 先串行冻结 `#322` 基线
- [ ] 再串行完成违规路径盘点与包边界决策
- [ ] 在基线冻结后并行推进三条工作流：
  - [ ] Workstream A: 去中心注册结构
  - [ ] Workstream B: 收口 `daemon / plugin / provider / VFS` 契约
  - [ ] Workstream C: 同步活文档与门禁
- [ ] 最后与 `#323` 联动完成历史残留清理与最终验收

## Progress Notes

- [x] Phase 0 baseline freeze 已完成并通过 `ship-sub`
- [x] Draft PR: `#324`
- [x] Merged to `master`: `d4ff12a`
- [x] Full Todo 主题 5 已完成一次 ship
- [x] Branch: `codex/03-24-322-vfs-core-governance`
- [x] Commit: `3120503`
- [x] 当前已完成一轮 VFS core boundary freeze：core terminology、显式 filesystem metadata、lifecycle contract 与 `agent-runtime` 根导出收口已落地
- [x] A4 keep / migrate / delete baseline 已形成：`docs/agent/2026-03-24-cursor-322-a4-domain-context-boundary.md`

## Sync Rule

- [ ] 本文件是 `#322` 的实时执行视图
- [ ] `docs/planning/contextfs-roadmap.md` 中的 `#322` 节是权威清单真相源
- [ ] 后续围绕 `#322` 的任务推进、拆分、状态变更都必须持续回写 roadmap，并保持本文件同步

## Full Todo

### 1. 宿主与运行时口径治理

- [ ] 固化 `daemon` 是唯一运行时宿主
- [ ] 固化 `daemon` 是唯一组合根
- [ ] 固化 `bridge` 只负责通过 RPC 与 `daemon` 交互
- [ ] 固化 `actant` 只是打包层 / 分发层 / 产品壳
- [ ] 删除 `actant app` 作为组合根的旧叙述
- [ ] 删除 bridge 层“自带装配能力”的旧叙述
- [ ] 清理活文档中所有与上述口径冲突的表述

### 2. 模块结构治理

- [ ] 固化简化模块结构图
- [ ] 固化 VFS 内部结构图
- [ ] 明确 `daemon -> daemon plugin -> provider contribution -> VFS` 的装载方向
- [ ] 明确 `bridge -> RPC -> daemon` 的调用方向
- [ ] 明确哪些模块属于 daemon 内部模块
- [ ] 明确哪些模块属于 bridge 层
- [ ] 明确哪些模块属于打包层

### 3. 插件模型治理

- [ ] 定义 `daemon plugin` 是系统唯一有效扩展单元
- [ ] 定义 `daemon plugin` 的最小契约
- [ ] 定义 plugin 生命周期：`activate / deactivate / dispose`
- [ ] 定义 plugin 可贡献能力集合：`provider / rpc / hooks / services`
- [ ] 定义 plugin 元信息模型
- [ ] 定义 plugin 装载位置只能在 `daemon`
- [ ] 禁止 bridge 层直接装载 plugin
- [ ] 禁止 `provider` 继续被当作系统顶层插件模型

### 4. Provider contribution 治理

- [ ] 定义 `provider contribution` 的最小 SPI
- [ ] 明确 `provider` 只是 `daemon plugin` 的子能力
- [ ] 明确 `provider` 只负责向 VFS 注入 mount/backend/数据来源
- [ ] 禁止 `provider` 直接注册领域内容
- [ ] 禁止 `provider` 成为中心注册结构
- [ ] 禁止 `provider` 替代 `daemon plugin`
- [ ] 明确现有来源能力如何迁移为 provider contribution

### 5. VFS 核心治理

- [x] 固化 `@actant/vfs` 是唯一核心
- [x] 固化 `@actant/vfs` 是唯一真相源
- [x] 固化 `@actant/vfs` 内部结构：`facade / kernel / mount / path / node / permission / lifecycle / storage / index / schema / SPI`
- [x] 明确 `kernel` 只负责统一调度
- [x] 明确 `mount / path / node` 是 VFS 核心骨架
- [x] 明确 `permission / lifecycle / storage / index` 是支撑层
- [x] 明确 `provider SPI` 是插件接入面，不是业务注册面
- [x] 禁止 `domain/catalog/manager` 逻辑进入 VFS core
- [x] 定义 `mount / watch / stream / dispose` 生命周期契约
- [x] 定义 runtimefs 建模边界

### 6. `agent-runtime` 定位治理

- [ ] 固化 `agent-runtime` 是 daemon plugin
- [ ] 明确 `agent-runtime` 不是中心层
- [ ] 明确 `agent-runtime` 不是组合根
- [ ] 明确 `domain-context` / `acp` / `pi` 是 `agent-runtime` 依赖
- [ ] 评估是否拆出 `agent-runtime plugin adapter`
- [ ] 明确 `agent-runtime` 可向 VFS 注入哪些 provider contribution
- [ ] 明确 `agent-runtime` 只通过 VFS 读写系统状态

### 7. `domain-context` 治理

- [ ] 列出 `domain-context` keep / migrate / delete 全清单
- [ ] 保留 parser / schema / validator / renderer / resolver
- [ ] 删除 manager-first / registry-first 结构
- [ ] 删除或迁出 watcher 中非 VFS 驱动部分
- [ ] 禁止 `domain-context` 反向生成 VFS
- [ ] 禁止 `domain-context` 成为系统状态中心
- [ ] 明确哪些能力继续作为 `agent-runtime` 依赖保留

### 8. `acp` / `pi` 治理

- [ ] 明确 `acp` 是 `agent-runtime` 依赖还是 daemon plugin contribution
- [ ] 明确 `pi` 是 `agent-runtime` 依赖还是独立 plugin
- [ ] 清理 `acp` / `pi` 在文档中的层级漂移描述
- [ ] 明确它们与 VFS 的依赖关系不能绕过 `agent-runtime` / `daemon`

### 9. 去中心注册结构治理

- [ ] 删除 `CatalogManager` 的中心注册职责
- [ ] 删除 `BaseComponentManager` 中心抽象
- [ ] 删除 `domain-source` 这类 `manager -> VFS` 投影结构
- [ ] 清点所有 `register/unregister` 真相源式调用点
- [ ] 删除所有“内容先进入注册表，再投影回 VFS”的路径
- [ ] 将剩余 manager 降级为索引 / 缓存 / 派生视图
- [ ] 禁止新增任何中心注册结构

### 10. 包层级治理

- [ ] 定义最终保留包清单
- [ ] 定义最终合并包清单
- [ ] 定义最终删除包清单
- [ ] 明确 `@actant/context -> @actant/api` 合并口径
- [ ] 明确 `@actant/catalog` 是拆散为 plugin contribution 还是彻底删除
- [ ] 明确 bridge 包的最终保留清单
- [ ] 明确 daemon-hosted modules 的最终保留清单
- [ ] 明确打包层 `actant` 的最小职责边界

### 11. 历史残留治理

- [ ] 延续 `#323`，删除 `packages/domain`
- [ ] 延续 `#323`，删除 `packages/core`
- [ ] 清理 `dist/` / `tsbuildinfo` 等残留
- [ ] 修正活文档中的 `core/domain` 旧架构描述
- [ ] 审视 `actant` 对外导出的 `./core` 别名是否保留
- [ ] 对历史文档 / issue / 报告统一标记 `legacy` / `archive`

### 12. 文档与术语治理

- [ ] 更新 `.trellis/spec/index.md`
- [ ] 更新 `.trellis/spec/terminology.md`
- [ ] 更新 `.trellis/spec/backend/index.md`
- [ ] 更新 `docs/design/actant-vfs-reference-architecture.md`
- [ ] 统一 `daemon / bridge / daemon plugin / provider contribution` 术语
- [ ] 统一 `domain-context` 的最终定义
- [ ] 统一 `manager/index/cache/view` 的边界定义
- [ ] 增补“禁止中心注册结构”的明确设计约束

### 13. Bridge 层治理

- [ ] 审查 `cli` 是否纯 RPC bridge
- [ ] 审查 `rest-api` 是否纯 RPC bridge
- [ ] 审查 `tui` 是否纯 RPC bridge
- [ ] 审查 `dashboard` 是否只是 bridge 的 UI 外壳
- [ ] 审查 `mcp-server` 是否只是 bridge
- [ ] 审查 `channel-*` 是否只是 bridge / adapter
- [ ] 清理 bridge 层任何自行装载系统的能力

### 14. 验收治理

- [ ] 形成最终模块结构图
- [ ] 形成最终 VFS 内部结构图
- [ ] 形成最终依赖方向图
- [ ] 形成最终保留 / 合并 / 删除包表
- [ ] 验证 `daemon` 是唯一组合根
- [ ] 验证 bridge 只通过 RPC 与 daemon 交互
- [ ] 验证 `provider` 只是 plugin contribution
- [ ] 验证系统内不存在中心注册表真相源
- [ ] 验证所有真实状态最终收敛到 VFS
- [ ] 验证 `domain-context` 只负责解释文件
