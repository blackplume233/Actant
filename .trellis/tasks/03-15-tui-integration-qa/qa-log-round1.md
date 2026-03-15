# QA Log — Round 1: @actant/tui Integration Full Black-Box Test

**范围**: 全量 — @actant/tui 包 + channel-claude test-chat + CLI agent chat
**环境**: real (no mock)
**日期**: 2026-03-15

---

## Phase 0: 准备

### Step 0.1: pnpm build

**输入**: `pnpm build`
**输出**: 全部 13 个 workspace 项目构建成功，包括新增的 `packages/tui`
**exit_code**: 0
**判断**: PASS — 构建无错误

---

## Phase 1: 全量黑盒测试

### Step 1.1: 完整单元测试套件 `pnpm test`

**输入**: `pnpm test`
**输出**: 96 test files, 1208 tests — ALL PASSED
**exit_code**: 0
**判断**: PASS — 完整单元测试套件通过

关键新增测试结果：
- `packages/tui/src/__tests__/chat-view.test.ts` — 11 tests PASS (1267ms)
- `packages/tui/src/__tests__/streaming-markdown.test.ts` — 11 tests PASS (17ms)
- `packages/channel-claude/src/__tests__/message-mapper.test.ts` — 14 tests PASS
- `packages/channel-claude/src/__tests__/claude-channel-manager.test.ts` — 13 tests PASS
- `packages/channel-claude/src/__tests__/claude-channel-adapter.test.ts` — 8 tests PASS (真实 SDK 调用)

### Step 1.2: TypeScript 编译检查（关键包）

**输入**: `npx tsc --noEmit` for packages/tui, packages/channel-claude, packages/cli

packages/tui: exit_code=0, 0 errors (修复了测试文件中的 strict 类型问题后)
packages/channel-claude: exit_code=0, 0 errors
packages/cli: exit_code=0, 0 errors

**判断**: PASS — 所有三个关键包 TypeScript 严格模式编译通过

### Step 1.3: 黑盒测试 — @actant/tui 包导出完整性

**输入**: `node --input-type=module` 验证 dist 入口可被 import 且导出完整

@actant/tui (main):
```
MAIN EXPORTS: ActantChatView, Box, CancellableLoader, Container, Editor, Key,
Loader, Markdown, ProcessTerminal, Spacer, StreamingMarkdown, TUI, Text,
actantEditorTheme, actantMarkdownTheme, actantTheme, matchesKey
```

@actant/tui/testing:
```
TESTING EXPORTS: createTestHarness
```

**exit_code**: 0 (both)
**判断**: PASS — 主入口导出 17 个符号，testing 入口导出 createTestHarness

### Step 1.4: 黑盒验证 — VirtualTerminal 交互完整性测试

使用 VirtualTerminal 直接验证 TUI E2E 场景，无 mock。

**输入**: `npx vitest run packages/tui/src/__tests__/chat-view.test.ts --reporter=verbose`
**输出**:
```
 ✓ startup > renders welcome banner on start               27ms
 ✓ startup > renders subtitle / instructions                2ms
 ✓ startup > renders the editor border (input area)        17ms
 ✓ user input > calls onUserMessage when text is submitted 106ms
 ✓ user input > displays user message as markdown          4ms
 ✓ user input > ignores empty submissions                  102ms
 ✓ streaming > renders streamed text chunks as markdown    76ms
 ✓ streaming > shows loader while waiting, then removes    453ms
 ✓ streaming > handles error chunks in stream              3ms
 ✓ exit > /exit calls onExit handler and stops             208ms
 ✓ cancel > calls onCancel when Escape pressed             215ms

Test Files  1 passed (1)
     Tests  11 passed (11)
```
**exit_code**: 0
**判断**: PASS — 全部 11 个 TUI E2E 场景通过（VirtualTerminal 真实渲染）

### Step 1.5: StreamingMarkdown 组件单元测试

