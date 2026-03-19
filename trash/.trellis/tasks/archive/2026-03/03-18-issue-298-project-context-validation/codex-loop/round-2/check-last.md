## Check Result
### Diff Summary
当前 diff 主要做了三件事：

- 扩展项目上下文协议与实现：
  - `packages/shared/src/types/project.types.ts`
  - `packages/shared/src/types/index.ts`
  - `packages/api/src/services/project-context.ts`
  - `packages/api/tsconfig.json`
  - `packages/api/package.json`
- 更新规范与默认仓库级项目配置：
  - `.trellis/spec/config-spec.md`
  - `.trellis/spec/api-contracts.md`
  - `actant.project.json`
- 补充仓库内项目上下文资产与测试：
  - `packages/mcp-server/src/context-backend.test.ts`
  - `PROJECT_CONTEXT.md`
  - `configs/skills/project-context-reader.json`
  - `configs/prompts/project-context-bootstrap.json`

实现层新增了 `/project/context.json` 中的 `entrypoints` 和 `available` 字段，并把 `actant.project.json` 里的 `entrypoints` 声明接入了 loader。

### Verification
我读取了本任务相关规范和任务文档：

- `.trellis/workflow.md`
- `.trellis/spec/index.md`
- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/config-spec.md`
- `.trellis/spec/api-contracts.md`
- `.trellis/tasks/03-18-issue-298-project-context-validation/prd.md`
- `.trellis/tasks/03-18-issue-298-project-context-validation/info.md`

我运行了这些校验：

- `pnpm --filter @actant/api run type-check`
  - 通过
- `pnpm --filter @actant/shared run type-check`
  - 通过
- `pnpm --filter @actant/mcp-server run type-check`
  - 通过
- `pnpm --filter @actant/mcp-server exec vitest run src/context-backend.test.ts`
  - 未能执行
  - 失败原因不是断言失败，而是当前环境在加载 `vitest/vite` 配置阶段触发 `spawn EPERM`

为替代 `vitest`，我用 `node --experimental-strip-types` 直接执行了 `packages/api/src/services/project-context.ts` 的最小行为验证：

- 临时项目目录下：
  - 能解析 `entrypoints.readFirst`
  - 能解析 `entrypoints.knowledge`
  - 能列出 `available.skills` / `available.prompts`
  - 缺失入口文件 warning 只出现一次，符合去重预期
- 当前仓库根目录下：
  - `loadProjectContext(process.cwd())` 返回了预期的 `entrypoints`
  - `available` 中包含新增的 `project-context-reader` 和 `project-context-bootstrap`
  - `sourceWarnings` 为空

### Self-fixes
无。没有发现适合在 check 阶段做的明显、小范围自修。

### Remaining Problems
- 缺少 issue #298 要求的“空目录 bootstrap 示例/fixture”。我搜索了工作树，没有找到已签入的最小示例目录或示例资产集；当前只有仓库自身资产和测试内临时目录构造，这不满足 PRD 里“check in a minimal example or fixture directory”的交付要求。
- 缺少 issue #298 要求的“validation document”。任务目录里目前只有 `prd.md`、`info.md` 和 jsonl 日志；`info.md` 也明确写着 `no issue-298-specific validation document exists yet`。当前新增的 `PROJECT_CONTEXT.md` 是知识入口，不是验证报告。
- 因此，本轮改动虽然把协议字段、仓库资产和核心 loader 行为补齐了一大部分，但还没有完成该任务的验收闭环，尤其是 PRD 的 D 和 F 两项。

### Marker
CODEX_LOOP_CHECK_FAIL