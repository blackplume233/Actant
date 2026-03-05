# QA Log — VFS E2E Round 2 (回归验证)

**场景**: 即兴探索 — 验证 Agent 雇员能正确访问 VFS
**环境**: Windows 10, real launcher mode
**TEST_DIR**: C:\Users\black\AppData\Local\Temp\ac-qa-vfs-r2-639079839793781489
**基线 node 进程数**: 16

---

### [Step 1] Daemon 启动
**时间**: 2026-03-01T17:46

#### 输入
```
ACTANT_HOME=$TEST_DIR node packages/cli/dist/bin/actant.js daemon start --foreground
```

#### 输出
```
exit_code: 0 (running)
--- stdout ---
Daemon started (foreground). PID: 45260
Press Ctrl+C to stop.
--- stderr ---
(empty)
```

#### 验证
```
daemon status → Daemon is running. Version: 0.2.3, Uptime: 14s, Agents: 0
```

#### 判断: PASS

---

### [Step 2] VFS mount list — 默认挂载点
**时间**: 2026-03-01T17:47

#### 输入
```
node packages/cli/dist/bin/actant.js vfs mount list
```

#### 输出
```
exit_code: 0
--- stdout ---
/config                        config         [read, write, edit, ... (5)]
/memory                        memory         [read, write, list, grep]
/canvas                        canvas         [read, write, list]
--- stderr ---
(empty)
```

#### 判断: PASS
3 个 daemon 级默认挂载点（config, memory, canvas）均已创建。

---

### [Step 3] VFS ls / — 根目录列举
**时间**: 2026-03-01T17:47

#### 输入
```
node packages/cli/dist/bin/actant.js vfs ls /
```

#### 输出
```
exit_code: 0
--- stdout ---
/config/
/memory/
/canvas/
--- stderr ---
(empty)
```

#### 判断: PASS

---

### [Step 4] VFS describe /config — 描述挂载点
**时间**: 2026-03-01T17:47

#### 输入
```
node packages/cli/dist/bin/actant.js vfs describe /config --json
```

#### 输出
```
exit_code: 0
--- stdout ---
{
  "path": "/config",
  "mountPoint": "/config",
  "sourceName": "config",
  "sourceType": "config",
  "capabilities": ["read", "write", "edit", "list", "stat"],
  "metadata": { "description": "Config namespace: root" }
}
--- stderr ---
(empty)
```

#### 判断: PASS
sourceName, sourceType, capabilities 和 metadata 均正确。

---

### [Step 5] VFS write + read /memory — 内存读写
**时间**: 2026-03-01T17:47

#### 输入 (write)
```
node packages/cli/dist/bin/actant.js vfs write /memory/test-note.md --content "Hello from VFS QA test"
```

#### 输出 (write)
```
exit_code: 0
--- stdout ---
Written 22 bytes (created: true)
```

#### 输入 (read)
```
node packages/cli/dist/bin/actant.js vfs read /memory/test-note.md
```

#### 输出 (read)
```
exit_code: 0
--- stdout ---
Hello from VFS QA test
```

#### 判断: PASS
写入 22 字节，读回内容完全一致。

---

### [Step 6] VFS grep /memory — 内存搜索
**时间**: 2026-03-01T17:48

#### 输入
```
# 先写入第 2 个文件
node packages/cli/dist/bin/actant.js vfs write /memory/notes/dev.md --content "Development notes for VFS implementation"
# 然后搜索
node packages/cli/dist/bin/actant.js vfs grep "VFS" /memory
```

#### 输出
```
exit_code: 0
--- stdout ---
test-note.md:1: Hello from VFS QA test
notes/dev.md:1: Development notes for VFS implementation
```

#### 判断: PASS
grep 正确匹配了两个文件中的 "VFS" 关键词。

---

### [Step 7] VFS ls /memory — 内存目录列举
**时间**: 2026-03-01T17:48

#### 输入
```
node packages/cli/dist/bin/actant.js vfs ls /memory
```

#### 输出
```
exit_code: 0
--- stdout ---
test-note.md
notes/
```

#### 判断: PASS

---

### [Step 8] Agent 创建 → workspace 自动挂载
**时间**: 2026-03-01T17:48

#### 输入
```
node packages/cli/dist/bin/actant.js agent create qa-vfs-worker --template "actant-hub@actant-steward"
```

#### 输出
```
exit_code: 0
--- stdout ---
Agent created successfully.
Agent:     qa-vfs-worker
ID:        30e093d2-7c2a-44a5-a7cf-f406d3cc10ed
Template:  actant-hub@actant-steward@1.0.0
Archetype: service
AutoStart: yes
Status:    created
```

#### 产物检查
```
node packages/cli/dist/bin/actant.js vfs mount list --json
→ 4 个挂载点：config, memory, canvas, workspace-qa-vfs-worker
→ workspace-qa-vfs-worker 挂载点: /workspace/qa-vfs-worker
→ sourceType: "filesystem", capabilities: [read, read_range, write, edit, delete, list, stat, tree, glob, grep] (10 项)
```

#### 判断: PASS
Agent 创建后，workspace 自动挂载到 `/workspace/qa-vfs-worker`，支持全部 10 个文件系统能力。

---

