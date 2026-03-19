---
id: 168
title: "fix(scripts): harden install.ps1 - npm check, pnpm support, stale bin cleanup (#166)"
status: closed
labels: []
milestone: phase-5
author: cursor-agent
assignees: []
relatedIssues:
  - 164
relatedFiles:
  - tools/embedding-sidecar/server.py
  - tools/embedding-sidecar/requirements.txt
taskRef: null
githubRef: "blackplume233/Actant#191"
closedAs: null
createdAt: "2026-02-25T00:00:00"
updatedAt: "2026-02-27T12:28:54"
closedAt: "2026-02-25T02:31:22Z"
---

**Related Issues**: [[0164-agent-memory-embedding]]
**Related Files**: `tools/embedding-sidecar/server.py`, `tools/embedding-sidecar/requirements.txt`

---

## Summary

修复 `scripts/install.ps1` 安装脚本的多项缺陷 (#166):

- **npm 可用性检测**: Node.js 检测后新增 npm 是否在 PATH 中的检查，避免 nvm/fnm 环境下 npm 不可用
- **pnpm 支持**: 新增 `-UsePnpm` 开关，支持通过 pnpm 全局安装
- **Unicode 兼容**: 将 `✓` (U+2713) 替换为 ASCII `[OK]`，兼容旧版 PowerShell 5.1 非 UTF-8 终端
- **GitHub Release 可达性检查**: `Install-FromGitHub` 函数在安装前用 `HEAD` 请求预检 URL
- **卸载清理增强**: 卸载时清理 npm prefix 下可能遗留的 `actant.cmd` stale bin link
- **统一 `$PackageManager` 变量**: 全脚本使用 `& $PackageManager install -g` 而非硬编码 `npm`

## Test plan

- [x] PowerShell syntax validation passes
- [ ] Manual: `.\install.ps1 -NpmRegistry` — fresh install via npm
- [ ] Manual: `.\install.ps1 -UsePnpm` — fresh install via pnpm
- [ ] Manual: `.\install.ps1 -Uninstall` — clean uninstall with stale bin cleanup
- [ ] Manual: Run in non-interactive CI (no Read-Host prompts)
