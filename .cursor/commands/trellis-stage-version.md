# Stage Version — 版本快照存档

对当前代码库进行版本快照，在 `docs/stage/<version>/` 下生成完整的版本存档。

**输入**: `{{input}}` — 版本号（如 `0.1.0`），留空则从 `package.json` 读取

---

## 执行流程

### Step 0: 质量门禁 [可选]

```bash
bash .trellis/scripts/stage-version.sh pre-check
```

检查项：工作区是否干净、lint、type-check、test:changed。
如果有 ✗ 失败项，建议先修复再 stage。⚠️ 警告项（如 dirty tree）可继续。

### Step 1: 确定版本号

```bash
# 如果用户未提供版本号，从 package.json 读取
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)"
```

将版本号标准化为 `v<major>.<minor>.<patch>` 格式。

如需自增版本号：

```bash
bash .trellis/scripts/stage-version.sh bump patch   # 或 minor / major
```

### Step 2: 初始化 Stage 目录

```bash
bash .trellis/scripts/stage-version.sh init <version>
```

### Step 3: 生成架构文档 [AI]

**这是 AI 生成步骤**，不依赖脚本。

1. 使用工具全面探索代码库，收集以下信息：
   - `packages/` 下所有包的结构和职责
   - 核心模块的类/接口/类型定义
   - 包之间的依赖关系
   - 所有 CLI 命令（从 `packages/cli/src/commands/` 收集）
   - Agent 生命周期和状态流转
   - 配置体系（Template / DomainContext / Schedule）
   - 调度器、构建器、通信器架构
   - 当前版本完成状态（roadmap.md + phase-todo.md + issues）

2. 生成 `docs/stage/<version>/architecture.md`，包含以下章节：
   - 项目概览（Docker 类比）
   - 技术栈
   - Monorepo 结构
   - 包依赖关系图（ASCII）
   - 每个模块的详细架构（子模块、类、职责、流程图）
   - 核心数据流（创建流程、交互流程）
   - Agent 生命周期（状态机、启动模式、工作区策略）
   - CLI 命令全览（所有命令组 + 子命令 + 参数 + 选项表格）
   - 配置体系
   - 内置配置资源
   - 当前版本状态总结（已完成 / 进行中 / 已知限制 / 后续路线）

### Step 4: 生成 API 表面 + 配置结构快照

```bash
bash .trellis/scripts/stage-version.sh snapshot <version>
```

此步骤从源码中精确提取：
- **全部 RPC 方法签名**（从 `RpcMethodMap`）含 Params/Result 类型
- **全部 CLI 命令**（从 `packages/cli/src/commands/`）含参数、选项
- **全部 Zod Schema**（AgentTemplate、InstanceMeta、ScheduleConfig）含字段和类型
- **全部 TypeScript 接口**（Agent、Template、DomainContext、DomainComponent、Source）
- **RPC 错误码**

生成 4 个文件：`api-surface.md` + `.json`、`config-schemas.md` + `.json`。

**审查**：AI 应检查生成结果，确保关键接口无遗漏。如有变更，对比上一版本的 JSON 文件。

### Step 5: 生成代码度量 + 依赖快照

```bash
bash .trellis/scripts/stage-version.sh metrics <version>
```

自动收集每个包的：LOC、文件数、导出符号数、测试文件数、源码体积、依赖树。

### Step 6: 生成 Changelog

```bash
bash .trellis/scripts/stage-version.sh changelog <version>
```

脚本会自动从 git log 和 issue 文件收集变更。生成后**检查并补充**：
- 如果 Conventional Commits 不完整，AI 应从代码变更中推断并补充分类
- 确保重要功能变更都有记录

### Step 7: 运行测试并捕获报告

```bash
bash .trellis/scripts/stage-version.sh test-report <version>
```

运行 `pnpm test` 并将结果（通过/失败/跳过数量、各测试套件状态）保存到 `test-report.json`。

> **Windows 回退**: 如果脚本失败，在 PowerShell 中运行 `npx pnpm test`，然后手动创建 `test-report.json`（参考已有版本的格式）。

### Step 8: 同步 Issue 快照

```bash
bash .trellis/scripts/stage-version.sh sync-issues <version>
```

> **Windows 回退**: `node .trellis/scripts/gen-issue-snapshot.mjs v<version>`（注意：接收版本号而非路径）

### Step 9: 版本间对比（如有上一版本）

如果存在上一个 stage 版本，自动运行 diff：

```bash
bash .trellis/scripts/stage-version.sh diff <prev-version> <version>
```

