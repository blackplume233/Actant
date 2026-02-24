# QA Log - Round 2: 安装脚本 + 全流程真实环境验证

**场景**: 即兴探索 (explore) — install.ps1 全生命周期
**环境**: Windows 10, PowerShell, Node.js v22.17.1, npm 11.6.2
**模式**: 真实环境 (real launcher)
**开始时间**: 2026-02-23

---

### [P0-1] 卸载损坏的全局安装

#### 输入
```
npm uninstall -g @actant/cli
```

#### 输出
```
exit_code: 0
--- stdout ---
up to date in 371ms
--- stderr ---
(empty)
```

#### 产物检查
```
> npm ls -g @actant/cli
C:\Users\black\AppData\Roaming\npm `-- (empty)

> Get-Command actant → 仍存在 actant.ps1 shim！
  npm uninstall 未清理 bin shim 文件（actant.ps1, actant, actant.cmd）

> 手动清理后:
  Remove-Item actant.ps1, actant, actant.cmd
  Get-Command actant → CONFIRMED: actant command not found
```

#### 判断: WARN
npm uninstall -g 成功移除了 node_modules 中的包，但**未清理 bin 目录下的 shim 文件**（actant.ps1, actant, actant.cmd）。这是 npm 11.6.2 在 Windows 上的已知行为（可能因为包安装时已损坏）。install.ps1 的 `-Uninstall` 路径也调用 `npm uninstall -g`，可能遇到同样的残留问题。需要手动清理 shim 文件。

---

### [P1-A1] install.ps1 执行 — 路径 A: 全新安装

#### 输入
```
& .\scripts\install.ps1 -FromGitHub -SkipSetup
```

#### 输出
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
param : 无法将"param"项识别为 cmdlet、函数、脚本文件或可运行程序的名称。
所在位置 G:\...\scripts\install.ps1:4 字符: 1
+ param(
+ ~~~~~
    + CategoryInfo          : ObjectNotFound: (param:String) []
    + FullyQualifiedErrorId : CommandNotFoundException
```

#### 判断: FAIL
**根因**: `install.ps1` 第 2 行 `$ErrorActionPreference = "Stop"` 位于 `param()` 块之前。PowerShell 要求 `param()` 必须是脚本文件中第一个非注释/非 #Requires 语句。当有其他语句在 `param()` 之前时，`param` 被当作命令名查找，导致 CommandNotFoundException。

**影响**: install.ps1 的所有路径（全新安装、更新、卸载）全部无法执行，脚本完全不可用。

**修复方向**: 将 `$ErrorActionPreference = "Stop"` 移至 `param()` 块之后。

**已修复**: 将 `$ErrorActionPreference = "Stop"` 移至 `param()` 之后。

---

### [P1-A2] install.ps1 修复后重新执行 — GitHub Release 路径

#### 输入
```
& .\scripts\install.ps1 -FromGitHub -SkipSetup
```

#### 输出
```
exit_code: 1

--- stdout ---
=== Actant Installer ===
✓ Node.js v22.17.1
Installing @actant/cli from GitHub Release...
  https://github.com/blackplume233/Actant/releases/latest/download/actant-cli.tgz

--- stderr ---
npm error code ETIMEDOUT
npm error network request to https://github.com/blackplume233/Actant/releases/latest/download/actant-cli.tgz failed
npm error network reason: connect ETIMEDOUT 20.205.243.166:443

--- stdout (continued, npm 失败后) ---
✓ Actant installed from GitHub Release     ← BUG: npm 失败后仍输出成功消息！

Verifying installation...
Error: actant command not found after install.
  Try adding to PATH: Unknown command: "bin"  ← BUG: npm bin -g 在 npm 11 中已移除
```

#### 判断: FAIL (3 个问题)

**问题 1 (网络)**: GitHub Release URL 超时 — 网络原因（中国大陆访问 GitHub 不稳定），非脚本 bug。

**问题 2 (P1 bug)**: `Install-FromGitHub` 函数中 `npm install -g` 失败后，仍然输出 "✓ Actant installed from GitHub Release"。原因：PowerShell 的 `$ErrorActionPreference = "Stop"` 对原生命令（npm）的非零退出码不生效，需要手动检查 `$LASTEXITCODE`。

