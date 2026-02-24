---
id: 153
title: "feat(core): 鍚庣 CLI 渚濊禆鑷姩瀹夎 鈥?resolvePackage / install 鑷姩鎵ц"
status: open
labels:
  - feature
  - "priority:P2"
  - core
  - cli
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 150
  - 131
  - 128
relatedFiles:
  - packages/core/src/manager/launcher/builtin-backends.ts
  - packages/core/src/manager/launcher/backend-resolver.ts
  - packages/core/src/manager/launcher/backend-registry.ts
  - packages/shared/src/types/template.types.ts
  - packages/cli/src/commands/agent/start.ts
taskRef: null
githubRef: "blackplume233/Actant#153"
closedAs: null
createdAt: "2026-02-24T14:20:09"
updatedAt: "2026-02-24T14:20:09"
closedAt: null
---

**Related Issues**: [[0150-backend-materialization-plugin-system]], [[0131-pluggable-backend-registry]], [[0128]]
**Related Files**: `packages/core/src/manager/launcher/builtin-backends.ts`, `packages/core/src/manager/launcher/backend-resolver.ts`, `packages/core/src/manager/launcher/backend-registry.ts`, `packages/shared/src/types/template.types.ts`, `packages/cli/src/commands/agent/start.ts`

---

## 目标

当 `agent start` / `agent resolve` / `agent open` 检测到后端 CLI 不在 PATH 上时，自动使用 `BackendDefinition.install` 或 `resolvePackage` 声明的安装方法执行安装，而非仅报错退出。

## 背景

当前 `BackendDefinition` 已具备完整的安装描述能力：

```typescript
// builtin-backends.ts — claude-code 后端
{
  resolvePackage: "@zed-industries/claude-agent-acp",
  install: [
    { type: "npm", package: "@anthropic-ai/claude-code", label: "npm install -g @anthropic-ai/claude-code" },
  ],
}
```

但这些字段目前是**纯信息性的**——`resolvePackage` 仅作为 fallback 路径提示，`install` 仅用于错误信息中展示安装指引。实际执行 `actant agent start` 时，若后端命令缺失，系统抛出 `BackendNotFoundError` 并附带文本提示，用户需手动执行安装命令。

### 痛点

以 `claude-code` 后端为例，用户需要手动安装**两个** npm 包才能正常使用 ACP 模式：

1. `npm install -g @anthropic-ai/claude-code` — 主 CLI（`claude` 命令，existenceCheck 用）
2. `npm install -g @zed-industries/claude-agent-acp` — ACP 适配器二进制（`claude-agent-acp` 命令，resolveCommand 用）

这对新用户来说是不必要的摩擦。既然 `BackendDefinition` 已声明了安装方法，系统应当能自动执行。

## 方案

### 1. `BackendManager.ensureAvailable(backendType)` 方法

新增方法，整合 existence check + auto-install 流程：

```
existenceCheck → 通过 → 返回
                 ↓ 失败
           install 方法匹配当前平台
                 ↓
           用户确认（CLI 交互模式）或自动执行（API/CI 模式）
                 ↓
           执行 npm install -g / brew install / winget install
                 ↓
           re-check existence → 通过 → 返回
                               ↓ 失败
                          抛出详细错误
```

### 2. `resolvePackage` 的 npx-style fallback

对于 `resolvePackage` 字段（如 `@zed-industries/claude-agent-acp`），当命令不在 PATH 时：
- 尝试 `npx -y <resolvePackage>` 临时执行
- 或自动 `npm install -g <resolvePackage>` 永久安装

### 3. CLI 交互层

- `actant agent start` 检测到后端缺失时，显示可用安装方法并询问用户是否自动安装
- `--auto-install` flag 跳过确认直接安装（适用于 CI/脚本场景）
- `--no-install` flag 禁止自动安装（仅报错）

### 4. install 方法执行器

为每种 `BackendInstallMethod.type` 实现执行器：

| type | 执行命令 |
|------|---------|
| `npm` | `npm install -g <package>` |
| `brew` | `brew install <package>` 或 `brew install --cask <package>` |
| `winget` | `winget install <package>` |
| `choco` | `choco install <package>` |
| `url` | 打开浏览器 / 输出下载链接 |
| `manual` | 输出 `instructions` 文本 |

## 验收标准

- [ ] `BackendManager.ensureAvailable()` 方法实现 existence check + auto-install 流程
- [ ] `npm` 类型的 install 方法可自动执行 `npm install -g`
- [ ] `resolvePackage` 缺失时尝试 `npm install -g <package>` fallback
- [ ] CLI `agent start` 在后端缺失时提示用户并支持一键安装
- [ ] 支持 `--auto-install` / `--no-install` flags
- [ ] 安装后自动 re-check 验证安装成功
- [ ] 单元测试覆盖各安装方法的执行逻辑
- [ ] 跨平台测试（win32 + darwin + linux）

## 相关文件

- `packages/core/src/manager/launcher/builtin-backends.ts`
- `packages/core/src/manager/launcher/backend-resolver.ts`
- `packages/core/src/manager/launcher/backend-registry.ts`
- `packages/shared/src/types/template.types.ts`
- `packages/cli/src/commands/agent/start.ts`
