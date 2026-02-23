---
id: 127
title: install.ps1 Read-Host hangs in non-interactive terminals
status: open
labels:
  - bug
  - cli
  - "priority:P2"
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#127"
closedAs: null
createdAt: "2026-02-23T12:56:10Z"
updatedAt: "2026-02-23T12:56:42"
closedAt: null
---

## 现象

不带 `-FromGitHub` 参数运行 `install.ps1` 时，脚本进入交互菜单（`Read-Host`），在 CI、自动化工具或非交互终端中永久挂起。

## 复现步骤

1. 在非交互 PowerShell 环境中执行：`& .\scripts\install.ps1 -SkipSetup`
2. 脚本输出安装方式选择菜单后挂起，等待 `Read-Host` 输入

## 期望行为

- 非交互环境中自动选择默认安装方式（npm registry）
- 或提供 `-NpmRegistry` 开关参数直接指定安装方式

## 实际行为

脚本永久挂起在 `Read-Host` 处，无超时机制。

## 方案建议

1. 添加 `-NpmRegistry` / `-Source npm` 参数允许非交互指定安装源
2. 检测 `[Environment]::UserInteractive` 或 `$Host.UI.RawUI` 是否支持交互
3. 非交互环境下默认使用 npm registry 并输出提示

## 相关文件

- `scripts/install.ps1` 第 98-115 行（交互菜单逻辑）
