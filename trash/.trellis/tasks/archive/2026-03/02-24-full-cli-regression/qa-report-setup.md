# Setup Wizard 预设脚本测试报告

**日期**: 2026-02-24  
**范围**: `actant setup` 命令非交互式/预设脚本测试  
**环境**: Windows 10, 全局链接 actant@0.2.0, 隔离临时 ACTANT_HOME

## 测试结果总览

| Step ID | 描述 | 结果 |
|---------|------|------|
| p1s-setup-all-skip | 全跳过模式（7 个 `--skip-*` 全开） | **PASS** |
| p1s-setup-verify-dirs | 白盒验证 setup 创建的目录结构 | **PASS** |
| p1s-setup-skip-partial (3a) | 非 TTY 下 source 步骤优雅取消 | **WARN** |
| p1s-setup-skip-partial (3b) | 全跳过幂等性重跑 | **PASS** |
| p1s-setup-skip-home-env | `--skip-home` 使用 `ACTANT_HOME` 环境变量 | **PASS** |
| p1s-setup-config-structure | 验证生成的 `config.json` 结构 | **PASS** |

**通过率**: 5/6 PASS, 1/6 WARN = **83% PASS, 100% 无 FAIL**

## 详细分析

### PASS 项

1. **p1s-setup-all-skip**: 所有步骤跳过时，setup 正确输出 banner → "使用默认工作目录" → "Setup Complete!" 摘要。
   - `config.json` 被创建
   - 10 个子目录全部被创建 (configs/skills, configs/prompts, configs/mcp, configs/workflows, configs/plugins, configs/templates, instances, sources/cache, logs, backups)

2. **p1s-setup-verify-dirs**: `template list -f json` 成功执行，确认 setup 创建的目录结构可被 daemon 正常使用。

3. **p1s-setup-skip-partial (3b)**: 重复运行全跳过 setup 不产生错误，证明 setup 具有幂等性。

4. **p1s-setup-skip-home-env**: `--skip-home` 正确读取 `$ACTANT_HOME` 环境变量（临时测试路径），未使用默认的 `~/.actant`。

5. **p1s-setup-config-structure**: 生成的 `config.json` 包含完整结构：
   ```json
   {
     "devSourcePath": "",
     "update": {
       "maxBackups": 3,
       "preUpdateTestCommand": "pnpm test:changed",
       "autoRestartAgents": true
     }
   }
   ```

### WARN 项

6. **p1s-setup-skip-partial (3a)**: 不跳过 source 步骤但无 TTY 输入时：
   - `@inquirer/prompts` 的 `confirm` 提示挂起（等待 stdin）
   - 进程 15 秒后被强制终止
   - 终止前输出了 "已取消设置向导"（说明 `isUserCancellation` 处理逻辑正确）
   - **根因**: `@inquirer/prompts` 在非 TTY 环境下不会立即抛出 `ExitPromptError`，需等待 stdin 关闭 / 进程信号
   - **建议**: 非阻塞性问题，可考虑添加 `CI=true` / `--non-interactive` 标志以在非 TTY 下自动跳过交互步骤

## 场景文件更新

`full-cli-regression.json` 已新增 5 个 setup 测试步骤：
- `p1s-setup-all-skip`
- `p1s-setup-verify-dirs`
- `p1s-setup-skip-partial`
- `p1s-setup-skip-home-env`
- `p1s-setup-config-structure`

总步骤数从 86 → 91。
