# QA Alpha — 持久化 QA 调试环境

读取 `.agents/skills/qa-engineer/SKILL.md` 理解 QA 测试方法论（黑盒为主、白盒为辅、智能判断、Issue 追踪），然后按照下方流程在**持久化环境**中执行 QA。

与标准 `/qa` 的核心区别：环境不销毁、跨会话复用、仅在代码更新时重启。

---

## 指令格式

`/qa-alpha <mode> [args]`

| 模式 | 示例 | 行为 |
|------|------|------|
| **run** | `/qa-alpha run basic-lifecycle` | 在持久环境中执行场景 |
| **explore** | `/qa-alpha explore "并发创建 5 Agent"` | 在持久环境中即兴探索 |
| **status** | `/qa-alpha status` | 检查环境是否存活 |
| **restart** | `/qa-alpha restart` | 重建并重启环境（代码更新后） |
| **stop** | `/qa-alpha stop` | 手动停止环境（极少使用） |
| **create** | `/qa-alpha create "测试模板热重载"` | 生成场景文件并在持久环境中执行 |
| **list** | `/qa-alpha list` | 列出所有场景 |

省略模式关键词时视为 **explore**。

---

## 持久化环境

### 目录结构

```
.trellis/qa-alpha/
├── env-state.json        # 环境状态（daemon PID, socket, build hash 等）
├── home/                 # ACTANT_HOME（持久化，不删除）
│   ├── configs/
│   ├── agents/
│   └── ...
├── logs/                 # QA 日志（按 round 编号）
│   ├── qa-log-round1.md
│   ├── qa-report-round1.md
│   └── ...
└── templates-loaded.json # 已加载模板的记录
```

### env-state.json 格式

```json
{
  "status": "running" | "stopped" | "unknown",
  "daemonPid": 12345,
  "socketPath": "<platform-specific>",
  "homePath": "<absolute path to .trellis/qa-alpha/home>",
  "buildHash": "<最近一次 build 的 git commit hash>",
  "buildTimestamp": "<ISO datetime>",
  "startedAt": "<ISO datetime>",
  "roundCounter": 3,
  "platform": "win32" | "linux" | "darwin",
  "templatesLoaded": ["rw-basic-tpl", "rw-claude-tpl"]
}
```

---

## 执行流程

### Phase 0: 环境检查与恢复

**每次执行都必须先运行此步骤**。

#### Step 0.1: 读取环境状态

```bash
cat .trellis/qa-alpha/env-state.json
```

- 若文件不存在 → 进入「Phase 1: 首次初始化」
- 若文件存在 → 继续 Step 0.2

#### Step 0.2: 验证 Daemon 存活

使用 env-state.json 中记录的环境变量执行：

```bash
# Windows
$env:ACTANT_HOME="<homePath>"; $env:ACTANT_SOCKET="<socketPath>"; node packages/cli/dist/bin/actant.js daemon status -f json

# Unix
ACTANT_HOME="<homePath>" ACTANT_SOCKET="<socketPath>" node packages/cli/dist/bin/actant.js daemon status -f json
```

- 成功且 `running: true` → 环境存活，直接进入测试执行
- 失败或不可达 → 检查 Daemon PID 是否还活着：
  - PID 存活但不响应 → 杀死并重启
  - PID 不存活 → 标记为 stopped，重启 Daemon

#### Step 0.3: 检查代码是否需要重建

```bash
git rev-parse HEAD
```

对比 env-state.json 中的 `buildHash`：
- 相同 → 无需重建，环境就绪
- 不同 → 执行 `pnpm build`，更新 `buildHash` 和 `buildTimestamp`，然后 **restart Daemon**（因为代码变了）

---

### Phase 1: 首次初始化（仅首次）

#### Step 1.1: 创建目录

```bash
mkdir -p .trellis/qa-alpha/home
mkdir -p .trellis/qa-alpha/logs
```

#### Step 1.2: 构建项目

```bash
# 检查 CLI 是否已构建
ls packages/cli/dist/bin/actant.js 2>/dev/null || pnpm build
```

#### Step 1.3: 确定 Socket 路径

```
# Windows
\\.\pipe\actant-qa-alpha

# Unix
.trellis/qa-alpha/home/actant.sock
```

#### Step 1.4: 启动 Daemon（后台常驻）

```bash
# Windows
$env:ACTANT_HOME=".trellis/qa-alpha/home"; $env:ACTANT_SOCKET="\\.\pipe\actant-qa-alpha"; Start-Process -NoNewWindow node -ArgumentList "packages/cli/dist/bin/actant.js","daemon","start","--foreground"

# Unix
ACTANT_HOME=".trellis/qa-alpha/home" ACTANT_SOCKET=".trellis/qa-alpha/home/actant.sock" \
  node packages/cli/dist/bin/actant.js daemon start --foreground &
```

记录 PID，轮询 `daemon status` 直到就绪。

#### Step 1.5: 加载测试模板

写入临时 JSON 文件并加载：

