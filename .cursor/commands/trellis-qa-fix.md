# QA Fix — 交互式 Bug 修复环境

复用 qa-alpha 的持久化环境（`.trellis/qa-alpha/`），在同一个 Daemon 上进行**交互式 Bug 查找 → 修复 → 自动重装 → 验证**循环。

与 `/qa-alpha` 的核心区别：不执行测试场景，而是**接受用户描述的问题，主动搜索根因，修改源码，自动 rebuild+restart，再验证修复效果**。

---

## 指令格式

`/qa-fix [mode] [args]`

| 模式 | 示例 | 行为 |
|------|------|------|
| **fix** | `/qa-fix "agent create 报 undefined"` | 查找根因 → 修复 → 重装 → 验证 |
| **search** | `/qa-fix search "socket 连接失败"` | 仅搜索根因，不修改代码 |
| **optimize** | `/qa-fix optimize "agent list 响应慢"` | 性能/体验优化，自动重装验证 |
| **status** | `/qa-fix status` | 查看共享环境状态 |
| **restart** | `/qa-fix restart` | 重建并重启共享环境 |

省略模式关键词时视为 **fix**。

---

## 共享环境

与 `/qa-alpha` 共用同一持久化目录：

```
.trellis/qa-alpha/          ← 共享，不重复创建
├── env-state.json
├── home/
└── logs/
    ├── qa-fix-roundN.md    ← fix 专属日志（区别于 qa-log-roundN）
    └── ...
```

**不创建新目录**，直接复用 qa-alpha 的环境状态和 Daemon。

---

## 执行流程

### Phase 0: 环境检查（与 qa-alpha 完全一致）

**每次执行必须先完成此步骤。**

#### Step 0.1: 读取环境状态

```powershell
# Windows
Get-Content .trellis/qa-alpha/env-state.json
```

- 若不存在 → 执行与 qa-alpha Phase 1 完全相同的「首次初始化」流程（参见 `/qa-alpha` 指令）
- 若存在 → 继续 Step 0.2

#### Step 0.2: 验证 Daemon 存活

```powershell
# Windows
$env:ACTANT_HOME="<homePath>"; $env:ACTANT_SOCKET="<socketPath>"; node packages/cli/dist/bin/actant.js daemon status -f json
```

- `running: true` → 直接进入 Phase 1
- 否则 → 重启 Daemon（参照 qa-alpha Phase 3 restart 流程）

#### Step 0.3: 检查代码是否需要重建

```bash
git rev-parse HEAD
```

与 `buildHash` 对比：不同则 `pnpm build` + restart Daemon + 更新 env-state.json。

---

### Phase 1: 问题搜索（Search）

接收用户描述的问题，系统性定位根因。

#### Step 1.1: 复现问题

在持久环境中执行用户描述的操作，捕获完整输出：

```powershell
# Windows
$env:ACTANT_HOME="<homePath>"; $env:ACTANT_SOCKET="<socketPath>"; node packages/cli/dist/bin/actant.js <user-described-command>
```

记录：原始命令、完整 stdout/stderr、退出码。

#### Step 1.2: 根因分析

根据错误信息，**按以下优先级**搜索代码：

1. **精确搜索**：在源码中搜索错误消息字符串（使用 Grep 工具）
2. **调用链追踪**：从错误发生位置向上追踪调用栈
3. **符号影响分析**：查询 GitNexus MCP 的 impact 分析（若涉及核心模块）
4. **日志辅助**：检查 `.trellis/qa-alpha/logs/` 中历史日志的相关条目

输出根因定位报告：
```
根因定位
文件：<filepath>:<line>
函数：<function name>
原因：<one-line description>
影响范围：<其他可能受影响的模块>
```

---

### Phase 2: 修复实施（Fix）

#### Step 2.1: 确认修复方案

在修改前，简述修复思路（1-3 句话），让用户知晓即将修改的内容。

#### Step 2.2: 修改源码

直接编辑源文件修复 Bug：
- 最小化改动原则：只改必要的代码
- 保持原有代码风格
- 不添加多余注释

#### Step 2.3: 检查 Lint

```bash
pnpm lint --filter <changed-package>
```

