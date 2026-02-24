# QA Report — Hub Agent 生命周期验证

**日期**: 2026-02-24
**范围**: explore — 下载 hub agent → 初始化 → 交互 → 执行任务 → 删除
**环境**: Windows 10, real mode (no mock), 隔离 ACTANT_HOME

## 摘要

| 步骤 | 描述 | R1 | R2 |
|------|------|----|----|
| S1 | source list | PASS | PASS |
| S2 | source sync + template list | PASS | PASS |
| S3 | agent create (3 hub templates) | **FAIL** | **PASS** |
| S4 | workspace 产物 + apiKey 安全 | - | PASS |
| S5 | agent run (one-shot 交互) | - | PASS |
| S6 | agent start (ACP) | - | WARN |
| S7 | agent dispatch | - | WARN |
| S8 | agent destroy (3 agents) | - | PASS |
| S9 | destroy 不存在的 agent | - | WARN |
| S10 | 不存在的模板错误处理 | - | PASS |
| S11 | 重名 agent 检测 | - | PASS |

## 通过率

| 轮次 | PASS | WARN | FAIL | 单元测试 |
|------|------|------|------|---------|
| R1 | 2/3 | 0 | **1** | - |
| R2 | 7/11 | 3 | **0** | 632/632 |

## 发现的 Issue

### #142 (P1 bug — 已修复) Source sync: domainContext refs not namespaced
- **症状**: `agent create` with hub template 报错 `Skill "code-review" not found in registry`
- **根因**: `source-manager.ts:injectComponents()` 给 template.name 加了 `packageName@` 前缀，但没有更新 template.domainContext 中的组件引用
- **修复**: 在注册模板时同时给 domainContext.skills/prompts/subAgents/workflow 引用加前缀
- **修复文件**: `packages/core/src/source/source-manager.ts`
- **验证**: R2 全部 3 个 hub 模板 agent 创建成功

### WARN 项（非阻塞，建议改进）

| # | 问题 | 建议 |
|---|------|------|
| W1 | `agent start` → `spawn EINVAL`（claude-agent-acp 未安装） | 改进错误消息：检测到 backend 二进制不存在时，提示用户安装 Claude Code SDK |
| W2 | `agent dispatch` → `No scheduler`（direct mode） | 改进提示："Agent launch-mode 为 direct，不支持 dispatch。请使用 `agent run` 或更改 launch-mode" |
| W3 | `agent destroy nonexistent-agent` → exit_code 0 | 不存在的 agent 应返回 exit_code 1 或至少输出 "Agent not found" 警告 |

## 安全验证

- 所有 agent workspace（.actant.json, AGENTS.md, CLAUDE.md, prompts/, .claude/）中 **无 apiKey 泄露**
- providerConfig 仅含 `{ type, protocol }` 无密钥

## 结论

**最终结果: PASS**

核心生命周期流程（下载 → 初始化 → 交互 → 删除）在修复 #142 后全部通过。3 个 WARN 均为非阻塞的改进项（错误消息优化）。
