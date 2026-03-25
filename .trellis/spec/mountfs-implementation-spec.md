# MountFS 实现规范

> Status: Active Spec
> Scope: `@actant/mountfs-*` 包的稳定实现契约
> Authority: 本文件高于设计文档；mountfs 实现、审查、迁移与包创建必须以此为准

---

## 1. Role

`mountfs` 是单一挂载类型的独立实现边界。

它的唯一目标是：

- 以稳定 SPI 产出某一类 `mount instance`
- 把该挂载的 `file schema`、`handlers`、`metadata`、`features` 与 backend 适配封装起来

它不是：

- `VFS kernel`
- `mount namespace`
- `mount table`
- 全局 middleware / permission / lifecycle 中心
- 新的中心注册表

---

## 2. Required Output Contract

每个 `mountfs` 实现最终必须能产出一个可被 `FilesystemTypeRegistry` 接纳的稳定 contract。

最小输出面固定为：

1. `registration builder`
2. `metadata`
3. `file schema`
4. `handlers`
5. 可选 `validate(config)`
6. 可选 runtime/provider adapter

当前代码层的权威接口名为：

- `FilesystemTypeDefinition<TConfig>`
- `MountfsDefinition<TConfig>`
- `VfsMountRegistration`
- `VfsFileSchemaMap`
- `VfsHandlerMap`
- `RuntimefsProviderContribution<...>`

说明：

- `FilesystemTypeDefinition` 是 wire-level 类型名，因兼容保留
- 新实现、新文档、新审查叙述应优先使用 `mountfs`、`mountfs definition`、`mount registration`

---

## 3. Package Boundary

每个具体挂载类型都必须实现为单独包：

- 包名格式：`@actant/mountfs-*`
- 一个包只对应一种挂载类型或紧密 family
- 不允许把多个无关挂载类型重新聚合成新的中心平台层

每个包至少应包含：

- `package.json`
- `tsconfig.json`
- `src/index.ts`

`src/index.ts` 应是该包唯一稳定入口。

不允许：

- 从 `packages/vfs/src/sources/*` 继续新增实现
- 让 `api` / `agent-runtime` 直接依赖 `sources` 目录里的新代码
- 把测试专用 helper 混成长期 public API

---

## 4. Naming Rules

新增 mountfs 实现必须遵守以下命名规则：

- 主术语使用 `mountfs`
- 实例术语使用 `mount instance` / `mount registration`
- 注册构造使用 `definition` / `builder` / `create*Mountfs` / `create*Registration`
- 不再新增 `Source`、`SourceType`、`provider contribution` 作为主命名

迁移期兼容例外：

- 现有 `*Source*` 导出允许短期保留
- 但新代码不得继续扩散该命名

---

## 5. Required Registration Shape

每个 mountfs 产出的 registration 必须完整填写：

- `name`
- `mountPoint`
- `label`
- `features`
- `lifecycle`
- `metadata`
- `fileSchema`
- `handlers`

要求如下：

### 5.1 `name`

- 必须是稳定 mount 名
- 不允许留空进入长期装配路径
- 测试中可临时赋值，但实际装配应在创建时明确

### 5.2 `mountPoint`

- 必须是该 mount 实际声明的挂载点
- 不允许在 mountfs 内部自行发明 namespace 规则

### 5.3 `label`

- 应稳定对应挂载族名称
- 用于 describe / debug / registry surfaces

### 5.4 `features`

- 必须与实际行为一致
- 不允许声明互斥 trait 组合：`persistent` 与 `ephemeral`
- 不允许为“未来可能支持”的能力预留虚假 feature

### 5.5 `metadata`

最少应提供：

- `description`
- `filesystemType`
- `mountType`

如适用再提供：

- `virtual`
- `owner`
- `readOnly`

不允许：

- 把业务解释对象塞进 metadata 作为第二套真相源
- 让 metadata 成为 capability 判定替代物

### 5.6 `fileSchema`

`fileSchema` 是 mountfs 的公开节点合同，不是可有可无的注释层。

要求：

