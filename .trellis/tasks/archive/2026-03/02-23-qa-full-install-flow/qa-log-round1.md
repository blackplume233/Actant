# QA Log - Round 1: 安装/交互/Agent/更新/卸载 全流程验证

**场景**: 即兴探索 (explore)
**环境**: Windows 10, real launcher mode
**ACTANT_HOME**: `C:\Users\black\AppData\Local\Temp\ac-qa-install-1431799917`
**ACTANT_SOCKET**: `\\.\pipe\actant-qa-345332608`
**开始时间**: 2026-02-23

---

### [T1] 安装脚本结构审查

#### install.sh 审查

| 检查项 | 结果 |
|--------|------|
| `GITHUB_RELEASE_URL` 正确 | PASS — `https://github.com/blackplume233/Actant/releases/latest/download/actant-cli.tgz` |
| Node.js >= 22 检查 | PASS — L35-39 正确解析和比较版本 |
| `install_from_github()` 使用 npm | PASS — L58-63 仅调用 `npm install -g "$GITHUB_RELEASE_URL"` |
| 无 `ensure_pnpm` 函数 | PASS — grep 搜索确认不存在 |
| 无 `--clone-dir` 参数 | PASS — L17-23 参数列表仅 `--skip-setup / --uninstall / --from-github` |
| 菜单文案更新 | PASS — L71 "npm registry" / L72 "GitHub Release" / L144 "GitHub Release" |
| `--uninstall` 非交互路径 | PASS — L43-55 完整: daemon stop → systemd/launchd 清理 → npm uninstall |

#### install.ps1 审查

| 检查项 | 结果 |
|--------|------|
| `$GitHubReleaseUrl` 正确 | PASS — L10 同一 URL |
| Node.js >= 22 检查 | PASS — L16-28 正确 |
| `Install-FromGitHub` 使用 npm | PASS — L43-48 仅调用 `npm install -g $GitHubReleaseUrl` |
| 无 `Ensure-Pnpm` 函数 | PASS — grep 搜索确认不存在 |
| 无 `$CloneDir` / `$DefaultCloneDir` | PASS — L4-8 参数仅 `$SkipSetup / $Uninstall / $FromGitHub` |
| 菜单文案更新 | PASS — L59 "npm registry" / L60 "GitHub Release" |
| `-Uninstall` 非交互路径 | PASS — L31-40 完整: daemon stop → schtasks 清理 → npm uninstall |

#### 判断: PASS
两个安装脚本结构完整，已彻底去除 git clone / pnpm 依赖，GitHub 安装统一使用 `npm install -g` tarball URL。

---

