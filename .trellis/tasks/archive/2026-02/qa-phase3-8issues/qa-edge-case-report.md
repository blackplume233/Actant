# QA Edge-Case Testing Report

**Date:** 2025-02-22  
**Scope:** Actant project deep edge-case and cross-feature interaction testing

---

## 1. VersionedComponent Inheritance Consistency

### Description
All concrete component managers (skill, prompt, mcp-config, workflow, plugin) use Zod schemas in `validate()`. By default, `z.object()` **strips** unknown keys. VersionedComponent fields (`version`, `$type`, `$version`, `origin`, `tags`) are not explicitly in most schemas and get stripped on validation.

### Code Evidence

| Manager | File | Schema | VersionedComponent fields |
|---------|------|--------|---------------------------|
| SkillManager | `packages/core/src/domain/skill/skill-manager.ts` L6-11 | `name`, `description`, `content`, `tags` | Missing: `version`, `$type`, `$version`, `origin` |
| PromptManager | `packages/core/src/domain/prompt/prompt-manager.ts` L6-11 | `name`, `description`, `content`, `variables` | Missing all 5 |
| McpConfigManager | `packages/core/src/domain/mcp/mcp-config-manager.ts` L6-12 | `name`, `description`, `command`, `args`, `env` | Missing all 5 |
| WorkflowManager | `packages/core/src/domain/workflow/workflow-manager.ts` L5-10 | `name`, `description`, `content` | Missing all 5 |
| PluginManager | `packages/core/src/domain/plugin/plugin-manager.ts` L6-13 | `name`, `description`, `type`, `source`, `config`, `enabled` | Missing: `version`, `$type`, `$version`, `origin`, `tags` |

### Verdict: **FAIL**

When components are loaded via `loadFromDirectory()` (used by `app-context.ts` L167), validation strips `version`, `$type`, `$version`, `origin`. This breaks:
- Sync report version deltas (relies on `c.version`)
- Origin tracking for source-originated components

**Note:** SourceManager's `injectComponents()` bypasses validation (uses `register()` directly), so components from LocalSource/GitHubSource retain metadata. Inconsistency between the two loading paths.

### Recommended Action
Add `.passthrough()` to each schema, or explicitly include optional fields:
```ts
const SkillDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.string().min(1),
  version: z.string().optional(),
  $type: z.string().optional(),
  $version: z.number().optional(),
  origin: z.object({...}).optional(),
  tags: z.array(z.string()).optional(),
});
```

---

## 2. Template with Permissions + MCP Servers + Domain Context

### Description
Template with `permissions: "standard"` and inline `mcpServers` in `domainContext` should auto-append `mcp__fs` to the allow list.

### Code Evidence

1. **AgentInitializer** (`packages/core/src/initializer/agent-initializer.ts` L95-100):
   ```ts
   await this.builder.build(workspaceDir, template.domainContext, template.backend.type, template.permissions);
   ```
   Permissions and domainContext are passed to `WorkspaceBuilder.build()`.

2. **WorkspaceBuilder** (`packages/core/src/builder/workspace-builder.ts` L108-143):
   - Resolves `mcpServers` via `mcpServersHandler` → `resolvedMcpServers`
   - Passes `resolvedMcpServers` and `permissions` to `injectPermissions()`

3. **ClaudeCodeBuilder.injectPermissions** (`packages/core/src/builder/claude-code-builder.ts` L96-124):
   ```ts
   const resolved = resolvePermissionsWithMcp(permissions, servers.map((s) => s.name));
   ```

4. **resolvePermissionsWithMcp** (`packages/core/src/permissions/permission-presets.ts` L47-60):
   ```ts
   for (const name of mcpServerNames) {
     allow.push(`mcp__${name}`);
   }
   ```

5. **mcpServersHandler** (`packages/core/src/builder/handlers/mcp-servers-handler.ts` L18-28):
   - Inline objects `{name, command, args}` pass `isMcpServerRef` → returned as definitions
   - Names extracted for `resolvePermissionsWithMcp`

### Verdict: **PASS**

Flow is correct. Template `permissions` and `domainContext.mcpServers` are wired through; `mcp__fs` is auto-appended when MCP server `fs` is present. Tested in `workspace-builder.test.ts` L81-96.