有 lint 错误立即修复，不跳过。

---

### Phase 3: 自动重装（Auto Rebuild & Restart）

修复完成后**自动执行**，无需用户手动触发。

#### Step 3.1: 重建项目

```bash
pnpm build
```

构建失败时：
- 输出具体错误
- 修复编译错误后重试
- 若无法修复，还原修改并报告

#### Step 3.2: 重启 Daemon

1. 停止所有 Agent（若有）：`agent destroy <name> --force`
2. 停止 Daemon：`daemon stop` + 杀死 PID
3. 重启 Daemon（qa-alpha Phase 1.4 流程）
4. 重新加载模板（qa-alpha Phase 1.5 流程）
5. 更新 env-state.json：新 PID、新 buildHash、新 buildTimestamp

#### Step 3.3: 等待就绪

轮询 `daemon status -f json` 直到 `running: true`，最多等待 30s。

---

### Phase 4: 修复验证（Verify）

#### Step 4.1: 重现原始操作

用相同的命令重新执行，验证问题已消失。

#### Step 4.2: 回归检查

```bash
pnpm test:changed
```

确保修改没有破坏其他功能。

#### Step 4.3: 输出修复报告

写入 `.trellis/qa-alpha/logs/qa-fix-roundN.md`（N 与 env-state.json 的 roundCounter 对齐）：

```markdown
## Fix Round N — <简短标题>

**问题描述**：<用户输入>
**复现命令**：`<command>`
**根因**：`<file>:<line>` — <description>
**修改文件**：
- `<filepath>` — <change summary>

**验证结果**：PASS / FAIL
**回归测试**：PASS / FAIL（N 个测试）
**耗时**：<elapsed>
```

- FAIL 时：自动调用 issue-manager skill 创建 bug Issue（先搜索避免重复）

---

### Phase 5: 优化模式（Optimize）

当用户使用 `/qa-fix optimize <description>` 时：

1. **性能剖析**：在持久环境中执行操作，捕获耗时数据
2. **瓶颈定位**：搜索相关代码路径，识别性能热点
3. **实施优化**：修改源码（缓存、并发、减少 I/O 等）
4. **自动重装**：同 Phase 3
5. **对比验证**：执行相同操作，对比优化前后耗时
6. 输出优化报告，写入 `qa-fix-roundN.md`

---

## 修复循环

每次修复完成后，**主动询问用户**是否有下一个问题：

```
✓ Fix Round N 完成
  - 修复：<one-line summary>
  - 验证：PASS
  - 环境保持运行中

下一个问题？（直接描述，或输入 /qa-fix stop 退出）
```

环境持续运行，直到用户明确停止。

---

## 与 qa-alpha 的关系

| 维度 | `/qa-alpha` | `/qa-fix` |
|------|------------|-----------|
| 共享环境 | ✓ 相同目录和 Daemon | ✓ 完全复用 |
| 触发方式 | 执行预设/临时测试场景 | 接收用户描述的 Bug |
| 代码修改 | ✗ 不修改源码 | ✓ 直接修改源码修复 |
| 重装时机 | 手动 restart 或检测到 HEAD 变化 | 每次修复后**自动** rebuild+restart |
| 适用场景 | 黑盒测试、场景验证 | 交互式调试、Bug 修复、性能优化 |
| 日志前缀 | `qa-log-roundN` | `qa-fix-roundN` |

**两者可并行使用**：修复后可立即用 `/qa-alpha` 回归验证修复效果。

---

## 注意事项

1. **共享 Daemon** — 与 qa-alpha 共用同一个 Daemon 实例，修改代码 rebuild 后 Daemon 会重启，正在运行的 qa-alpha 测试会中断。
2. **最小化修改** — 每次只修复一个问题，避免大范围重构。
3. **自动重装** — 修复后无需手动 restart，Phase 3 自动处理。
4. **修复失败回退** — 若 build 失败，使用 `git checkout -- <files>` 还原，报告无法修复。
5. **Issue 追踪** — 验证失败时自动创建 Issue，确保问题有记录。
6. **核心模块修改** — 若修改影响核心模块，先查询 GitNexus MCP impact 分析再动手。
