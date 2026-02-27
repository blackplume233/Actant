# actant-hub

Actant 官方组件仓库 — 提供平台级 Agent 模板、Skills、Prompts、MCP 配置和 Presets。

## 架构

三层 + 火种（Kernel / Auxiliary / Spark）：

### 内核层（Kernel）— 默认启用

| 模板 | Archetype | 定位 |
|------|-----------|------|
| `actant-steward` | service | 人类唯一入口，替代 CLI |
| `actant-maintainer` | employee | 自修复 + 自进化免疫系统 |
| `actant-curator` | employee | 本地资产管家 — 记忆治理 + 托管资产 + 运行记录 |

### 辅助层（Auxiliary）— 按需启用

| 模板 | Archetype | 定位 |
|------|-----------|------|
| `actant-updater` | employee | 版本升级 + 数据迁移 |
| `actant-scavenger` | employee | 垃圾清理 + 资源回收 |
| `actant-researcher` | service | 信息检索 + 知识采集 |
| `actant-onboarder` | tool | 引导 + 教学 |

### 火种层（Spark）— 仅限贡献者

| 模板 | Archetype | 定位 |
|------|-----------|------|
| `actant-spark` | employee | 自主 fork → 持续编码 → PR 回馈主线 |

## 组件清单

| 类型 | 数量 | 说明 |
|------|------|------|
| Templates | 8 | 内核 3 + 辅助 4 + 火种 1 |
| Skills | 25 | 内核 9 + 辅助 12 + 火种 4 |
| Prompts | 8 | 每个 Template 对应一个 system prompt |
| MCP Servers | 0 | (后续内置，不通过 Hub 分发) |
| Presets | 4 | kernel, full, lite, contributor |

## Presets

| 预设 | 包含模板 | 适用场景 |
|------|---------|---------|
| `actant-kernel` | steward + maintainer + curator | 默认最小完整配置 |
| `actant-full` | 全部 8 个模板 | 全功能配置 |
| `actant-lite` | steward only | 最小入口 |
| `actant-contributor` | kernel + spark | 参与开发的贡献者 |

## 使用

```bash
# 同步 Hub
actant source sync actant-hub

# 安装模板
actant template install actant-hub@actant-steward

# 应用预设
actant preset apply actant-hub@actant-kernel --template my-template

# 创建 Agent
actant agent create my-steward --template actant-hub@actant-steward
```

## 目录结构

```
actant-hub/
├── actant.json              # PackageManifest
├── skills/                  # 25 Skills（JSON + SKILL.md 双格式）
├── prompts/                 # 8 Prompts
├── mcp/                     # 2 MCP Server 配置
├── templates/               # 8 Agent Templates
└── presets/                 # 4 Presets
```

## License

MIT
