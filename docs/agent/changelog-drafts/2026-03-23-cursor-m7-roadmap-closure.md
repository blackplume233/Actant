# M7 roadmap closure: root mount semantics clarified

## 变更摘要

- 将 M7.2 的活跃真相源改写为准确语义：用户配置面只声明 `direct mount`，隐式 `root mount` 通过系统投影与 VFS 描述面稳定可见
- 在 namespace 校验层增加 `"/"` 保留规则，禁止把用户声明挂载直接写到 namespace root
- 同步补充配置规范、API 契约和工作目录上下文文档，消除 M7 审查时发现的完成定义歧义

## 用户可见影响

- `actant.namespace.json` 继续只承载用户声明的 direct subpath mounts
- 若用户尝试声明 `path: "/"` 的挂载，校验与加载会返回明确错误，而不是进入与根投影冲突的未定义状态
- `root mount` 仍可通过 `describe("/")`、`describe("/_project.json")` 等路径语义观察

## 破坏性变更/迁移说明

- 无新的用户面破坏性改动
- 本次只是把原本未定义且与现有根投影冲突的 `"/"` 用户挂载显式判定为非法配置

## 验证结果

- 新增 namespace authoring 测试，覆盖用户声明根挂载被拒绝
- 待执行仓库级验证：`pnpm lint`、`pnpm type-check`、`pnpm test`

## 关联 PR / Commit / Issue

- Related review: M7 completion audit after `84fc547`
- Related issue: #278