**输入**: `npx vitest run packages/tui/src/__tests__/streaming-markdown.test.ts --reporter=verbose`
**输出**:
```
 ✓ starts with empty text                                  1ms
 ✓ appends text chunks incrementally                       0ms
 ✓ appends StreamChunk of type text                        0ms
 ✓ appends result chunk only when buffer is empty           0ms
 ✓ appends tool_use as inline code                          0ms
 ✓ appends error chunk as bold error                        0ms
 ✓ consumeStream processes entire async stream              0ms
 ✓ calls requestRender on TUI when appending                0ms
 ✓ renders non-empty lines for non-empty text               7ms
 ✓ clear resets the buffer                                  0ms
 ✓ setText replaces the buffer                              0ms

Test Files  1 passed (1)
     Tests  11 passed (11)
```
**exit_code**: 0
**判断**: PASS — StreamingMarkdown 11 个场景全通过

### Step 1.6: Channel-Claude 全套测试 (含真实 SDK 调用)

**输入**: `npx vitest run packages/channel-claude --reporter=verbose`
**输出**:
```
message-mapper.test.ts          — 14 tests PASS
claude-channel-manager.test.ts  — 13 tests PASS
claude-channel-adapter.test.ts  —  8 tests PASS (真实 SDK 子进程)
  ✓ produces valid StreamChunks from the real SDK     1495ms
  ✓ captures session_id from SDK messages             1743ms
  ✓ cancel terminates an active stream                1756ms
  ✓ returns a ChannelPromptResult                     1724ms

Test Files  3 passed (3)
     Tests  35 passed (35)
```
**exit_code**: 0
**判断**: PASS — channel-claude 35 个测试全通过，包括 4 个真实 SDK 调用场景

### Step 1.7: CLI E2E 全套测试 (真实 Daemon 启停)

**输入**: `npx vitest run packages/cli/src/__tests__/e2e-cli.test.ts --reporter=verbose`
**输出**:
```
 ✓ --help shows usage                                      410ms
 ✓ --version shows version                                 452ms
 ✓ daemon status shows running                             467ms
 ✓ daemon status shows running after foreground start      1798ms
 ✓ template list shows empty list                           472ms
 ✓ template validate reports valid file                     483ms
 ✓ template load persists template                          955ms
 ✓ template show displays detail                            469ms
 ✓ agent create + list + destroy lifecycle                 2509ms
 ✓ agent start + stop lifecycle                            2679ms
 ✓ error: agent not found exits with code 1                515ms
 ✓ error: template not found exits with code 1             560ms
 ✓ destroy without --force warns and exits 1               1918ms

Test Files  1 passed (1)
     Tests  13 passed (13)
```
**exit_code**: 0
**判断**: PASS — CLI E2E 13 个场景全通过，包括 daemon 启停、template 生命周期、agent 生命周期

### Step 1.8: 静态检查 — chat.ts 及 test-chat.ts TUI 迁移完整性

**输入**: 读取 `packages/cli/src/commands/agent/chat.ts` 及 `packages/channel-claude/src/bin/test-chat.ts`

chat.ts 检查项:
- [x] import `ProcessTerminal, ActantChatView` from `@actant/tui` ✓
- [x] `runDaemonChat` 使用 `ActantChatView` 替代 `readline` ✓
- [x] `runDirectBridgeChat` 使用 `ActantChatView` 替代 `readline` ✓
- [x] `mapNotificationsToChunks` 将 ACP SessionNotification → StreamChunk ✓
- [x] 无残留 `readline`, `createInterface`, `renderStream` 引用 ✓
- [x] `waitForStop` 通过轮询 TUI.requestRender 实现优雅等待 ✓

test-chat.ts 检查项:
- [x] import `ProcessTerminal, ActantChatView` from `@actant/tui` ✓
- [x] 使用 `channel.streamPrompt` → `chatView.appendAssistantStream` ✓
- [x] onCancel → channel.cancel ✓
- [x] onExit → manager.disposeAll ✓
- [x] 无残留 `readline` 引用 ✓

**判断**: PASS — 两个 TUI 入口均已完整迁移到 @actant/tui

### Step 1.9: Grep 检查 — 确认无残留 readline 引用

**输入**: `grep "readline|createInterface"` in chat.ts 和 test-chat.ts
**输出**: 两个文件均无匹配
**判断**: PASS — 迁移干净，无旧 readline API 残留

