# Test Optimization Issues

## Issue 1: Parallelize E2E tests to reduce execution time

### Description
Current E2E tests in `packages/cli/src/__tests__/e2e-cli.test.ts` execute serially, taking approximately 4 seconds to complete. This will become a bottleneck as the test suite grows.

### Evidence
From test output:
```
✓ packages/cli/src/__tests__/e2e-cli.test.ts (12 tests) 3973ms
```

### Suggested Solutions
1. Enable Vitest's parallel execution for E2E tests using `describe.concurrent()` or `test.concurrent()`
2. Ensure test isolation by using unique agent/template names per test (already partially done with temp directories)
3. Consider pooling the daemon instance across tests where appropriate

### Acceptance Criteria
- [ ] E2E test execution time reduced by 30-50%
- [ ] No flaky tests due to race conditions
- [ ] Test isolation maintained

### Files to Modify
- `packages/cli/src/__tests__/e2e-cli.test.ts`
- `vitest.config.ts` (if global config changes needed)

---

## Issue 2: Reduce pino log noise in test environments

### Description
Test output is cluttered with pino JSON logs, making it difficult to read test results:
```json
{"level":"info","time":"2026-02-20T02:22:24.847Z","pid":26801,...}
{"level":"warn","time":"2026-02-20T02:22:25.071Z","pid":26802,...}
```

### Suggested Solutions
1. Set `LOG_LEVEL=silent` or `LOG_LEVEL=error` in test environment by default
2. Use a pretty-print transport for tests if logs are needed for debugging
3. Configure Vitest to suppress stdout/stderr unless tests fail

### Implementation Options

#### Option A: Environment-based log level (Recommended)
```typescript
// packages/shared/src/logger/logger.ts
const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
```

#### Option B: Vitest config
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    silent: true, // or setupFiles to configure logging
  },
});
```

### Acceptance Criteria
- [ ] Test output is clean and readable by default
- [ ] Logs can be enabled via environment variable when debugging
- [ ] All existing tests continue to pass

### Files to Modify
- `packages/shared/src/logger/logger.ts`
- `vitest.config.ts` (optional)

---

## Issue 3: Replace 'as unknown as Type' assertions with proper type guards

### Description
Several locations in the codebase use `as unknown as Type` assertions, which bypass type safety.

### Locations Found

#### 1. Handler parameter casting
```typescript
// packages/api/src/handlers/agent-handlers.ts:32
const { name, template, overrides } = params as unknown as AgentCreateParams;
```

#### 2. Test fixtures
```typescript
// packages/core/src/template/schema/template-schema.test.ts:14
backend: { type: "claude-code" as const },
```

### Suggested Solutions

#### For handler params - Use Zod validation
```typescript
import { z } from "zod";

const AgentCreateParamsSchema = z.object({
  name: z.string(),
  template: z.string(),
  overrides: z.object({...}).optional(),
});

const parsed = AgentCreateParamsSchema.parse(params);
```

#### For test fixtures - Use satisfies operator
```typescript
backend: { type: "claude-code" } satisfies BackendConfig,
```

#### For RPC responses - Use generic type parameters with validation
```typescript
async call<T>(method: string, params?: unknown): Promise<T> {
  const response = await this.send(request);
  // validate response shape before returning
  return response.result as T; // single cast, not double
}
```

### Acceptance Criteria
- [ ] All `as unknown as` patterns reviewed and replaced where possible
- [ ] Runtime validation added for external inputs (RPC params, file content)
- [ ] Type safety maintained or improved
- [ ] No TypeScript errors introduced

### Files to Review
- `packages/api/src/handlers/*.ts`
- `packages/cli/src/client/rpc-client.ts`
- `packages/core/src/**/*.test.ts`
