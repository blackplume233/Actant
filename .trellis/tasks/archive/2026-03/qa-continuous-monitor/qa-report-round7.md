# QA Round 7 - 构建失败报告

**时间**: 2026-02-25 ~14:05
**HEAD**: 2f4c3e7
**触发**: 新 ship (PR #175: feat: Instance Interaction Archetype + autoStart)

## 结果: BUILD FAIL

构建在 `packages/core` DTS 阶段失败，稳定复现。

### 错误详情

```
packages/core build: src/source/community-source.ts(5,23): error TS2307:
  Cannot find module 'picomatch' or its corresponding type declarations.
```

### 根因分析

`community-source.ts` 在 PR #170 中引入，导入了 `picomatch` 包进行 glob 匹配。
但 `@types/picomatch` 未添加到 `packages/core` 的依赖中，导致 DTS 生成失败。

在 R5/R6 中此文件可能已存在但未暴露（因为 DTS 缓存或者 PR #175 改变了导入路径），
现在合入 PR #175 后构建顺序或类型推断路径变化导致错误显现。

### 修复建议

```bash
cd packages/core && pnpm add -D @types/picomatch
```

或使用 `// @ts-ignore` 跳过类型检查。

## 统计

| 指标 | 值 |
|------|------|
| 构建 | FAIL |
| 测试 | 未执行 |
