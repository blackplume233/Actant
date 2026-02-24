# QA Report — Hub Agent 生命周期验证 (Final)

**日期**: 2026-02-24
**范围**: explore — 下载 hub agent → 初始化 → 交互 → 执行任务 → 删除
**环境**: Windows 10, real mode (no mock), 隔离 ACTANT_HOME
**总轮次**: 3

## 摘要

| 步骤 | 描述 | R1 | R2 | R3 |
|------|------|----|----|-----|
| S1 | source sync + template/skill list | PASS | PASS | PASS |
| S2 | agent create (3 hub templates) | **FAIL** | PASS | PASS |
| S3 | workspace 产物 + apiKey 安全 | — | PASS | — |
| S4 | agent run (one-shot 交互) | — | PASS | — |
| S5 | agent start (ACP) | — | WARN | **PASS** |
| S6 | agent dispatch | — | WARN | **PASS** |
| S7 | agent destroy (3 agents) | — | PASS | PASS |
| S8 | destroy 不存在的 agent | — | WARN | **PASS** |
| S9 | 错误处理（不存在模板/重名） | — | PASS | — |

## 通过率趋势

| 轮次 | PASS | WARN | FAIL | 单元测试 |
|------|------|------|------|---------|
| R1 | 2/3 | 0 | **1** | — |
| R2 | 7/11 | **3** | 0 | 632/632 |
| R3 | 6/6 | **0** | 0 | 632/632 |

## 修复的 Issue

| Issue | 标题 | 修复文件 |
|-------|------|---------|
| [#142](https://github.com/blackplume233/Actant/issues/142) | Source sync: domainContext refs not namespaced | `packages/core/src/source/source-manager.ts` |

## 修复的 WARN 项

| # | 问题 | 修复 | 文件 |
|---|------|------|------|
| W1 | `agent start` → spawn EINVAL，错误码 -32603 | 包装为 AgentLaunchError (-32008)，提示安装后端 CLI | `packages/core/src/manager/agent-manager.ts` |
| W2 | `agent dispatch` 无 scheduler，无替代建议 | 添加 Hint 提示使用 `agent run` | `packages/cli/src/commands/agent/dispatch.ts` |
| W3 | `agent destroy` 不存在的 agent 返回 exit_code 0 | 添加存在性检查，抛出 AgentNotFoundError | `packages/core/src/manager/agent-manager.ts` |

## 结论

**最终结果: PASS (100%)**

所有 3 轮测试中发现的 1 个 P1 bug (#142) 和 3 个 WARN 全部修复并通过回归验证。
核心生命周期流程（下载 → 初始化 → 交互 → 删除）和错误处理全部正常。