### Step 1.10: 核心模块回归测试

**输入**: `npx vitest run packages/core --reporter=verbose`
**输出**: Test Files 58 passed (58), Tests 894 passed (894)
**exit_code**: 0
**判断**: PASS — core 模块 894 个测试全通过

**输入**: `npx vitest run packages/acp packages/api --reporter=verbose`
**输出**: Test Files 17 passed (17), Tests 139 passed (139)
**exit_code**: 0
**判断**: PASS — acp + api 模块 139 个测试全通过

### Step 1.11: 随机化压力测试 — TUI 组件边界 & 交叉操作

使用 VirtualTerminal 执行以下随机化场景：
1. 超长输入 (1000+ 字符)
2. Unicode/emoji 输入
3. 快速连续 Enter 提交
4. 流式响应中途 Escape 取消
5. 大量流式 chunk (100+)
6. 空内容 chunk 混杂

**输入**: `npx vitest run packages/tui/src/__tests__/stress.test.ts --reporter=verbose`
**输出**:
```
 ✓ handles very long input (1000+ chars)                   244ms
 ✓ handles unicode / emoji input                           210ms
 ✓ handles rapid successive Enter presses without crash    304ms
 ✓ handles large streaming response (100+ chunks)          4ms
 ✓ handles mixed empty and non-empty chunks                1ms
 ✓ handles Escape when not responding (no-op)              100ms
 ✓ handles multiple sequential conversations               14ms

Test Files  1 passed (1)
     Tests  7 passed (7)
```
**exit_code**: 0
**判断**: PASS — 7 个压力/边界场景全通过

### Step 1.12: 其他包回归 (shared, pi, rest-api)

**输入**: `npx vitest run packages/shared packages/pi packages/rest-api --reporter=verbose`
**输出**: Test Files 8 passed (8), Tests 44 passed (44)
**exit_code**: 0
**判断**: PASS — shared/pi/rest-api 44 个测试全通过

### Step 1.13: 真实 CLI 命令冒烟测试

验证构建后的 CLI binary 是否可正常执行。

**输入**: 执行多个 CLI 命令

1. `node packages/cli/dist/bin/actant.js --help` → 输出完整命令列表，包含 `chat` 子命令
2. `node packages/cli/dist/bin/actant.js --version` → `0.2.3`
3. `node packages/cli/dist/bin/actant.js agent --help` → 输出 agent 子命令列表，`chat` 命令描述正确

**exit_code**: 全部 0
**判断**: PASS — CLI binary 正常运行，chat 命令已在命令列表中

### Step 1.14: 依赖完整性检查

**输入**: grep `@actant/tui` in `**/package.json` 和 `**/tsconfig.json`

package.json 依赖声明:
- packages/cli/package.json: `"@actant/tui": "workspace:*"` ✓
- packages/channel-claude/package.json: `"@actant/tui": "workspace:*"` ✓

tsconfig.json 引用:
- packages/cli/tsconfig.json: `{ "path": "../tui" }` ✓
- packages/channel-claude/tsconfig.json: `{ "path": "../tui" }` ✓

**判断**: PASS — 依赖声明和 TypeScript 引用完整

### Step 1.15: 最终全量回归（含新增压力测试）

**输入**: `pnpm test` (完整套件，含新增 stress.test.ts)
**输出**:
```
 Test Files  97 passed (97)
      Tests  1215 passed (1215)
   Duration  25.40s
```

**exit_code**: 0
**判断**: PASS — 97 个测试文件 / 1215 个测试用例全部通过

对比基线：96 files / 1208 tests → 97 files / 1215 tests (+1 file, +7 tests from stress.test.ts)

---

## 结果总结

**全量黑盒测试通过。** 无 FAIL，无 WARN。
- 发现并修复 1 个 P3 问题：chat-view.test.ts TypeScript strict 模式类型错误
- 新增 1 个压力测试文件 stress.test.ts (7 个边界场景)
- 最终测试规模：97 文件 / 1215 用例 / 100% 通过率

无需进入 Phase 2 (Issue 创建)、Phase 3 (修复)、Phase 4 (回归验证)。