---

## 3. Source Sync with Templates + Version Changes

### Description
Does `syncSourceWithReport` correctly detect added/updated/removed templates and compute version deltas?

### Code Evidence

- **buildSyncReport** (`packages/core/src/source/source-manager.ts` L371-408): Iterates `newSnapshot` and `oldSnapshot`; templates included via `snapshotComponents` (L355-359).
- **snapshotComponents** includes `templateRegistry` with `type: "template"` and `version`.
- **removeNamespacedComponents** (L287-306) unregisters templates before sync; `injectComponents` re-registers from fetch result.

### Verdict: **PASS**

Logic is symmetric for all component types. `source-manager.test.ts` L128-166 covers skill add/update/remove; templates use the same `buildSyncReport` path. Template add/update/remove would be reported correctly.

### WARN
No explicit test for template add/update/remove during sync. Recommend adding a test that adds/removes a template file and asserts `report.added`/`report.removed` for templates.

---

## 4. Directory-Based Loading Edge Cases

### Description
Edge cases in `BaseComponentManager.loadFromDirectory()`.

### 4a. `manifest.json` has `"content": "nonexistent.md"`

**Code** (`packages/core/src/domain/base-component-manager.ts` L159-168):
```ts
const resolved = await this.resolveContentFile(fullPath, parsed.content);
if (resolved !== null) {
  parsed.content = resolved;
} else if (!parsed.content.includes("\n") && (parsed.content.endsWith(".md") || parsed.content.endsWith(".txt"))) {
  this.logger.warn({ file: parsed.content, dir: entry }, `Content file not found, using path as-is`);
}
```

**Verdict: WARN**

- `resolveContentFile` returns `null` on read failure.
- Path is used as-is; component gets `content: "nonexistent.md"` (literal string).
- Validation passes (`z.string().min(1)`).
- **Recommended:** Fail validation or reject loading when content file is missing.

### 4b. Directory has both `manifest.json` AND same-name `.json` file

**Code:** `loadFromDirectory` iterates entries; files and dirs are separate. Both can produce a component with the same `name` (e.g. `my-skill`). Second `register()` overwrites the first (Map.set).

**Verdict: WARN**

- Load order: files first, then dirs. Dir wins.
- No dedup or conflict detection.
- **Recommended:** Log conflict or enforce unique names.

### 4c. `@namespace/` directory contains nested `@` directories

**Code** (L241-252):
```ts
const namespaceDirs = entries.filter((e) => e.startsWith("@"));
for (const nsDir of namespaceDirs) {
  count += await this.loadFromDirectory(nsPath);
}
```

**Verdict: PASS**

Recursive `loadFromDirectory` handles nested `@` dirs correctly.

---

## 5. SKILL.md Edge Cases

### Description
Edge cases in `skill-md-parser.ts`.

### 5a. Frontmatter has extra fields not in metadata

**Code** (L38-62): Parser only extracts `name`, `description`, `metadata.version`, `metadata.actant-tags`. Extra keys are ignored.

**Verdict: PASS**

### 5b. `actant-tags` has trailing commas or spaces

**Code** (L69-71):
```ts
tags.push(...actantTags.split(",").map((t) => t.trim()).filter(Boolean));
```

**Verdict: PASS**

`"tag1, tag2 , tag3"` → `["tag1", "tag2", "tag3"]`.

### 5c. Content section is empty

**Code** (L35): `content = raw.substring(endIdx + 3).trim()` → can be `""`.

**Verdict: WARN**

- `parseSkillMdContent` returns `{ content: "" }`.
- LocalSource registers without validation.
- SkillManager schema requires `content: z.string().min(1)` for `add()`/`loadFromDirectory()`.
- **Recommended:** Reject or warn on empty content in parser or validation.

### 5d. YAML uses multi-line values

**Code** (L50-51): `const match = keyValue.match(/^(\w[\w-]*)\s*:\s*"?([^"]*)"?$/);` — only handles single-line values.

**Verdict: FAIL**

Multi-line YAML (e.g. `description: |\n  Line 1\n  Line 2`) is not parsed; value would be wrong or empty.

