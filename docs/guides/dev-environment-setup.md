# 开发环境初始化指南

> 面向**人类开发者**和 **AI Agent**，从零搭建 Actant 本地开发环境的一站式文档。
> 如果你只需要使用 Actant（安装已发布版本），请参阅 [Getting Started](getting-started.md)。

---

## 前置条件

| 依赖 | 最低版本 | 检查命令 | 安装方式 |
|------|---------|---------|---------|
| **Node.js** | >= 22.0.0 | `node --version` | [nodejs.org](https://nodejs.org/) 或 `nvm install 22` |
| **pnpm** | >= 9.0.0 | `pnpm --version` | `npm install -g pnpm@9.15.0` |
| **Git** | 任意 | `git --version` | 系统包管理器 |

可选（按需安装）：

| 工具 | 用途 |
|------|------|
| **Claude Code CLI** | 使用 `claude-code` Agent 后端时需要 |
| **Cursor IDE** | 使用 `cursor` Agent 后端时需要 |

---

## 快速初始化（5 步）

```bash
# 1. 克隆仓库
git clone https://github.com/blackplume233/Actant.git
cd Actant

# 2. 安装依赖
pnpm install

# 3. 构建所有包
pnpm build

# 4. 全局安装（可选，使 actant 命令在任意目录可用）
pnpm install:local

# 5. 验证
actant --version   # 应输出 0.2.0（或当前版本）
pnpm test:changed  # 运行受变更影响的测试
```

> **AI Agent 注意**：步骤 4 会执行交互式覆盖提示。使用 `pnpm install:local --force` 跳过提示。

---

## 分步详解

### 步骤 1：克隆仓库

```bash
git clone https://github.com/blackplume233/Actant.git
cd Actant
```

仓库是 pnpm monorepo，工作区配置在 `pnpm-workspace.yaml`：

```
packages/
├── shared/      # @actant/shared     — 公共类型、错误、工具
├── core/        # @actant/core       — 核心引擎
├── pi/          # @actant/pi         — Pi Agent 后端
├── acp/         # @actant/acp        — ACP 协议
├── mcp-server/  # @actant/mcp-server — MCP 协议
├── api/         # @actant/api        — RESTful API / Daemon
├── cli/         # @actant/cli        — CLI 前端
└── actant/      # actant             — 门面包（统一入口）
```

依赖关系：`shared ← core ← {pi, acp, mcp-server, api} ← cli ← actant`

### 步骤 2：安装依赖

```bash
pnpm install
```

pnpm 会自动处理 workspace 内部依赖（`workspace:*`），通过 symlink 链接各子包。

### 步骤 3：构建

```bash
pnpm build          # 按依赖顺序构建所有 8 个包
```

构建工具是 **tsup**（基于 esbuild），输出到各包的 `dist/` 目录。格式为 ESM，附带 sourcemap。

单独构建某个包：

```bash
pnpm --filter @actant/core run build
pnpm --filter @actant/cli run build
```

### 步骤 4：全局安装

提供两种模式，按需选择：

**Link 模式**（默认，推荐日常开发）：

```bash
pnpm install:local              # 构建 + npm link
pnpm install:local --force      # 跳过覆盖确认
pnpm install:local --skip-build # 仅 link（已构建时）
```

通过 `npm link` 从 `packages/actant`（门面包）创建全局 symlink。之后每次 `pnpm build` 都会自动更新全局 `actant` 命令，无需重复 link。

**Standalone 模式**（独立二进制，无需 Node.js 运行时）：

```bash
pnpm install:local:standalone              # 构建 SEA 二进制 + 安装
pnpm install:local:standalone -- --force   # 跳过覆盖确认
```

通过 Node.js SEA（Single Executable Application）将所有代码打包为平台原生可执行文件（Windows `.exe` / macOS / Linux），安装到 npm 全局目录。产物完全自包含，不依赖源码仓库或 Node.js。

自定义安装目录：

```bash
node scripts/install-local.mjs --standalone --install-dir /usr/local/bin
```

| 对比 | Link 模式 | Standalone 模式 |
|------|-----------|----------------|
| 构建速度 | 快（tsup 增量） | 慢（esbuild 全量 + SEA 注入） |
| 产物大小 | symlink | ~85 MB（含 Node.js 运行时） |
| 更新方式 | `pnpm build` 自动生效 | 需重新 `install:local:standalone` |
| 依赖源码仓库 | 是 | 否 |
| 需要 Node.js | 是 | 否 |
| 跨平台分发 | 不适用 | 适用（各平台独立构建） |

### 步骤 5：验证

```bash
actant --version          # CLI 版本
pnpm test:changed         # 增量测试
pnpm type-check           # TypeScript 类型检查
pnpm lint                 # ESLint 检查
```

---

## 常用开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式启动 CLI（tsx 热加载，无需 build） |
| `pnpm build` | 构建所有包 |
| `pnpm test` | 运行全部单元测试 |
| `pnpm test:changed` | 仅运行受变更影响的测试 |
| `pnpm test:watch` | 测试监听模式 |
| `pnpm test:endurance` | 耐久测试（15 分钟超时） |
| `pnpm check` | 类型检查 + 全部测试 |
| `pnpm lint` | ESLint 检查 |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm type-check` | 所有包的 TypeScript 类型检查 |
| `pnpm clean` | 清理所有 `dist/` 产物 |
| `pnpm build:standalone` | 构建平台原生单可执行文件（SEA） |
| `pnpm version:sync` | 同步所有子包版本号到根 `package.json` |
| `pnpm install:local` | 本地构建 + 全局安装（link 模式） |
| `pnpm install:local:standalone` | 构建独立二进制 + 安装到全局 |

---

## 环境变量

开发和测试中可能用到的环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ACTANT_HOME` | `~/.actant` | Actant 数据目录 |
| `ACTANT_SOCKET` | 自动生成 | IPC socket 路径（Daemon 通信） |
| `ACTANT_LAUNCHER_MODE` | `real` | 设为 `mock` 可在无真实后端时测试 |
| `ACTANT_RPC_TIMEOUT_MS` | `10000` | RPC 超时（毫秒） |
| `LOG_LEVEL` | — | 日志级别（debug, info, warn, error） |
| `ANTHROPIC_API_KEY` | — | Anthropic API 密钥（Pi 后端使用） |
| `OPENAI_API_KEY` | — | OpenAI API 密钥 |

---

## 项目配置文件索引

| 文件 | 用途 |
|------|------|
| `package.json` | 根工作区：scripts、engines、devDependencies |
| `pnpm-workspace.yaml` | 工作区包声明（`packages/*`） |
| `tsconfig.base.json` | TypeScript 基础配置（ES2022、strict、bundler resolution） |
| `vitest.config.ts` | 单元测试配置（别名、包含/排除规则） |
| `vitest.endurance.config.ts` | 耐久测试配置（15 分钟超时） |
| `eslint.config.js` | ESLint（no-any、no-console、no-non-null-assertion） |
| `.gitignore` | Git 忽略规则 |

各子包的构建配置位于 `packages/*/tsup.config.ts`。

---

## 常见问题排查

### `pnpm: command not found`

pnpm 未安装或不在 PATH 中：

```bash
npm install -g pnpm@9.15.0
```

如果 `corepack enable` 报权限错误（Windows 常见），使用上面的 npm 方式安装。

### `pnpm link --global` 报 `ERR_PNPM_NO_GLOBAL_BIN_DIR`

pnpm 全局 bin 目录未配置：

```bash
pnpm setup         # 自动创建 PNPM_HOME 并写入环境变量
# 重启终端使环境变量生效，然后重试
pnpm install:local --skip-build
```

### `actant: command not found`（link 成功后）

pnpm 全局 bin 目录不在 PATH 中。检查并添加：

```bash
# 查看 pnpm 全局 bin 位置
pnpm bin -g

# 将输出路径添加到 PATH
# Windows: 通常是 C:\Users\<name>\AppData\Local\pnpm
# Linux/macOS: 通常是 ~/.local/share/pnpm
```

重启终端后生效。

### `ERR_PACKAGE_PATH_NOT_EXPORTED`

如果 `actant` 命令报 `@actant/cli` 子路径导出错误，确保 `packages/cli/package.json` 的 `exports` 中包含：

```json
"./dist/bin/actant.js": "./dist/bin/actant.js"
```

### 构建失败：TypeScript 类型错误

```bash
pnpm clean        # 清理旧产物
pnpm install      # 重新安装依赖
pnpm build        # 重新构建（按依赖顺序）
```

### 测试报告 PID 相关错误

单元测试中使用 `process.pid`（测试进程自身 PID）而非硬编码数字，因为 Agent Manager 会校验 PID 是否存在。

---

## 目录结构速查

```
Actant/
├── packages/              # 源码（8 个包）
├── configs/               # 内置配置（模板、技能、提示词、工作流、插件、MCP）
├── scripts/               # 构建和安装脚本
├── docs/                  # 文档
│   ├── guides/            # 使用指南（本文件所在目录）
│   ├── design/            # 功能设计文档
│   ├── decisions/         # 架构决策记录（ADR）
│   ├── planning/          # Roadmap 与阶段计划
│   └── stage/             # 版本快照
├── .trellis/              # Trellis 开发框架
│   ├── spec/              # 规范文档（核心参考）
│   ├── workflow.md        # 开发流程
│   ├── issues/            # GitHub Issue 本地缓存
│   └── workspace/         # 开发者工作区
├── .agents/skills/        # Agent 技能定义
├── tsconfig.base.json     # TypeScript 配置
├── vitest.config.ts       # 测试配置
├── eslint.config.js       # Lint 配置
└── package.json           # 根工作区
```

---

## 下一步

- 阅读 [AI Agent 开发手册](ai-agent-dev-guide.md) 了解源码架构和常见开发任务
- 阅读 [后端开发指南](../../.trellis/spec/backend/index.md) 了解模块架构和开发原则
- 阅读 [质量规范](../../.trellis/spec/backend/quality-guidelines.md) 了解编码标准和测试要求
- AI Agent 首次开始工作前，运行 `/trellis:start` 初始化开发者身份和上下文
