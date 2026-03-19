# Changelog v0.2.5

> v0.2.4 → v0.2.5 | 2026-02-27

## Features

- **dashboard**: add toast notifications, agent error display and retry actions (c9d5dd2)

## Bug Fixes

- **core**: Round 5 hardening — buffer DoS guards, UTF-8 safe truncation, parameter validation (fda4558)
- **core**: Step 3b ToolRegistry hardening — 22 bugs fixed across 5 packages (#226, #227, #229, #230, #231, #232, #233, #234, #235, #236, #237) (b255b57)

## Documentation

- **spec**: update config-spec archetype descriptions for repo and service tiers (03af6b8)
- update README and landing page for v0.2.4 (047bad6)

## Style

- **core**: replace non-null assertions with type narrowing in agent-manager (f61e0c8)

## Merges

- PR #222 - fix(core): enable PI agent chat + Dashboard enhancements (#220, #221) (fc4a049)

## Other

- ﻿docs(spec): capture PI agent QA findings -- timeout tiers, ACP PID tracking, Dashboard chat path (07f3781)
- ﻿fix(core): enable PI agent chat -- interactionModes, ACP PID tracking, prompt timeout (acb9587)

## Uncommitted (to be committed with this stage)

- **#228** Agent archetype reclassification: `tool | employee | service` → `repo | service | employee`
  - Reclassified by management depth (repo < service < employee)
  - Introduced ToolScope hierarchical model for tool access filtering
  - Expanded Canvas access from employee-only to service + employee
  - Backward-compatible migration: legacy `tool` → `repo` via Zod transform
  - Updated CLI validation, Dashboard styling, and all test fixtures
  - Updated spec docs (config-spec, agent-lifecycle, api-contracts)

---

**Full diff**: v0.2.4..v0.2.5
