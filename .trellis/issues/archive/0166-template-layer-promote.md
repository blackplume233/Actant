---
id: 166
title: "fix: install.ps1 瀹夎鑴氭湰瀛樺湪澶氶」缂洪櫡闇€淇"
status: closed
labels:
  - bug
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 11
  - 165
  - 167
  - 169
relatedFiles:
  - packages/actant-memory/src/layers/template-layer.ts
  - packages/actant-memory/src/lifecycle/promoter.ts
taskRef: null
githubRef: "blackplume233/Actant#189"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:51"
closedAt: "2026-02-25T02:31:32Z"
---

**Related Issues**: [[0011]], [[0165-memory-plugin-instance-layer]], [[0167-template-memory-sharing]], [[0169-actant-layer-curator-agent]]
**Related Files**: `packages/actant-memory/src/layers/template-layer.ts`, `packages/actant-memory/src/lifecycle/promoter.ts`

---

## 描述

`scripts/install.ps1` 安装脚本存在多项需要修复的问题，影响用户首次安装和升级体验。

## 问题清单

### 1. GitHub Release URL 硬编码且可能过期
- **位置**: L9
- `$GitHubReleaseUrl` 硬编码为 `https://github.com/blackplume233/Actant/releases/latest/download/actant-cli.tgz`
- 如果仓库名称/组织变更，URL 将失效
- 建议：从 `package.json` 或 git remote 动态获取，或至少加入 URL 可达性检测

### 2. 未检测 npm 是否可用
- 脚本检测了 Node.js 但未检测 `npm` 是否在 PATH 中
- 如果用户使用 nvm/fnm 等版本管理器且未正确配置，`npm` 可能不可用

### 3. Unicode 字符兼容性
- 脚本使用 `✓` (U+2713) 等 Unicode 字符
- 在非 UTF-8 编码的旧版 PowerShell 5.1 终端中可能显示为乱码
- 建议：检测终端编码，或改用 ASCII 字符 `[OK]` / `[√]`

### 4. 卸载流程缺少 npm prefix 清理
- 卸载时仅调用 `npm uninstall -g`，但未清理可能遗留的全局 bin 链接
- Windows 上 npm 全局卸载有时不完整

### 5. 缺少 pnpm 安装选项
- 项目本身使用 pnpm 作为包管理器，但安装脚本只提供 npm 方式
- 可考虑增加 pnpm 全局安装选项

## 影响

- 新用户首次安装可能遇到意外失败
- 升级/卸载流程不够健壮

## 建议修复方案

1. 增加 npm 可用性检测
2. GitHub URL 增加可达性检查（`Invoke-WebRequest -Method Head`）
3. 终端编码检测与 fallback 字符
4. 增强卸载清理逻辑
5. 可选：支持 pnpm 安装路径

## 相关文件

- `scripts/install.ps1`
