---
id: 275
title: "build: fix intermittent workspace type-check resolution for @actant/shared declarations"
status: closed
labels: []
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#275"
closedAs: completed
createdAt: "2026-03-10T17:02:39Z"
updatedAt: "2026-03-18T06:39:11"
closedAt: "2026-03-18T06:36:45Z"
---

## Summary
Multiple recent implementation tasks (`#265`, `#266`, `#268`, `#273`) hit the same recurring monorepo engineering problem: package-local `tsc --noEmit` sometimes fails to resolve `@actant/shared` declarations even after the shared package has been rebuilt successfully.

## Symptoms
Observed repeatedly in package-local checks such as:
- `pnpm --filter @actant/api type-check`
- `pnpm --filter @actant/acp type-check`

Typical failure shape:
- `Could not find a declaration file for module '@actant/shared'`
- points at `packages/shared/dist/index.js` while `packages/shared/dist/index.d.ts` does exist

## Why this matters
This is not a single-feature bug. It creates repeated engineering drag and makes otherwise-correct changes look broken at the package type-check layer.
It also encourages workaround behavior (manual rebuilds, sequencing assumptions) instead of a stable monorepo contract.

## Evidence
Recent work where this recurred:
- shared RPC transport refactor (#265)
- structured session / ACP error work (#266 / #268)
- webhook event ingress fix (#273)

In each case:
- runtime/tests/lint were correct
- generated shared declarations existed
- package-local type-check still intermittently failed to resolve `@actant/shared`

## Recommended direction
Audit the monorepo package resolution/build contract for workspace packages, especially:
- `package.json` exports + types fields
- tsconfig project references
- `moduleResolution: bundler`
- tsup declaration emission timing and path layout

Goal: make package-local type-checks reliably consume workspace declaration outputs without requiring ad hoc rebuild sequencing.