- 对稳定暴露节点显式声明 schema
- schema 里的 `type`、`mimeType`、`capabilities` 必须与 handlers 一致
- runtime/dynamic 节点必须标明 `dynamic: true`
- 目录节点必须声明为 `directory`
- control 节点必须声明为 `control`
- stream 节点必须声明为 `stream`

### 5.7 `handlers`

`handlers` 只实现真实支持的 capability。

要求：

- 不支持的 capability 不要伪造空实现
- 返回值 shape 必须满足 shared contract
- 错误语义必须稳定，可被 API/bridge 正常包装
- 路径参数以 mount-relative path 解释，不得在 mountfs 内重复做全局 namespace 解析

---

## 6. Config Contract

每个 mountfs 包都应导出自己的 `TConfig` 类型。

要求：

- config 必须只描述该挂载自身实例化所需参数
- 不得混入 namespace、permission、global registry 等系统级配置
- 若配置存在合法性边界，应提供 `validate(config)`

`validate(config)` 规则：

- 只校验该 mountfs 自身的局部 contract
- 不重复实现 `VFS kernel` 级别的全局校验
- 错误信息应可直接用于 CLI/API 返回

---

## 7. RuntimeFS Family Rules

`runtimefs` family 的 mountfs 实现允许额外暴露 provider adapter，但边界必须固定。

允许：

- `RuntimefsProviderContribution<...>` 这类 provider contract
- 运行时记录、流、watch 事件与 control 请求的局部适配

不允许：

- provider 直接持有 `mount namespace`
- provider 直接创建或管理 kernel
- provider 成为新的 runtime state 真相源之外的第三中心

runtimefs mountfs 必须保证：

- `filesystemType` 恒为 `runtimefs`
- provider `mountPoint` 与 mount registration 的 `mountPoint` 一致
- `control` / `stream` / `status` 节点语义稳定

---

## 8. Layer Ownership

实现责任划分固定如下：

`@actant/vfs` 负责：

- registry
- kernel
- mount resolution
- permission middleware
- lifecycle manager
- stable SPI

`@actant/mountfs-*` 负责：

- mount-specific config
- mount-specific schema
- mount-specific handlers
- mount-specific backend adapter

`@actant/api` / `@actant/agent-runtime` 负责：

- 注册 mountfs definition
- 组合 provider contribution
- 选择 mountPoint / lifecycle / metadata 注入

不允许把以下逻辑回流到 mountfs：

- 全局 permission policy
- 全局 mount collision policy
- 全局 namespace projection
- 跨挂载类型调度中心

---

## 9. Implementation Checklist

新增或迁移一个 mountfs 包时，至少要满足：

- 包边界独立存在于 `packages/mountfs-*`
- `src/index.ts` 提供稳定入口
- 导出 config 类型
- 导出 mountfs definition 或 registration builder
- `fileSchema` 与 `handlers` 一致
- `metadata.filesystemType` 与实际 family 一致
- focused tests 覆盖 read/write/list/stat 等最小能力面
- `@actant/vfs` 不新增具体实现代码，只做稳定 re-export 时要注明迁移期性质

---

## 10. Review Gate

任何 mountfs 相关 PR，审查时必须逐项回答：

1. 这个实现属于哪个单一挂载类型？
2. 它是否落在独立 `@actant/mountfs-*` 包里？
3. 它输出的是不是完整 `VfsMountRegistration` contract？
4. `fileSchema` 与 `handlers` 是否一致？
5. `features` 是否与真实行为一致且无互斥冲突？
6. 它是否把全局 namespace / permission / lifecycle 逻辑错误地下沉进 mountfs？
7. 它是否引入了新的 `Source` 主术语或旧模型回流？

任何一项回答为“否”或“边界不清”，都不应通过。

---

## 11. Migration Rule

从旧 `sources/*` 迁移时固定按以下顺序：

1. 先建立 mountfs 包和稳定入口
2. 再迁实现与 focused tests
3. 再切换 `api` / `agent-runtime` 装配
4. 最后删除旧 `sources/*` 文件与兼容导出

不允许：

- 没有新包就直接删除旧实现
- 同一轮同时重写术语、语义、行为而不保兼容
- 让迁移期的兼容出口成为长期事实
