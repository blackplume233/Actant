---
name: "项目重命名：Actant → Actant"
overview: "将项目从 Actant 全量重命名为 Actant，涵盖代码、配置、文档、文件路径的所有引用"
todos:
  - id: step1-package-json
    content: "P0: 更新所有 package.json 的 name、bin、dependencies 字段"
    status: pending
  - id: step2-source-imports
    content: "P0: 批量替换源码中的 @actant/* import 路径"
    status: pending
  - id: step3-source-identifiers
    content: "P0: 替换源码中的类名(ActantError)、字符串常量、环境变量"
    status: pending
  - id: step4-cli-entry
    content: "P0: 重命名 CLI 入口文件 actant.ts → actant.ts，更新 tsup 配置"
    status: pending
  - id: step5-config-files
    content: "P0: 更新 vitest.config、tsup.config、.claude/settings 等配置文件"
    status: pending
  - id: step6-docs
    content: "P1: 替换所有文档中的品牌名 (docs/, README.md, docs/site/)"
    status: pending
  - id: step7-trellis
    content: "P1: 替换 .trellis/ 目录中的品牌名 (spec, roadmap, workflow, scripts)"
    status: pending
  - id: step8-tooling
    content: "P1: 替换 .cursor/, .agents/, .opencode/ 中的品牌名"
    status: pending
  - id: step9-lockfile-verify
    content: "P0: 重新生成 pnpm-lock.yaml，运行 type-check 和 test 验证"
    status: pending
isProject: false
---

# 项目重命名：Actant → Actant

Issue #38 要求将项目从 **Actant** 全量重命名为 **Actant**（actant.dev）。经过全面代码库扫描，共发现约 820+ 处匹配，分布在 220+ 个文件中。

---

## 一、背景分析

- "Actant" 名称在 AI Agent 领域高度拥挤
- **Actant**（"行动者"）源自叙事学和行动者网络理论，与 Actor Model 同根
- 域名 `actant.dev` 已购买，npm `actant` / `@actant/*` 和 GitHub org 均可用
- 需要一次性完成全量替换，作为**单独一个 commit**

## 二、方案设计

### 重命名映射表

| 原名 | 新名 | 出现场景 |
|------|------|----------|
| `Actant` | `Actant` | 类名、品牌名、文档标题 |
| `actant` | `actant` | 包名、CLI命令、文件路径、socket名 |
| `ACTANT` | `ACTANT` | 环境变量 |
| `@actant/*` | `@actant/*` | npm scope、import 路径 |
| `.actant.json` | `.actant.json` | Agent 实例元数据文件名 |
| `actant.sock` | `actant.sock` | Daemon socket 文件名 |
| `~/.actant/` | `~/.actant/` | 用户数据目录 |
| `ActantError` | `ActantError` | 错误基类 |
| `ActantCore` | `ActantCore` | 模块描述 |
| `ACTANT_HOME` | `ACTANT_HOME` | 环境变量 |
| `ACTANT_SOCKET` | `ACTANT_SOCKET` | 环境变量 |
| `ACTANT_LAUNCHER_MODE` | `ACTANT_LAUNCHER_MODE` | 环境变量 |

### 执行策略

采用**分层批量替换**策略：
1. 先改 package.json（结构化字段手动精确修改）
2. 再批量替换源码（import 路径 → 类名/常量 → 字符串字面量）
3. 重命名物理文件（CLI 入口文件）
4. 更新配置文件
5. 批量替换文档
6. 重新生成 lockfile + 验证

### 风险评估

| 风险 | 缓解措施 |
|------|----------|
| 遗漏某处引用导致编译失败 | `rg -i actant packages/` 验证零残留 |
| pnpm workspace 解析失败 | 重新 `pnpm install` 并验证 |
| 测试期望值包含旧名称 | 同步更新测试文件中的断言 |
| 文件重命名导致 git 追踪丢失 | git mv 保持 rename 记录 |

## 三、实施计划

### Phase 1: 包配置（P0，核心基础）

| # | Task | 文件数 | 说明 |
|---|------|--------|------|
| 1-1 | 更新根 package.json | 1 | name, scripts filter |
| 1-2 | 更新 packages/shared/package.json | 1 | name |
| 1-3 | 更新 packages/core/package.json | 1 | name, deps |
| 1-4 | 更新 packages/cli/package.json | 1 | name, bin, deps |
| 1-5 | 更新 packages/api/package.json | 1 | name, deps |
| 1-6 | 更新 packages/acp/package.json | 1 | name, deps |
| 1-7 | 更新 packages/mcp-server/package.json | 1 | name, deps |

### Phase 2: 源码替换（P0，编译必须）