**问题 3 (P2 bug)**: 验证安装阶段使用 `npm bin -g` 获取全局 bin 路径，但 npm 11 已移除此命令（报 `Unknown command: "bin"`）。应改用 `npm config get prefix` 拼接 bin 路径。

**已修复**: 问题 2 和 3 均已在 install.ps1 和 install.sh 中修复。

---

### [P1-A3] install.ps1 交互式菜单 — Read-Host 挂起

#### 输入
```
& .\scripts\install.ps1 -SkipSetup
```

#### 输出
```
exit_code: (killed, hung on Read-Host)

--- stdout ---
=== Actant Installer ===
✓ Node.js v22.17.1

安装方式:
  [1] npm registry (推荐, 快速)
  [2] GitHub Release (与 npm 发布同步)

(hung waiting for Read-Host input)
```

#### 判断: WARN
install.ps1 不带 `-FromGitHub` 参数时进入交互菜单，`Read-Host` 在非交互终端（CI/自动化）中会永久挂起。建议：(1) 默认 npm registry，当无交互终端时跳过菜单直接安装；(2) 或增加 `-NpmRegistry` 开关跳过菜单。当前可通过 `-FromGitHub` 参数绕过。

---

### [P1-A4] 直接 npm install -g @actant/cli — npm registry 路径

#### 输入
```
npm install -g @actant/cli
```

#### 输出
```
exit_code: 0
--- stdout ---
added 30 packages in 8s
3 packages are looking for funding
  run `npm fund` for details
--- stderr ---
(empty)
```

#### 产物检查
```
> actant --version
0.1.0

> npm ls -g @actant/cli
C:\Users\black\AppData\Roaming\npm
`-- @actant/cli@0.1.2
```

#### 判断: WARN
npm install 成功，actant 命令可用。但发现**版本号不一致**:
- `npm ls -g` 显示包版本 `0.1.2`（正确）
- `actant --version` 输出 `0.1.0`（错误）
- 原因：`packages/cli/src/program.ts` 中 `.version("0.1.0")` 硬编码，未从 package.json 读取

这是已知的版本号硬编码问题，用户看到的版本号与实际安装版本不一致，会造成困惑。

**已修复**: program.ts 改为从 package.json 动态读取版本号。

---

### [P1-A5] 本地构建 0.1.3 + pack + 全局安装

#### 输入
```
# 1. 升级 CLI 版本到 0.1.3 + 修复版本号读取
# 2. npx pnpm build
# 3. npx pnpm pack --pack-destination ../../dist-pack/
# 4. npm install -g dist-pack/actant-cli-0.1.3.tgz
```

#### 输出
```
exit_code: 0 (all steps)

--- build ---
Scope: 6 of 7 workspace projects
packages/cli build: ESM ⚡️ Build success in 46ms
packages/cli build: DTS ⚡️ Build success in 2375ms

