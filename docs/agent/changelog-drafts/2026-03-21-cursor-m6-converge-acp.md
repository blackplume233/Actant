# M6 ACP VfsInterceptor 收敛到 VfsKernel

## 变更摘要

- 将 ACP `VfsInterceptor` 的数据操作收敛到 `VfsKernel`
- 移除手写的权限检查路径，改由 kernel middleware 链统一处理
- 补充 ACP 收敛后的回归测试

## 用户可见影响

- ACP 侧读写操作与 API / VFS 其他调用面共享同一条权限与中间件执行链
- 后续对 VFS 权限/中间件的修复可以自动覆盖 ACP 路径

## 破坏性变更/迁移说明

- `VfsInterceptor` 的内部依赖改为 `VfsKernel`
- 如果外部调用方直接依赖旧的 registry/handler 直调语义，需要同步到 kernel 语义

## 验证结果

- `packages/acp/src/__tests__/vfs-interceptor.test.ts` 覆盖 ACP 收敛路径
- 相关实现已进入主线 M6 收尾提交

## 关联 PR / Commit / Issue

- PR: pending
- Commit: `8bbd75c`
- Issue: #311
