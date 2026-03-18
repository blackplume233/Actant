# Code Review

Review changed code with a bias toward simplicity, repository alignment, and readable implementation. Do not stop at correctness alone.

## Scope

1. Collect changed files.
   ```bash
   git diff main...HEAD --name-only
   ```

2. Focus on:
   - source files (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.py`, etc.)
   - tests (`*.test.*`, `*.spec.*`, `__tests__/`)
   - any spec, contract, or workflow docs touched by the change

## Review Order

### 1. Expected Behavior Alignment

Establish what the repository expects before judging the implementation:

- Read the relevant issue, task, spec, contract, README section, tests, and nearby code.
- Infer the intended behavior and constraints from existing patterns.
- Flag mismatches between the implemented behavior and the repository's expected direction.
- Flag silent scope expansion, missing acceptance criteria, or behavior changes not reflected in tests/docs.
- If intent is ambiguous, state the assumption explicitly instead of inventing approval criteria.

### 2. Design Simplicity And Redundancy

Review the design with strong pressure toward minimal, direct solutions:

- Prefer the simplest design that fits the repository's existing architecture.
- Flag unnecessary abstraction layers, wrapper functions, indirection, speculative extensibility, and pass-through helpers.
- Flag duplicated logic, repeated transformation pipelines, parallel code paths, and copy-pasted condition handling.
- Check whether existing utilities, shared types, or established patterns should have been reused.
- Call out designs that technically work but make future changes harder than necessary.

### 3. Code Hygiene And Readability

Audit for bad habits that reduce maintainability:

- Avoid inline imports unless there is a clear runtime or bundling reason.
- Avoid magic strings and magic numbers; prefer named constants, enums, maps, or well-scoped configuration.
- Flag ambiguous naming, hidden side effects, overly long functions, deep nesting, and mixed responsibilities.
- Check whether control flow is easy to follow without mentally executing multiple branches.
- Ensure comments clarify non-obvious intent rather than restating the code.

### 4. Correctness, Contracts, And Tests

- Check type safety and contract consistency.
- Check error handling and failure modes.
- Check boundary conditions, edge cases, and negative-path behavior.
- Verify tests cover the real behavior, not just happy-path execution.
- Ensure tests and docs still match the implementation after the change.

## Output Format

### If review passes

```markdown
# Code Review Report - PASSED

## Change Summary
- Files reviewed: X
- Source files: X
- Test files: X

## Expected Behavior
<What the repository appears to expect from this change>

## Alignment Check
- [OK] Implementation matches repository intent
- [OK] No unplanned scope expansion

## Design Assessment
- [OK] Design is simple enough for current needs
- [OK] No meaningful redundancy found

## Hygiene Assessment
- [OK] No major readability issues
- [OK] No problematic inline imports or magic strings

## Test Assessment
- [OK] Coverage is sufficient for the changed behavior

## Summary
<Short conclusion>
```

### If issues are found

```markdown
# Code Review Report - ISSUES FOUND

## Critical Findings

### 1. [file path]
**Problem**: <Concrete problem>
**Why it matters**: <Impact on correctness, maintainability, or alignment>
**Recommendation**: <Specific fix>

## Major Findings

### 2. [file path]
**Problem**: <Concrete problem>
**Why it matters**: <Impact>
**Recommendation**: <Specific fix>

## Minor Findings

### 3. [file path]
**Problem**: <Concrete problem>
**Recommendation**: <Specific fix or cleanup direction>

## Alignment Notes
- Expected behavior: <What the repo appears to require>
- Divergence: <Where the implementation differs>

## Design Notes
- Redundancy or over-design: <List>

## Hygiene Notes
- Inline imports: <List if any>
- Magic strings / numbers: <List if any>
- Readability issues: <List if any>

## Fix Checklist
- [ ] Fix critical and major findings
- [ ] Recheck alignment with repository intent
- [ ] Remove unnecessary indirection or duplication
- [ ] Clean up readability hazards
```

## Execution Notes

1. Establish expected behavior from repo context first.
2. Review every changed file against that expectation.
3. Prioritize simplicity, redundancy removal, and readability.
4. Treat inline imports, magic strings, and similar habits as review targets by default.
5. Output findings with clear severity, file references, and concrete fixes.