| # | Task | 预计匹配数 | 说明 |
|---|------|-----------|------|
| 2-1 | import 路径 `@actant/` → `@actant/` | ~80 | 所有包的 import 声明 |
| 2-2 | 类名 `ActantError` → `ActantError` | ~30 | shared/errors 及所有引用 |
| 2-3 | 字符串常量（文件路径、socket名） | ~20 | platform.ts, meta-io 等 |
| 2-4 | 环境变量名 `ACTANT_*` → `ACTANT_*` | ~10 | app-context, program 等 |
| 2-5 | CLI 命令名和用户消息 | ~15 | commands, repl, error-presenter |
| 2-6 | ACP clientInfo 品牌名 | ~5 | connection.ts, gateway.ts |
| 2-7 | 测试文件中的期望值 | ~20 | *.test.ts 同步更新 |

### Phase 3: 文件重命名与配置（P0）

| # | Task | 说明 |
|---|------|------|
| 3-1 | git mv `packages/cli/src/bin/actant.ts` → `actant.ts` | CLI 入口文件 |
| 3-2 | 更新 cli/tsup.config.ts 入口路径 | entry 指向新文件名 |
| 3-3 | 更新 vitest.config.ts 路径别名 | @actant/* → @actant/* |
| 3-4 | 更新 vitest.endurance.config.ts | 同上 |
| 3-5 | 更新 .claude/settings.local.json | 环境变量名 |
| 3-6 | 更新 configs/templates/ 中的 author 字段 | Actant Team |

### Phase 4: 文档替换（P1）

| # | Task | 预计匹配数 | 说明 |
|---|------|-----------|------|
| 4-1 | README.md | ~28 | 项目标题、CLI示例、安装说明 |
| 4-2 | docs/design/*.md | ~100+ | 设计文档 |
| 4-3 | docs/stage/v0.1.0/*.md | ~40 | 版本文档 |
| 4-4 | docs/stage/v0.1.0/*.json | ~22 | 快照数据 |
| 4-5 | docs/reports/*.md | ~18 | 报告文档 |
| 4-6 | docs/site/ (landing page) | ~39 | 官网 |
| 4-7 | docs/README.md | 1 | 文档索引 |

### Phase 5: Trellis 与工具配置替换（P1）

| # | Task | 预计匹配数 | 说明 |
|---|------|-----------|------|
| 5-1 | .trellis/spec/*.md | ~140 | 规范文档 |
| 5-2 | .trellis/roadmap.md | ~19 | 路线图 |
| 5-3 | .trellis/workflow.md | 少量 | 工作流（如有） |
| 5-4 | .trellis/scripts/*.sh, *.mjs | ~10 | 脚本 |
| 5-5 | .trellis/issues/*.json | ~50 | issue body（保留 githubRef 原值） |
| 5-6 | .cursor/ 规则和计划 | ~30 | 规则文件 |
| 5-7 | .agents/ 技能文件 | ~27 | QA/Reviewer skills |
| 5-8 | .opencode/ | ~2 | 命令文件 |

### Phase 6: 验证（P0）

| # | Task | 说明 |
|---|------|------|
| 6-1 | 删除 node_modules 和 pnpm-lock.yaml | 清洁环境 |
| 6-2 | pnpm install | 重新生成 lockfile |
| 6-3 | pnpm type-check | 类型检查无错误 |
| 6-4 | pnpm test:changed | 增量测试通过 |
| 6-5 | `rg -i actant packages/` | 源码零残留验证 |
| 6-6 | `rg -i actant docs/` | 文档零残留验证 |

## 四、影响范围

### 需修改的文件（按模块）

- **packages/shared/** (~10 files): package.json, platform.ts, errors/, types/
- **packages/core/** (~45 files): package.json, 所有 src/ 下的 import
- **packages/cli/** (~20 files): package.json, bin entry, commands, repl
- **packages/api/** (~10 files): package.json, services, handlers, daemon
- **packages/acp/** (~7 files): package.json, connection, gateway, communicator
- **packages/mcp-server/** (~1 file): package.json
- **根目录** (~5 files): package.json, vitest configs, README
- **docs/** (~30 files): 设计文档、版本文档、报告、landing page
- **.trellis/** (~80 files): spec, roadmap, scripts, issues
- **工具配置** (~10 files): .cursor/, .agents/, .claude/, .opencode/

### 需重命名的文件

- `packages/cli/src/bin/actant.ts` → `packages/cli/src/bin/actant.ts`

### 注意：不修改的内容

- `.trellis/issues/*.json` 中的 `githubRef` 字段保留原值（`blackplume233/Actant#XX`）
- `pnpm-lock.yaml` 由 pnpm install 自动重新生成
- `node_modules/` 自动重建
- Git 仓库名（需手动在 GitHub Settings 中重命名）

## 五、验收标准

- [ ] `pnpm install && pnpm build` 成功
- [ ] `pnpm type-check` 无错误
- [ ] `pnpm test` 全部通过
- [ ] `rg -i actant packages/` 返回零结果（代码中无残留）
- [ ] CLI 入口命令从 `actant` 变为 `actant`
- [ ] 文档中 Actant → Actant 全量替换（保留 githubRef）

## 六、相关参考

- Issue: `.trellis/issues/0038-rename-actant-to-actant.json`
- 设计文档: `docs/design/architecture-docker-analogy.md`
- 规范: `.trellis/spec/config-spec.md`, `.trellis/spec/api-contracts.md`