### [Step 9] VFS ls + read Agent workspace
**时间**: 2026-03-01T17:48

#### 输入 (ls)
```
node packages/cli/dist/bin/actant.js vfs ls /workspace/qa-vfs-worker
```

#### 输出 (ls)
```
exit_code: 0
--- stdout ---
AGENTS.md
CLAUDE.md
prompts/
```

#### 输入 (read)
```
node packages/cli/dist/bin/actant.js vfs read /workspace/qa-vfs-worker/AGENTS.md
```

#### 输出 (read)
```
exit_code: 0
--- stdout ---
# Agent Skills
## actant-hub@intent-routing
> 意图识别与路由 — 解析用户自然语言输入...
(完整 AGENTS.md 内容，约 200 行 markdown)
```

#### 判断: PASS
通过 VFS 成功读取 Agent workspace 文件，内容完整。

---

### [Step 10] VFS write → Agent workspace
**时间**: 2026-03-01T17:48

#### 输入 (write)
```
node packages/cli/dist/bin/actant.js vfs write /workspace/qa-vfs-worker/qa-test.txt --content "VFS write test from QA round 2"
```

#### 输出 (write)
```
exit_code: 0
--- stdout ---
Written 30 bytes (created: true)
```

#### 输入 (read back)
```
node packages/cli/dist/bin/actant.js vfs read /workspace/qa-vfs-worker/qa-test.txt
```

#### 输出 (read back)
```
exit_code: 0
--- stdout ---
VFS write test from QA round 2
```

#### 判断: PASS
写入 30 字节到 workspace，读回一致。

---

### [Step 11] VFS grep Agent workspace
**时间**: 2026-03-01T17:48

#### 输入
```
node packages/cli/dist/bin/actant.js vfs grep "VFS" /workspace/qa-vfs-worker
```

#### 输出
```
exit_code: 0
--- stdout ---
qa-test.txt:1: VFS write test from QA round 2
```

#### 判断: PASS

---

### [Step 12] VFS edit Agent workspace
**时间**: 2026-03-01T17:48

#### 输入
```
node packages/cli/dist/bin/actant.js vfs edit /workspace/qa-vfs-worker/qa-test.txt --old "round 2" --new "round 2 - EDITED"
```

#### 输出
```
exit_code: 0
--- stdout ---
1 replacement(s) made
```

#### 验证
```
node packages/cli/dist/bin/actant.js vfs read /workspace/qa-vfs-worker/qa-test.txt
→ VFS write test from QA round 2 - EDITED
```

#### 判断: PASS
编辑成功，内容已更新。

---

### [Step 13] VFS stat + tree
**时间**: 2026-03-01T17:49

#### 输入 (stat)
```
node packages/cli/dist/bin/actant.js vfs stat /workspace/qa-vfs-worker/qa-test.txt
```

#### 输出 (stat)
```
exit_code: 0
--- stdout ---
Type: file
Size: 39
Modified: 2026-03-01T09:48:32.883Z
```

#### 输入 (tree)
```
node packages/cli/dist/bin/actant.js vfs tree /workspace/qa-vfs-worker
```

#### 输出 (tree)
```
exit_code: 0
--- stdout ---
└── qa-vfs-worker/
    ├── AGENTS.md
    ├── CLAUDE.md
    ├── prompts/
    │   └── system.md
    └── qa-test.txt
```

#### 判断: PASS

---

### [Step 14] VFS delete
**时间**: 2026-03-01T17:49

#### 输入
```
node packages/cli/dist/bin/actant.js vfs rm /workspace/qa-vfs-worker/qa-test.txt
```

#### 输出
```
exit_code: 0
--- stdout ---
Deleted
```

#### 验证
```
node packages/cli/dist/bin/actant.js vfs read /workspace/qa-vfs-worker/qa-test.txt
→ exit_code: 1, [RPC -32603] ENOENT: no such file or directory
```

#### 判断: PASS
文件删除成功，后续读取正确返回 ENOENT。

---

### [Step 15] Agent 销毁 → workspace 自动卸载
**时间**: 2026-03-01T17:49

#### 输入
```
node packages/cli/dist/bin/actant.js agent destroy qa-vfs-worker --force
```

#### 输出
```
exit_code: 0
--- stdout ---
Destroyed qa-vfs-worker
```

#### 产物检查
```
node packages/cli/dist/bin/actant.js vfs mount list --json
→ 3 个挂载点：config, memory, canvas
→ workspace-qa-vfs-worker 已不存在
```

#### 判断: PASS
Agent 销毁后，workspace 挂载点自动卸载。

---

### [Step 16] VFS ls / — 确认回到初始状态
**时间**: 2026-03-01T17:49

#### 输入
```
node packages/cli/dist/bin/actant.js vfs ls /
```

#### 输出
```
exit_code: 0
--- stdout ---
/config/
/memory/
/canvas/
```

#### 判断: PASS

---

### [Cleanup] 环境清理
**时间**: 2026-03-01T17:50

1. `daemon stop` → Daemon stopping... (exit_code: 0)
2. `taskkill /F /T /PID 45260` → 进程已通过 daemon stop 退出
3. Node 进程数: 16 (与基线 16 一致，无泄漏)
4. 临时目录: 已删除

#### 判断: PASS
清理完成，无残留进程。