AI 应审查 diff 报告中的 ⚠️ Breaking Change 标记，确认是否为预期变更。

### Step 10: 创建 Git Tag（需确认）

向用户确认是否创建 git tag：

```bash
bash .trellis/scripts/stage-version.sh tag <version>
```

**手动方式**（PowerShell 安全写法）：
```powershell
git add <staged-files>
# 在 PowerShell 中不要用 heredoc/&&，把多行消息写入临时文件
# 用 Write tool 写入 .git/COMMIT_MSG_TEMP，然后：
git commit -F .git/COMMIT_MSG_TEMP
git tag -a v<version> -m "Release v<version> - <summary>"
git push origin master --tags
```

### Step 11: 创建 GitHub Release（需确认）

向用户确认是否创建 GitHub release：

```bash
bash .trellis/scripts/stage-version.sh release <version>
```

**手动方式**（需要 `gh` CLI）：
```powershell
# 将 release notes 写入临时文件，然后：
gh release create v<version> --title "v<version> - <title>" --notes-file .git/RELEASE_NOTES_TEMP.md
```

### Step 12: 更新 GitHub Pages [可选]

Landing Page 源文件在 `docs/site/`，通过 GitHub Actions workflow (`.github/workflows/deploy-site.yml`) 自动部署到 GitHub Pages。

**更新内容**：

1. 编辑 `docs/site/index.html`：
   - 更新 hero 区域的版本号（如 `v0.1.2`）
   - 更新 Roadmap 区域的 Phase 状态（Done / Active / Planned）
   - 更新 Stats 区域的统计数字（LOC、Tests、RPC methods、CLI commands）
   - 更新 Release Notes 按钮链接
2. 提交并推送到 master
3. GitHub Actions 自动部署（触发条件: `docs/site/**` 变更）

**验证**：

```bash
# 查看 Pages 状态
gh api repos/<owner>/<repo>/pages
# 查看最新部署
gh api repos/<owner>/<repo>/pages/deployments --jq '.[0].status'
```

> **部署架构**：Pages 使用 Actions workflow 模式（非 legacy 模式），通过 `deploy-site.yml` 部署 `docs/site/` 目录内容。不受 GitHub Pages 路径限制（legacy 只支持 `/` 或 `/docs`）。

### Step 13: 验证

```bash
bash .trellis/scripts/stage-version.sh status <version>
```

---

## 产物说明

| 文件 | 生成方式 | 说明 |
|------|---------|------|
| `metadata.json` | 脚本 | 版本元数据（版本号、日期、commit、分支、issue 统计） |
| `architecture.md` | AI | 完整架构文档（模块划分、CLI 全览、数据流、生命周期） |
| `api-surface.md` | 脚本 | 对外接口文档（RPC 方法签名 + CLI 命令 + 错误码） |
| `api-surface.json` | 脚本 | 对外接口机器可读快照（用于版本间 diff） |
| `config-schemas.md` | 脚本 | 配置结构文档（Zod Schema + TypeScript 接口） |
| `config-schemas.json` | 脚本 | 配置结构机器可读快照（用于版本间 diff） |
| `metrics.json` | 脚本 | 代码度量（LOC、文件数、导出数、测试数、体积） |
| `dependencies.json` | 脚本 | 每个包的依赖树快照 |
| `test-report.json` | 脚本 | 测试运行结果（通过/失败/跳过） |
| `changelog.md` | 脚本 | 变更日志（git commits + issue 变更） |
| `issue-snapshot.json` | 脚本 | 该版本时刻的 issue 状态快照 |
| `diff-from-<prev>.md` | 脚本 | 与上一版本的接口/配置变更对比报告 |

---

## 辅助命令

| 命令 | 说明 |
|------|------|
| `stage-version.sh bump <major\|minor\|patch>` | 自增 package.json 版本号 |
| `stage-version.sh unstage <version>` | 删除已存档版本 |
| `stage-version.sh latest` | 查看最新已存档版本摘要 |
| `stage-version.sh list` | 列出所有已存档版本 |

---

## 目录结构

```
docs/stage/
└── v0.1.0/
    ├── metadata.json
    ├── architecture.md
    ├── api-surface.md
    ├── api-surface.json
    ├── config-schemas.md
    ├── config-schemas.json
    ├── metrics.json
    ├── dependencies.json
    ├── test-report.json
    ├── changelog.md
    ├── issue-snapshot.json
    └── diff-from-<prev>.md    (如有上一版本)
```
