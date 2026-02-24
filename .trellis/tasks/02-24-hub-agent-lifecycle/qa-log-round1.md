### [Step 1] 查看默认 source 列表
**时间**: 2026-02-24T13:35 CST

#### 输入
```
actant source list -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub",
    "config": {
      "type": "github",
      "url": "https://github.com/blackplume233/actant-hub.git",
      "branch": "main"
    },
    "syncedAt": "2026-02-24T05:35:19.008Z"
  }
]
```

#### 判断: PASS
默认 source `actant-hub` 已自动注册并完成同步（syncedAt 非空）。exit_code 0。

---

### [Step 2] 同步 source 并列出模板
**时间**: 2026-02-24T13:36 CST

#### 输入
```
actant source sync
actant template list -f json
```

#### 输出
```
exit_code: 0 (sync)
Synced: actant-hub

exit_code: 0 (template list)
3 templates returned:
  - actant-hub@code-reviewer (claude-code, anthropic)
  - actant-hub@qa-engineer (claude-code, anthropic)
  - actant-hub@doc-writer (claude-code, anthropic)
```

#### 判断: PASS
source sync 成功，3 个 hub 模板全部加载。每个模板含 backend=claude-code, provider=anthropic, 域上下文（skills+prompts+mcpServers）。均无 apiKey 字段。

---

### [Step 3] 使用 hub 模板创建 Agent
**时间**: 2026-02-24T13:37 CST

#### 输入
```
actant agent create reviewer-1 -t "actant-hub@code-reviewer" -f json
```

#### 输出
```
exit_code: 1

--- stderr ---
[RPC -32006] Skill "code-review" not found in registry
Context: {"componentType":"Skill","componentName":"code-review"}
```

#### 白盒检查
```
actant skill list → 有 "actant-hub@code-review" (带前缀)
actant prompt list → 有 "actant-hub@code-assistant", "actant-hub@qa-assistant" (带前缀)
模板 domainContext.skills 引用 "code-review" (不带前缀)
```

#### 判断: FAIL
**命名空间解析缺陷**：Hub source 同步后，skills 注册为 `actant-hub@code-review`（带 source 前缀），但模板的 `domainContext.skills` 引用的是 `code-review`（不带前缀）。WorkspaceBuilder 按原始名称查找 skill，找不到导致创建失败。

**根因**：`source-manager.ts:injectComponents()` 第 292 行，给 template.name 加了 `packageName@` 前缀，但没有更新 `template.domainContext.skills`/`prompts`/`workflow` 中的组件引用。

→ **创建 Issue #142**