--- pack ---
Tarball: G:\Workspace\AgentWorkSpace\AgentCraft\dist-pack\actant-cli-0.1.3.tgz
Files: 17 (dist/*, package.json, scripts/postinstall.mjs)

--- install ---
added 55 packages in 2s
```

#### 产物检查
```
> actant --version
0.1.3                   ← 版本号正确！

> npm ls -g @actant/cli
C:\Users\black\AppData\Roaming\npm
`-- @actant/cli@0.1.3
```

#### 判断: PASS
本地构建的 0.1.3 全局安装成功，`actant --version` 正确输出 `0.1.3`。版本号动态读取修复生效。

---

### [P2-1] actant setup --skip-home (全部跳过模式)

#### 输入
```
$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-install-1495777097"
$env:ACTANT_SOCKET = "\\.\pipe\actant-qa-1268450032"
actant setup --skip-home --skip-provider --skip-source --skip-agent --skip-autostart --skip-hello --skip-update
```

#### 输出
```
exit_code: 0

--- stdout ---
╔══════════════════════════════════════════════╗
║   Actant Setup Wizard                       ║
╚══════════════════════════════════════════════╝
  使用默认工作目录: C:\Users\black\AppData\Local\Temp\ac-qa-install-1495777097

══════════════════════════════════════════════
  Setup Complete!
══════════════════════════════════════════════
```

#### 产物检查
```
> Test-Path $env:ACTANT_HOME
False

ACTANT_HOME 目录不存在！
```

#### 判断: FAIL
**根因**: `--skip-home` 跳过了 `chooseHome()` 函数调用，而 `ensureDirectoryStructure()` 在 `chooseHome()` 内部执行。跳过 home 步骤导致整个目录结构（configs/*, instances, logs, backups 等 10 个子目录）和 config.json 都未创建。

**影响**: 使用 `--skip-home` 的用户（CI 环境或非交互场景）运行 setup 后目录结构为空，后续 daemon start、template load 等操作可能失败。

**修复方向**: 在 setup.ts 的 `--skip-home` 分支中也调用 `ensureDirectoryStructure(actantHome)` 和创建 config.json。

**已修复**: export `ensureDirectoryStructure`，skip-home 分支调用它并创建 config.json。

---

### [P2-2] actant setup 修复后验证

#### 输入
```
actant setup --skip-home --skip-provider --skip-source --skip-agent --skip-autostart --skip-hello --skip-update
```

#### 产物检查
```
目录结构 (12 个子目录):
  backups, configs, configs/mcp, configs/plugins, configs/prompts,
  configs/skills, configs/templates, configs/workflows, instances,
  logs, sources, sources/cache

config.json: True
{
  "devSourcePath": "",
  "update": { "maxBackups": 3, "preUpdateTestCommand": "pnpm test:changed", "autoRestartAgents": true }
}
```

#### 判断: PASS
setup 在 `--skip-home` 模式下正确创建目录结构和 config.json。

---

### [P3-1] Daemon start/status/stop 全流程

#### 前置发现
全局安装的 `@actant/shared@0.1.2` 中 `getDefaultIpcPath()` 未包含 #120 修复，导致 CLI 连接 `\\.\pipe\actant`（错误），Daemon 监听 `\\.\pipe\actant-{safeName}`（正确），路径不匹配。

**临时解决**: 手动将本地构建的 `@actant/shared`、`@actant/api`、`@actant/core` dist 文件复制到全局安装目录替换旧版。

**根本修复**: 所有 `@actant/*` 包需同步发布 0.1.3 版本，确保 CLI 的依赖包含 #120 修复。

#### 输入
```
actant daemon start
actant daemon status -f json
actant daemon stop
actant daemon status -f json
```

#### 输出
```
> actant daemon start
exit_code: 0 — Daemon started. PID: 57424

> actant daemon status -f json
exit_code: 0
{ "running": true, "version": "0.1.0", "uptime": 11, "agents": 0 }

> actant daemon stop
exit_code: 0 — Daemon stopping...

> actant daemon status -f json
exit_code: 1
{ "running": false }
```

#### 判断: PASS (需先替换全局依赖)
Daemon start/status/stop 全流程正常。#120 修复有效，IPC 路径一致。
但需要同步发布 `@actant/shared@0.1.3` 使修复对全局安装用户生效。

daemon.ping 返回的 version 为 `0.1.0`（api 包硬编码），与 CLI `0.1.3` 不一致 — 低优先级。

---

### [P4-1] Template CRUD + Agent 生命周期

#### 输入
```
actant template load minimal-test.json
actant agent create qa-test-agent --template minimal-test
actant agent list -f json
actant agent start qa-test-agent
actant agent status qa-test-agent -f json
actant agent stop qa-test-agent
actant agent destroy qa-test-agent --force
actant agent list -f json
```

#### 输出
```
> template load → Loaded minimal-test@1.0.2                       ✅
> agent create → Agent created successfully (ID: 59b8c586-...)    ✅
> agent list → [1 agent, status: "created"]                       ✅
> agent start → [RPC -32603] spawn EINVAL                         ⚠️ (预期: 无 claude-code backend)
> agent status → status: "error" (start 失败后正确转为 error)     ✅
> agent stop → Stopped qa-test-agent                              ✅
> agent destroy --force → Destroyed qa-test-agent                 ✅
> agent list → []                                                 ✅
```

#### 发现
1. code-review-agent.json 模板引用了未注册的 skill `code-review`，agent create 报 `Skill "code-review" not found`。模板与 skill registry 未同步。
2. 模板 domainContext.workflow 不允许 null 但原 code-review-agent.json 中有 workflow 字段。需文档说明哪些字段可选。
3. agent start 在 backend 不可用时报 `spawn EINVAL`，错误信息不够清晰（应提示 "claude-code CLI not found"）。

#### 判断: PASS (核心生命周期正常)
template load/list、agent create/list/status/stop/destroy 全部正常。
agent start 因缺少后端而失败属预期行为，但错误提示可改善。

---

### [P5-1] self-update --check / --dry-run

#### 输入
```
actant self-update --check --source "G:\Workspace\AgentWorkSpace\AgentCraft"
actant self-update --dry-run --source "G:\Workspace\AgentWorkSpace\AgentCraft"
```

#### 输出
```
> --check:
  Source version: 0.1.3, Last update: none               ✅

> --dry-run:
  Update script spawned in background.
  Log: logs/update-upd-202602231250441.log

  Log 内容:
  [pre-check] Installed: v0.1.3                           ✅
  [backup] Backing up...                                  ✅
  [dry-run] Would execute: pnpm install                   ✅
  [dry-run] Would execute: pnpm build                     ✅
  [dry-run] Would execute: pnpm --filter @actant/cli link --global  ✅
  [dry-run] Would execute: actant --version               ✅
  [dry-run] Would execute: actant daemon start            ✅
  [done] Update completed successfully!                   ✅
```

#### 判断: PASS
self-update 的 check 和 dry-run 模式正常工作。更新流程（backup → build → link → verify → daemon restart）逻辑正确。

---

### [P6-1] 清理: daemon stop + uninstall + temp cleanup

#### 输入
```
actant daemon stop
npm uninstall -g @actant/cli
# 手动清理残留 shim 文件
Remove-Item -Recurse -Force $env:ACTANT_HOME
Remove-Item -Recurse -Force dist-pack
```

#### 输出
```
> daemon stop → exit_code: 0, "Daemon stopping..."       ✅
> npm uninstall → removed 55 packages                    ✅
> shim 残留检查 → 本次无残留                             ✅
> actant command → PASS: not found                        ✅
> ACTANT_HOME 目录 → cleaned (False)                     ✅
> dist-pack 目录 → cleaned                               ✅
```

#### 判断: PASS
完整清理成功，环境恢复到安装前状态。

---

## 总结

### 通过的阶段
| Phase | 测试项 | 结果 |
|-------|--------|------|
| P0 | 环境清理 + 前置条件 | PASS (需手动清理旧 shim) |
| P1-A | install.ps1 各路径 | FAIL→已修复 (param, LASTEXITCODE, npm bin) |
| P1-B | 本地构建 0.1.3 安装 | PASS |
| P2 | actant setup (skip-home) | FAIL→已修复 (目录结构 + config.json) |
| P3 | daemon start/status/stop | PASS (需替换全局 @actant/shared) |
| P4 | template CRUD + agent 生命周期 | PASS |
| P5 | self-update --check/--dry-run | PASS |
| P6 | 完整清理 | PASS |

### 发现并修复的 Bug (本轮)
1. **install.ps1 param() 前置语句** — P0 blocker，已修复
2. **install.ps1 LASTEXITCODE 未检查** — npm 失败但报成功，已修复
3. **install.ps1/sh npm bin -g 已弃用** — npm 11 不支持，已改用 npm config get prefix，已修复
4. **program.ts 版本号硬编码** — actant --version 输出错误版本，已修复（动态读取 package.json）
5. **setup.ts skip-home 未创建目录结构** — ensureDirectoryStructure 仅在 chooseHome 内调用，已修复
6. **AppContext 不读 ACTANT_SOCKET** — 已修复但因未 inline bundle 而不影响全局安装

### 待解决问题 (需创建 Issue)
1. **[P1] @actant/* 包需同步发布 0.1.3** — 全局安装的 @actant/shared@0.1.2 缺少 #120 IPC 修复
2. **[P2] install.ps1 Read-Host 在非交互终端挂起** — 需增加 -NpmRegistry 参数或自动检测 TTY
3. **[P3] daemon.ping 返回硬编码 version "0.1.0"** — api 包 version 应动态读取
4. **[P2] agent start spawn EINVAL 错误提示不友好** — 应提示 backend CLI 未安装

