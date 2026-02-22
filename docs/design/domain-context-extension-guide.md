# DomainContext Extension Guide

> **Version**: v1 | **Date**: 2026-02-22 | **Related Issue**: #54
>
> A comprehensive guide for adding new DomainContext component types to Actant.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Step-by-Step Checklist](#2-step-by-step-checklist)
3. [Naming Conventions](#3-naming-conventions)
4. [Schema Synchronization Rules](#4-schema-synchronization-rules)
5. [Testing Requirements](#5-testing-requirements)
6. [ComponentTypeHandler Pattern (Implemented)](#6-componenttypehandler-pattern-implemented)

---

## 1. Overview

### What is a DomainContext Component Type?

In Actant, **DomainContext** defines the capabilities and configuration that make up an Agent. Component types are the building blocks of this context:

| Component Type | Purpose |
|----------------|---------|
| **Skills** | Rules and knowledge the Agent should follow |
| **Prompts** | System instructions and instruction sets |
| **Workflows** | Development process templates (e.g. workflow.md) |
| **MCP Servers** | Tool integrations (Model Context Protocol) |
| **Plugins** | Capability extensions (npm packages, local files) |
| **SubAgents** | References to child agents (names only, not materialized) |

Each component type follows a four-phase lifecycle:

```
Define → Register → Resolve → Materialize
```

| Phase | Description |
|-------|--------------|
| **Define** | TypeScript interface + JSON schema for the component definition |
| **Register** | Loaded into a Manager at startup from `configs/{type}/` |
| **Resolve** | Template references names; Manager resolves to full definitions |
| **Materialize** | BackendBuilder writes definitions into Agent workspace files |

When adding a new type (e.g. `datasets`), you must implement all four phases across shared types, core managers, builders, and API wiring.

---

## 2. Step-by-Step Checklist

When adding a new component type (e.g. `datasets`), modify these files in order:

| Step | File | What to change |
|------|------|----------------|
| 1 | `packages/shared/src/types/domain-component.types.ts` | Add `DatasetDefinition extends VersionedComponent` interface |
| 2 | `packages/shared/src/types/domain-context.types.ts` | Add `datasets?: string[]` to `DomainContextConfig` |
| 3 | `packages/shared/src/types/index.ts` | Export the new type |
| 4 | `packages/core/src/template/schema/template-schema.ts` | Add `datasets: z.array(z.string()).optional().default([])` to `DomainContextSchema` |
| 5 | `packages/core/src/domain/dataset/dataset-manager.ts` | Create a new Manager extending `BaseComponentManager<DatasetDefinition>` with a `validate()` implementation |
| 6 | `packages/core/src/builder/handlers/datasets-handler.ts` | Create a `ComponentTypeHandler<DatasetDefinition>` and register in `WorkspaceBuilder` constructor |
| 7 | `packages/core/src/builder/backend-builder.ts` | Add `materializeDatasets(workspaceDir: string, datasets: DatasetDefinition[]): Promise<void>` to `BackendBuilder` interface |
| 8 | `packages/core/src/builder/cursor-builder.ts` | Implement `materializeDatasets()` |
| 9 | `packages/core/src/builder/claude-code-builder.ts` | Implement `materializeDatasets()` |
| 10 | `packages/api/src/services/app-context.ts` | Create DatasetManager instance, add to DomainManagers, load from `configs/datasets/` |
| 11 | Test files | At minimum: `dataset-manager.test.ts`, update `workspace-builder.test.ts`, update builder tests |

### Step 1: Define the component interface

```typescript
// packages/shared/src/types/domain-component.types.ts

export interface DatasetDefinition extends VersionedComponent {
  /** Path or URL to the dataset */
  source: string;
  /** Optional format hint */
  format?: "json" | "csv" | "jsonl";
}
```

### Step 2: Add to DomainContextConfig

```typescript
// packages/shared/src/types/domain-context.types.ts

export interface DomainContextConfig {
  skills?: string[];
  prompts?: string[];
  mcpServers?: McpServerRef[];
  workflow?: string;
  subAgents?: string[];
  plugins?: string[];
  datasets?: string[];  // NEW
  extensions?: Record<string, unknown[]>;
}
```

### Step 3: Export from shared types

```typescript
// packages/shared/src/types/index.ts
export type { ..., DatasetDefinition } from "./domain-component.types";
```

### Step 4: Add to DomainContextSchema

```typescript
// packages/core/src/template/schema/template-schema.ts

export const DomainContextSchema = z.object({
  // ...existing fields
  datasets: z.array(z.string()).optional().default([]),
});
```

### Step 5: Create the Manager

```typescript
// packages/core/src/domain/dataset/dataset-manager.ts

import { z } from "zod/v4";
import type { DatasetDefinition } from "@actant/shared";
import { ConfigValidationError } from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";

const DatasetDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  source: z.string().min(1),
  format: z.enum(["json", "csv", "jsonl"]).optional(),
});

export class DatasetManager extends BaseComponentManager<DatasetDefinition> {
  protected readonly componentType = "Dataset";

  constructor() {
    super("dataset-manager");
  }

  validate(data: unknown, source: string): DatasetDefinition {
    const result = DatasetDefinitionSchema.safeParse(data);
    if (!result.success) {
      throw new ConfigValidationError(
        `Invalid dataset definition in ${source}`,
        result.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
      );
    }
    return result.data;
  }
}
```

### Step 6: Create a ComponentTypeHandler

```typescript
// packages/core/src/builder/handlers/datasets-handler.ts
import type { ComponentTypeHandler } from "../component-type-handler";
import type { DatasetDefinition } from "@actant/shared";
import type { BaseComponentManager, NamedComponent } from "../../domain/base-component-manager";
import type { BackendBuilder } from "../backend-builder";

export const datasetsHandler: ComponentTypeHandler<DatasetDefinition> = {
  contextKey: "datasets",
  resolve(refs, manager) {
    if (!refs || !Array.isArray(refs) || refs.length === 0) return [];
    return manager!.resolve(refs as string[]) as DatasetDefinition[];
  },
  async materialize(workspaceDir, definitions, _backendType, builder) {
    await (builder as BackendBuilder).materializeDatasets(workspaceDir, definitions);
  },
};
```

Then register in `WorkspaceBuilder` constructor or via `registerHandler()` at app init.

### Step 7–9: Implement materialization in builders

Each `BackendBuilder` implementation must handle the new type. For Cursor, Claude Code, or custom backends, implement the appropriate file layout (e.g. `datasets/` directory with manifest files).

### Step 10: Wire into AppContext

```typescript
// packages/api/src/services/app-context.ts

this.datasetManager = new DatasetManager();
// Add to domainManagers passed to AgentInitializer
// Add { manager: this.datasetManager, sub: "datasets" } to loadDomainComponents()
```

### Step 11: Add tests

- **Manager**: `dataset-manager.test.ts` — register/unregister, resolve, validate, loadFromDirectory, CRUD, search
- **Builder**: Update `workspace-builder.test.ts` to cover datasets resolve + materialize
- **Regression**: Ensure `workspace-builder.test.ts` and `context-materializer.test.ts` still pass

---

## 3. Naming Conventions

| Concept | Convention | Example |
|---------|-------------|---------|
| Type interface | `{Type}Definition` | `DatasetDefinition` |
| Manager class | `{Type}Manager` | `DatasetManager` |
| Manager directory | `packages/core/src/domain/{type}/` | `packages/core/src/domain/dataset/` |
| DomainContextConfig field | camelCase plural | `datasets` |
| DomainContextSchema field | same as config field | `datasets` |
| BackendBuilder method | `materialize{Types}` | `materializeDatasets` |
| Config directory | `configs/{types}/` | `configs/datasets/` |
| Config file | `{name}.json` | `configs/datasets/my-dataset.json` |

---

## 4. Schema Synchronization Rules

- **TypeScript types** in `packages/shared/` are the source of truth
- **Zod schemas** in `packages/core/src/template/schema/` must mirror them exactly
- For optional array fields, use `.optional().default([])`
- For optional scalar fields, use `.optional()`
- After changing shared types, rebuild: `pnpm --filter @actant/shared build`

---

## 5. Testing Requirements

### Manager unit tests

- `register` / `unregister`
- `resolve` (including `ComponentReferenceError` for missing names)
- `validate` (valid and invalid input)
- `loadFromDirectory` (success, ENOENT, invalid JSON)
- CRUD: `add`, `update`, `remove` (with and without persist)
- `search` / `filter`

### Builder integration tests

- Verify the new type's definitions are correctly materialized into the workspace
- Test resolve path when manager is present vs. absent (placeholder behavior)

### Regression

- `workspace-builder.test.ts` must still pass
- `context-materializer.test.ts` must still pass

---

## 6. ComponentTypeHandler Pattern (Implemented)

> **Related**: Issue #54 code phase — **Completed**

`WorkspaceBuilder` now uses a **`ComponentTypeHandler<T>`** registration pattern instead of hardcoded if-branches. All 5 built-in component types (skills, prompts, mcpServers, workflow, plugins) are implemented as handlers registered in the constructor.

To add a new type, you only need to:

1. Create a handler implementing `ComponentTypeHandler<T>` (see `packages/core/src/builder/handlers/` for examples)
2. Register it with `WorkspaceBuilder.registerHandler(handler)`

No changes to `WorkspaceBuilder` core code are required.

### Handler interface

```typescript
// packages/core/src/builder/component-type-handler.ts
export interface ComponentTypeHandler<TDef = unknown> {
  readonly contextKey: string;
  resolve(refs: unknown, manager?: BaseComponentManager<NamedComponent>): TDef[];
  materialize(workspaceDir: string, definitions: TDef[], backendType: AgentBackendType, backendBuilder: unknown): Promise<void>;
}
```

### Extensions field

`DomainContextConfig.extensions` provides an extension point for custom component types. It is fully wired through the resolve/materialize pipeline — any handler whose `contextKey` matches an extension key will process it:

```typescript
domainContext: {
  skills: ["code-review"],
  extensions: {
    datasets: ["my-experimental-dataset"],
  },
}
```

Register a handler with `contextKey: "datasets"` and the WorkspaceBuilder will automatically resolve and materialize it.

---

## Quick Reference

| Action | Command |
|--------|---------|
| Rebuild shared after type changes | `pnpm --filter @actant/shared build` |
| Run workspace builder tests | `pnpm --filter @actant/core test workspace-builder` |
| Run context materializer tests | `pnpm --filter @actant/core test context-materializer` |