```json
{ "name": "rw-basic-tpl", "version": "1.0.0", "backend": { "type": "cursor" }, "provider": { "type": "anthropic" }, "domainContext": {} }
```

```json
{ "name": "rw-claude-tpl", "version": "1.0.0", "backend": { "type": "claude-code", "config": { "model": "claude-sonnet-4-20250514" } }, "provider": { "type": "anthropic", "config": { "apiKeyEnv": "ANTHROPIC_API_KEY" } }, "domainContext": {} }
```

#### Step 1.6: 写入 env-state.json

记录完整环境状态，设置 `roundCounter: 0`。

---

### Phase 2: 测试执行

环境就绪后，根据用户指令执行测试。

#### 命令执行格式

所有 CLI 命令统一使用持久环境变量：

```bash
# Windows
$env:ACTANT_HOME="<homePath>"; $env:ACTANT_SOCKET="<socketPath>"; node packages/cli/dist/bin/actant.js <command>

# Unix
ACTANT_HOME="<homePath>" ACTANT_SOCKET="<socketPath>" node packages/cli/dist/bin/actant.js <command>
```

#### 日志与报告

- `roundCounter++`，更新 env-state.json
- 增量日志：`.trellis/qa-alpha/logs/qa-log-roundN.md`
- 轮次报告：`.trellis/qa-alpha/logs/qa-report-roundN.md`

日志规范完全遵循 qa-engineer SKILL.md 中的格式（即时写入、原始 I/O、判断紧随输出）。

#### 测试步骤

遵循 qa-engineer SKILL.md 的全部测试策略：
- 黑盒为主（CLI I/O + 退出码）
- 白盒为辅（检查 workspace 文件产物）
- 智能判断（PASS / WARN / FAIL）
- FAIL/WARN 自动创建/补充 Issue

#### 环境中的残留 Agent 处理

持久环境中可能有上一轮残留的 Agent。每轮测试开始前：

1. `agent list -f json` 查看当前 Agent
2. 如果场景需要干净环境：逐个 `agent destroy <name> --force`
3. 如果场景需要在已有 Agent 上继续：直接使用

**注意**：持久环境中不清理 workspace、template 等持久化数据。这正是 qa-alpha 的价值——可以测试跨会话的状态持久化。

---

### Phase 3: Restart（代码更新）

当用户执行 `/qa-alpha restart` 或 Phase 0.3 检测到代码更新时：

1. 停止所有 Agent：`agent destroy <name> --force`（逐个，忽略错误）
2. 停止 Daemon：`daemon stop`
3. 杀死 Daemon 进程树（通过记录的 PID）
4. 重建项目：`pnpm build`
5. 重启 Daemon（Step 1.4）
6. 重新加载模板（Step 1.5）
7. 更新 env-state.json（新 PID、新 buildHash）

**注意**：Restart 不删除 `home/` 目录。Agent workspace、历史日志等持久数据保留。

---

### Phase 4: Stop（手动停止）

当用户执行 `/qa-alpha stop` 时：

1. 停止所有 Agent：`agent destroy <name> --force`（逐个，忽略错误）
2. 停止 Daemon：`daemon stop`
3. 杀死 Daemon 进程树
4. 更新 env-state.json：`status → "stopped"`

**不删除任何文件**。下次 `/qa-alpha` 时会从 Phase 0 恢复。

---

## 与标准 QA 的对比

| 维度 | `/qa` (标准) | `/qa-alpha` (持久) |
|------|------------|------------------|
| 环境 | 每次 mktemp，用后即删 | `.trellis/qa-alpha/`，长期保留 |
| Daemon | 每次启停 | 常驻，跨会话复用 |
| Agent 数据 | 每次干净 | 跨会话累积（可手动清理） |
| Template | 每次加载 | 首次加载，重启时重新加载 |
| 适用场景 | 回归测试、CI 验证 | 开发调试、交互式探索、状态持久化测试 |
| 清理 | 每次必须完整清理 | 仅 stop 时清理进程，不删文件 |
| 代码更新 | 自动重建 | 检测 HEAD 变化自动重建+重启 |

---

## 注意事项

1. **不自动清理** — 这是 qa-alpha 的核心特性。环境在 `/qa-alpha stop` 后仍保留文件，只停止进程。
2. **代码更新自动重启** — 每次测试前检查 git HEAD，代码变了就 rebuild + restart Daemon。
3. **进程管理** — env-state.json 记录 Daemon PID，每次恢复时验证。PID 失效时自动重启。
4. **日志累积** — 日志文件按 round 编号递增累积，不覆盖。round 编号跨会话持续递增。
5. **Windows 兼容** — Socket 使用命名管道 `\\.\pipe\actant-qa-alpha`（固定名称，不随机）。
6. **Issue 追踪** — 同标准 QA：FAIL 创建 bug Issue，WARN 酌情创建 enhancement Issue。创建前先搜索避免重复。
7. **手动清理** — 若需完全重置环境，手动 `rm -rf .trellis/qa-alpha/` 即可。下次执行自动重建。
