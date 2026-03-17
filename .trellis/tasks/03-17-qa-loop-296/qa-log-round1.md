### [Step 1] Workspace relink for new packages
**Time**: 2026-03-17T10:05:00+08:00

#### Input
```powershell
pnpm install --force
```

#### Output
```text
exit_code: 0

--- stdout ---
Scope: all 17 workspace projects
Progress: resolved 816, reused 684, downloaded 132, added 820, done
packages/cli postinstall: Done
packages/actant postinstall: Done
Done in 20.1s

--- stderr ---
WARN using --force I sure hope you know what you are doing
WARN 2 deprecated subdependencies found: glob@10.5.0, node-domexception@1.0.0
```

#### Judgment: PASS
Workspace graph refreshed successfully and the new packages were linked into `packages/mcp-server/node_modules/@actant`.

### [Step 2] Targeted type-check for split packages and consumer
**Time**: 2026-03-17T10:24:00+08:00

#### Input
```powershell
pnpm --filter @actant/domain run type-check
pnpm --filter @actant/source run type-check
pnpm --filter @actant/vfs run type-check
pnpm --filter @actant/mcp-server run type-check
```

#### Output
```text
exit_code: 0

--- stdout ---
> @actant/domain@0.3.0 type-check ...
> tsc --noEmit

> @actant/source@0.3.0 type-check ...
> tsc --noEmit

> @actant/vfs@0.3.0 type-check ...
> tsc --noEmit

> @actant/mcp-server@0.3.0 type-check ...
> tsc --noEmit

--- stderr ---
(empty)
```

#### Judgment: PASS
The extracted packages and the `mcp-server` consumer all pass type-check after the dependency cutover.

### [Step 3] Emit package dist artifacts with TypeScript compiler
**Time**: 2026-03-17T10:25:00+08:00

#### Input
```powershell
.\node_modules\.bin\tsc.cmd -p packages/domain/tsconfig.json
.\node_modules\.bin\tsc.cmd -p packages/source/tsconfig.json
.\node_modules\.bin\tsc.cmd -p packages/vfs/tsconfig.json
```

#### Output
```text
exit_code: 0

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### Judgment: PASS
`tsup` is blocked by sandbox `spawn EPERM`, but plain `tsc` successfully emitted `dist/` output for the new packages, which is sufficient for workspace consumption and runtime verification.

### [Step 4] Run mcp-server regression tests
**Time**: 2026-03-17T10:26:06+08:00

#### Input
```powershell
pnpm --filter @actant/mcp-server run test
```

#### Output
```text
exit_code: 0

--- stdout ---
RUN v4.0.18 G:/Workspace/AgentWorkSpace/AgentCraft/packages/mcp-server
? src/context-backend.test.ts (2 tests) 17ms
Test Files 1 passed (1)
Tests 2 passed (2)
Duration 506ms

--- stderr ---
(empty)
```

#### Judgment: PASS
The existing `context-backend` regression tests still pass after moving the dependency surface off `@actant/core`.

### [Step 5] Standalone startup smoke test
**Time**: 2026-03-17T10:26:04+08:00

#### Input
```powershell
.\node_modules\.bin\tsx.cmd --eval "import('./packages/mcp-server/src/context-backend.ts').then(async (m) => { const ctx = await m.createStandaloneContext(process.cwd()); console.log(JSON.stringify({ mode: ctx.mode, projectRoot: ctx.projectRoot, configPath: ctx.configPath }, null, 2)); }).catch((err) => { console.error(err); process.exit(1); });"
```

#### Output
```text
exit_code: 0

--- stdout ---
{"level":"warn","name":"skill-manager","dir":"code-review-dir","msg":"Failed to load Skill from directory, skipping"}
{"level":"info","name":"skill-manager","count":3,"dirPath":"G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs\\skills","msg":"Skills loaded from directory"}
{"level":"info","name":"prompt-manager","count":1,"dirPath":"G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs\\prompts","msg":"Prompts loaded from directory"}
{"level":"info","name":"mcp-config-manager","count":1,"dirPath":"G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs\\mcp","msg":"McpServers loaded from directory"}
{"level":"info","name":"workflow-manager","count":1,"dirPath":"G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs\\workflows","msg":"Workflows loaded from directory"}
{"level":"info","name":"template-registry","count":1,"dirPath":"G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs\\templates","msg":"Templates loaded from directory"}
{"level":"info","name":"vfs-registry","name":"project","mountPoint":"/project","sourceType":"component-source","msg":"VFS source mounted"}
{"level":"info","name":"vfs-registry","name":"daemon","mountPoint":"/daemon","sourceType":"component-source","msg":"VFS source mounted"}
{"level":"info","name":"vfs-registry","name":"workspace","mountPoint":"/workspace","sourceType":"filesystem","msg":"VFS source mounted"}
{"level":"info","name":"vfs-registry","name":"config","mountPoint":"/config","sourceType":"filesystem","msg":"VFS source mounted"}
{"level":"info","name":"vfs-registry","name":"skill","mountPoint":"/skills","sourceType":"component-source","msg":"VFS source mounted"}
{"level":"info","name":"vfs-registry","name":"prompt","mountPoint":"/prompts","sourceType":"component-source","msg":"VFS source mounted"}
{"level":"info","name":"vfs-registry","name":"workflow","mountPoint":"/workflows","sourceType":"component-source","msg":"VFS source mounted"}
{"level":"info","name":"vfs-registry","name":"template","mountPoint":"/templates","sourceType":"component-source","msg":"VFS source mounted"}
{
  "mode": "standalone",
  "projectRoot": "G:\\Workspace\\AgentWorkSpace\\AgentCraft",
  "configPath": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\actant.project.json"
}

--- stderr ---
(empty)
```

#### Judgment: WARN
The standalone project-context backend starts successfully and mounts the expected VFS sources. One pre-existing warning remains during local skill directory loading: `configs/skills/code-review-dir` is treated as a directory-based skill but has no `manifest.json`.
