## Background

Pi deliberately does NOT build in MCP, sub-agents, plan mode, or permission popups - all via extensions. While Actant is a platform (not a tool) and needs more built-in features, Pi's philosophy suggests evaluating which features should be "core" vs "optional subsystem".

Actant already has a [Subsystem Design](docs/design/subsystem-design.md) blueprint referencing UE's hot-pluggable subsystem framework. This issue tracks actualizing that design.

## Current State: Everything Built-in

| Subsystem | Current Location | Used By |
|-----------|-----------------|---------|
| Scheduler/TaskQueue | core (19 files) | Only `employee` archetype |
| VFS | core | Optional, on-demand |
| Budget | core | Optional, via config |
| Activity/Journal | core + api | Optional, recording |
| Canvas | mcp-server (separate) | Already independent |
| MCP Server | mcp-server (separate) | Already independent |

## Proposed Change

Convert hardcoded subsystems to hot-pluggable pattern:
- [ ] Scheduler: Only activates for `employee` archetype
- [ ] VFS: Loads as Subsystem when mounted
- [ ] Budget: Enabled via SystemBudgetConfig
- [ ] Activity/Journal: Optional recording subsystem

Core retains only: **Agent lifecycle + Communication routing + Template/Instance management**

## Acceptance Criteria

- [ ] At least one subsystem (Scheduler) converted to hot-pluggable pattern
- [ ] Core can function without optional subsystems loaded
- [ ] No regression in existing functionality

## Priority

P2 - Medium-term, aligns with core package split (A1)

## Reference

- Pi: "No X - build it as extension" philosophy
- Actant: [subsystem-design.md](docs/design/subsystem-design.md) blueprint
