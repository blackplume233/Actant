---
id: 321
title: Local catalog template sync crashes on legacy domainContext schema
status: open
labels:
  - bug
  - "priority:P1"
  - qa
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/catalog/src/catalog-manager.ts
  - packages/catalog/src/local-catalog.ts
  - .agents/skills/qa-engineer/scenarios/real-workspace-context-collaboration.json
taskRef: null
githubRef: "blackplume233/Actant#321"
closedAs: null
createdAt: "2026-03-23T05:26:49"
updatedAt: "2026-03-23T05:41:04"
closedAt: null
---

**Related Files**: `packages/catalog/src/catalog-manager.ts`, `packages/catalog/src/local-catalog.ts`, `.agents/skills/qa-engineer/scenarios/real-workspace-context-collaboration.json`

---

## 测试发现

**场景**: real-workspace-context-collaboration
**步骤**:
- `catalog-add-local`
- `catalog-sync-local`
- 连锁失败: `template-install` / `agent-create` / `agent-resolve`

在真实工作目录场景中，使用本地 shared catalog 注册 skill/prompt/template 时，`actant catalog add` 与 `actant catalog sync` 返回通用 RPC 500：`Cannot read properties of undefined (reading 'skills')`。随后 catalog 中的 template 无法安装，agent 也无法基于该 template 创建。

## 复现方式

```bash
ROOT=/Users/muyuli/Workspace/AgentCraft
TEST_DIR=$(mktemp -d)
BIN_DIR=$(mktemp -d)
ACTANT_HOME=$(mktemp -d)
ACTANT_SOCKET="$ACTANT_HOME/actant.sock"

cd "$ROOT"
node scripts/install-local.mjs --force --install-dir "$BIN_DIR"

mkdir -p "$TEST_DIR/user-project/repo" "$TEST_DIR/shared-catalog/templates" "$TEST_DIR/shared-catalog/skills" "$TEST_DIR/shared-catalog/prompts"

cat > "$TEST_DIR/shared-catalog/actant.json" <<'JSON'
{"name":"qa-shared","version":"1.0.0","components":{"skills":["skills/repo-context-reader.json"],"prompts":["prompts/system-repo-maintainer.json"],"templates":["templates/context-worker.json"]}}
JSON

cat > "$TEST_DIR/shared-catalog/skills/repo-context-reader.json" <<'JSON'
{"name":"repo-context-reader","version":"1.0.0","content":"skill"}
JSON

cat > "$TEST_DIR/shared-catalog/prompts/system-repo-maintainer.json" <<'JSON'
{"name":"system-repo-maintainer","content":"prompt"}
JSON

cat > "$TEST_DIR/shared-catalog/templates/context-worker.json" <<'JSON'
{"name":"context-worker","version":"1.0.0","backend":{"type":"cursor"},"provider":{"type":"anthropic"},"domainContext":{"skills":["repo-context-reader"],"prompts":["system-repo-maintainer"]}}
JSON

cd "$TEST_DIR/user-project"
ACTANT_HOME="$ACTANT_HOME" ACTANT_SOCKET="$ACTANT_SOCKET" ACTANT_LAUNCHER_MODE=mock "$BIN_DIR/actant" init --scaffold standard
ACTANT_HOME="$ACTANT_HOME" ACTANT_SOCKET="$ACTANT_SOCKET" ACTANT_LAUNCHER_MODE=mock "$BIN_DIR/actant" hub status -f json
ACTANT_HOME="$ACTANT_HOME" ACTANT_SOCKET="$ACTANT_SOCKET" ACTANT_LAUNCHER_MODE=mock "$BIN_DIR/actant" catalog add "$TEST_DIR/shared-catalog" --name qa-shared --type local
ACTANT_HOME="$ACTANT_HOME" ACTANT_SOCKET="$ACTANT_SOCKET" ACTANT_LAUNCHER_MODE=mock "$BIN_DIR/actant" catalog sync qa-shared
ACTANT_HOME="$ACTANT_HOME" ACTANT_SOCKET="$ACTANT_SOCKET" ACTANT_LAUNCHER_MODE=mock "$BIN_DIR/actant" template install qa-shared@context-worker
```

## 实际结果

- `catalog add` 退出码 1，输出：`[RPC -32603] Cannot read properties of undefined (reading 'skills')`
- `catalog sync` 同样失败
- `skill list -f json` 仍能看到 `qa-shared@repo-context-reader`
- `template install qa-shared@context-worker` 输出：
  - `Warning: sync failed (Cannot read properties of undefined (reading 'skills')), checking local cache...`
  - `Template "qa-shared@context-worker" not found in catalog "qa-shared".`
- `agent create qa-context-worker -t qa-shared@context-worker ...` 失败，`TEMPLATE_NOT_FOUND`

## 期望结果

- 若 legacy template schema 不受支持，`catalog add/sync` 应返回结构化校验错误，明确指出 template 缺少 `project` 字段或仍在使用 `domainContext`，而不是抛通用 TypeError。
- 更理想的行为是兼容/迁移旧字段，或在 catalog validator / template loader 阶段拦截该问题。
- 无论是否兼容，catalog 中其他可解析组件不应把模板注册流程变成不透明的 RPC 500。

## 根因收敛

从实现链路看：
- `LocalCatalog` 能加载 template JSON 文件。
- `CatalogManager.injectComponents()` 在注册 template 时直接读取 `template.project.skills` / `template.project.prompts`。
- 当前场景 template 使用的是旧 `domainContext` 字段，导致 `project` 为 `undefined`，从而触发 `Cannot read properties of undefined (reading 'skills')`。

相关文件：
- `packages/catalog/src/catalog-manager.ts`
- `packages/catalog/src/local-catalog.ts`
- `packages/shared/src/types/template.types.ts`
- `.agents/skills/qa-engineer/scenarios/real-workspace-context-collaboration.json`

## 影响

这会阻断真实用户旅程中的共享 catalog -> template 安装 -> agent 接管现有仓库链路。对于仍持有旧 template schema 的本地 catalog，当前 CLI 行为不可诊断。

---

## Comments

### ### cursor-agent — 2026-03-23T05:41:01

--body-file

### cursor-agent — 2026-03-23T05:41:04

## QA Loop Round 1\n\n- scope: #321\n- environment: mock\n- mode: report-only\n- result: FAIL\n\nThis round reused the latest deterministic evidence from the  scenario and confirmed the failure chain is unchanged:\n\n1.  fails with \n2.  fails with the same error\n3.  falls back to cache and still cannot find the template\n4. 你想创建什么？可以具体说明一下，比如：

- **skill** — 创建一个新的 Agent Skill
- **rule** — 创建一个 Cursor Rule
- **issue** — 创建一个 GitHub Issue
- **commit** — 创建一个 git commit
- **PR** — 创建一个 Pull Request
- 或者其他内容

请告诉我你的需求。 fails with \n\nRound artifacts:\n- \n- \n\nNo fix was attempted in this round. Next step is a repair round that either supports legacy  templates or converts this crash into a structured validation error before template registration.