**Recommended Action:** Use a YAML parser (e.g. `yaml`) for frontmatter, or document single-line-only support.

---

## 6. InstanceRegistry Edge Cases

### 6a. `adopt()` called with path that doesn't have `.actant.json`

**Code** (`packages/core/src/state/instance-registry.ts` L99-108):
```ts
const meta = await readInstanceMeta(resolvedPath);
// readInstanceMeta throws InstanceCorruptedError on ENOENT
```

**Verdict: PASS**

`readInstanceMeta` throws `InstanceCorruptedError` when file is missing (`instance-meta-io.ts` L24-28).

### 6b. `adopt()` finds a name conflict

**Code** (L110-114):
```ts
if (this.has(name)) {
  throw new Error(`Instance name "${name}" already exists in registry`);
}
```

**Verdict: PASS**

### 6c. `reconcile()` encounters path that exists but `.actant.json` is corrupted JSON

**Code** (L170-174):
```ts
try {
  const adoptedEntry = await this.adopt(dirPath);
  adopted.push(adoptedEntry.name);
} catch {
  // Skip corrupted or invalid directories
}
```

**Verdict: PASS**

Corrupted JSON causes `readInstanceMeta` to throw; `adopt` catches and skips.

### 6d. Race condition if two processes call `save()` simultaneously

**Code** (`instance-registry.ts` L63-68, `instance-meta-io.ts` L64-68):
```ts
const tmpPath = `${this.registryPath}.${randomUUID().slice(0, 8)}.tmp`;
await writeFile(tmpPath, content, "utf-8");
await rename(tmpPath, this.registryPath);
```

**Verdict: WARN**

- Each process uses a unique tmp file.
- `rename` is atomic per file.
- Last writer wins; earlier updates can be lost.
- **Recommended:** Use file locking or a single-writer design if concurrent access is expected.

---

## 7. ComponentTypeHandler Edge Cases

### 7a. `workflow` handler receives `undefined`

**Code** (`packages/core/src/builder/handlers/workflow-handler.ts` L7-8):
```ts
if (refs === undefined || refs === null) return [];
```

**Verdict: PASS**

### 7b. `mcpServers` handler receives objects instead of strings

**Code** (`mcp-servers-handler.ts` L18-28):
- `arr.every(isMcpServerRef)` → inline objects returned as definitions.
- Strings → fallback to `manager?.resolve()`.

**Verdict: PASS**

Both shapes are supported.

### 7c. `mcpServers` receives malformed objects (no `name`/`command`)

**Code:** `isMcpServerRef` returns false; `manager?.resolve(arr as string[])` is used. `resolve` expects string names; passing objects leads to `ComponentReferenceError` or incorrect behavior.

**Verdict: WARN**

Malformed refs cause a throw. No graceful handling. Consider validating and returning `[]` or a clear error.

### 7d. Handler's `resolve()` throws — is it caught in WorkspaceBuilder?

**Code** (`workspace-builder.ts` L116):
```ts
const definitions = handler.resolve(refs, manager);
```
No try/catch.

**Verdict: WARN**

Exceptions propagate. Invalid domain context causes build failure. Acceptable for fail-fast, but not graceful.

---

## Summary

| # | Area | Result | Count |
|---|------|--------|-------|
| 1 | VersionedComponent inheritance | FAIL | 1 |
| 2 | Template + permissions + MCP | PASS | 1 |
| 3 | Source sync + templates | PASS (WARN: no template test) | 1 |
| 4 | Directory loading | 1 PASS, 2 WARN | 3 |
| 5 | SKILL.md | 2 PASS, 2 WARN, 1 FAIL | 5 |
| 6 | InstanceRegistry | 3 PASS, 1 WARN | 4 |
| 7 | ComponentTypeHandler | 2 PASS, 2 WARN | 4 |

**Priority fixes:**
1. **FAIL:** Add `.passthrough()` or explicit VersionedComponent fields to all manager Zod schemas.
2. **FAIL:** Handle multi-line YAML in SKILL.md or document limitation.
3. **WARN:** Reject or warn when manifest content file is missing.
4. **WARN:** Add template add/remove sync tests.
