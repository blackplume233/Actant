# Actant v0.2.2 — Config Schemas Snapshot

## Zod Schemas (template-schema.ts, instance-meta-schema.ts, schedule-config.ts)

### McpServerRefSchema
```ts
z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
})
```

### DomainContextSchema
```ts
z.object({
  skills: z.array(z.string()).optional().default([]),
  prompts: z.array(z.string()).optional().default([]),
  mcpServers: z.array(McpServerRefSchema).optional().default([]),
  workflow: z.string().optional(),
  subAgents: z.array(z.string()).optional().default([]),
  plugins: z.array(z.string()).optional().default([]),
  extensions: z.record(z.string(), z.array(z.unknown())).optional(),
})
```

### AgentBackendSchema
```ts
z.object({
  type: z.enum(["cursor", "cursor-agent", "claude-code", "custom", "pi"]),
  config: z.record(z.string(), z.unknown()).optional(),
})
```

### ModelProviderSchema
```ts
z.object({
  type: z.string().min(1),
  protocol: z.enum(["openai", "anthropic", "custom"]).optional(),
  baseUrl: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})
// Transforms: protocol defaults from type (anthropic→anthropic, openai→openai, etc.)
```

### InitializerStepSchema / InitializerSchema
```ts
InitializerStepSchema: z.object({
  type: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
})
InitializerSchema: z.object({
  steps: z.array(InitializerStepSchema).min(1),
})
```

### Permissions Schemas
```ts
PermissionModeSchema: z.enum(["default", "acceptEdits", "plan", "dontAsk", "bypassPermissions"])
SandboxNetworkSchema: z.object({
  allowedDomains: z.array(z.string()).optional(),
  allowLocalBinding: z.boolean().optional(),
})
SandboxSchema: z.object({
  enabled: z.boolean().optional().default(false),
  autoAllowBashIfSandboxed: z.boolean().optional().default(false),
  network: SandboxNetworkSchema.optional(),
})
PermissionsObjectSchema: z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
  defaultMode: PermissionModeSchema.optional(),
  sandbox: SandboxSchema.optional(),
  additionalDirectories: z.array(z.string()).optional(),
})
PermissionPresetSchema: z.enum(["permissive", "standard", "restricted", "readonly"])
PermissionsInputSchema: z.union([PermissionPresetSchema, PermissionsObjectSchema])
```

### ComponentOriginSchema
```ts
z.object({
  type: z.enum(["builtin", "source", "local"]),
  sourceName: z.string().optional(),
  syncHash: z.string().optional(),
  syncedAt: z.string().optional(),
  modified: z.boolean().optional(),
})
```

### AgentTemplateSchema
```ts
z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format (e.g. 1.0.0)"),
  description: z.string().optional(),
  $type: z.string().optional(),
  $version: z.number().optional(),
  origin: ComponentOriginSchema.optional(),
  tags: z.array(z.string()).optional(),
  backend: AgentBackendSchema,
  provider: ModelProviderSchema.optional(),
  domainContext: DomainContextSchema,
  permissions: PermissionsInputSchema.optional(),
  initializer: InitializerSchema.optional(),
  schedule: ScheduleConfigSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})
```

### AgentInstanceMetaSchema (instance-meta-schema.ts)
```ts
z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  templateName: z.string().min(1),
  templateVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  backendType: z.string().min(1).default("cursor"),
  backendConfig: z.record(z.string(), z.unknown()).optional(),
  providerConfig: ModelProviderConfigSchema.optional(),
  status: AgentStatusSchema,
  launchMode: LaunchModeSchema,
  workspacePolicy: WorkspacePolicySchema.default("persistent"),
  processOwnership: ProcessOwnershipSchema.default("managed"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pid: z.number().int().positive().optional(),
  effectivePermissions: PermissionsConfigSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})
// Enums: AgentStatus, LaunchMode, ProcessOwnership, WorkspacePolicy
```

### ScheduleConfigSchema (schedule-config.ts)
```ts
HeartbeatConfigSchema: z.object({
  intervalMs: z.number().min(1000),
  prompt: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
})
CronConfigSchema: z.object({
  pattern: z.string().min(1),
  prompt: z.string().min(1),
  timezone: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
})
HookConfigSchema: z.object({
  eventName: z.string().min(1),
  prompt: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
})
ScheduleConfigSchema: z.object({
  heartbeat: HeartbeatConfigSchema.optional(),
  cron: z.array(CronConfigSchema).optional().default([]),
  hooks: z.array(HookConfigSchema).optional().default([]),
})
```

---

## TypeScript Interfaces

### VersionedComponent (domain-component.types.ts)
Base for all shareable components.
```ts
interface VersionedComponent {
  name: string;
  version?: string;
  description?: string;
  $type?: string;
  $version?: number;
  origin?: ComponentOrigin;
  tags?: string[];
}
```

### ComponentOrigin
```ts
type ComponentOriginType = "builtin" | "source" | "local";
interface ComponentOrigin {
  type: ComponentOriginType;
  sourceName?: string;
  syncHash?: string;
  syncedAt?: string;
  modified?: boolean;
}
```

### AgentTemplate (template.types.ts)
```ts
interface AgentTemplate extends VersionedComponent {
  version: string;  // Required override
  backend: AgentBackendConfig;
  provider?: ModelProviderConfig;
  domainContext: DomainContextConfig;
  permissions?: PermissionsInput;
  initializer?: InitializerConfig;
  schedule?: {
    heartbeat?: { intervalMs: number; prompt: string; priority?: string };
    cron?: Array<{ pattern: string; prompt: string; timezone?: string; priority?: string }>;
    hooks?: Array<{ eventName: string; prompt: string; priority?: string }>;
  };
  metadata?: Record<string, string>;
}
```

### AgentBackendConfig
```ts
interface AgentBackendConfig {
  type: AgentBackendType;
  config?: Record<string, unknown>;
}
type KnownBackendType = "cursor" | "cursor-agent" | "claude-code" | "custom" | "pi";
type AgentBackendType = KnownBackendType | (string & {});
```

### ModelProviderConfig
```ts
interface ModelProviderConfig {
  type: string;
  protocol?: ModelApiProtocol;
  baseUrl?: string;
  config?: Record<string, unknown>;
}
type ModelApiProtocol = "openai" | "anthropic" | "custom";
```

### InitializerConfig
```ts
interface InitializerConfig {
  steps: InitializerStep[];
}
interface InitializerStep {
  type: string;
  config?: Record<string, unknown>;
}
```

### Permissions (template.types.ts)
```ts
type PermissionMode = "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions";
type PermissionPreset = "permissive" | "standard" | "restricted" | "readonly";
interface SandboxNetworkConfig {
  allowedDomains?: string[];
  allowLocalBinding?: boolean;
}
interface SandboxConfig {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  network?: SandboxNetworkConfig;
}
interface PermissionsConfig {
  allow?: string[];
  deny?: string[];
  ask?: string[];
  defaultMode?: PermissionMode;
  sandbox?: SandboxConfig;
  additionalDirectories?: string[];
}
type PermissionsInput = PermissionPreset | PermissionsConfig;
```

### AgentInstanceMeta (agent.types.ts)
```ts
interface AgentInstanceMeta {
  id: string;
  name: string;
  templateName: string;
  templateVersion: string;
  backendType: AgentBackendType;
  backendConfig?: Record<string, unknown>;
  providerConfig?: ModelProviderConfig;
  status: AgentStatus;
  launchMode: LaunchMode;
  workspacePolicy: WorkspacePolicy;
  processOwnership: ProcessOwnership;
  createdAt: string;
  updatedAt: string;
  pid?: number;
  effectivePermissions?: PermissionsConfig;
  metadata?: Record<string, string>;
}
type AgentStatus = "created" | "starting" | "running" | "stopping" | "stopped" | "error" | "crashed";
type LaunchMode = "direct" | "acp-background" | "acp-service" | "one-shot";
type ProcessOwnership = "managed" | "external";
type WorkspacePolicy = "persistent" | "ephemeral";
```

### ResolveResult / DetachResult
```ts
interface ResolveResult {
  workspaceDir: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  instanceName: string;
  backendType: AgentBackendType;
  created: boolean;
  resolvePackage?: string;
}
interface DetachResult {
  ok: boolean;
  workspaceCleaned: boolean;
}
```

### Domain Component Types (domain-component.types.ts)
```ts
interface SkillDefinition extends VersionedComponent {
  content: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
}
interface PromptDefinition extends VersionedComponent {
  content: string;
  variables?: string[];
}
interface WorkflowDefinition extends VersionedComponent {
  content: string;
}
interface McpServerDefinition extends VersionedComponent {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
interface PluginDefinition extends VersionedComponent {
  type: "npm" | "file" | "config";
  source?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}
```

### DomainContextConfig (domain-context.types.ts)
```ts
interface DomainContextConfig {
  skills?: string[];
  prompts?: string[];
  mcpServers?: McpServerRef[];
  workflow?: string;
  subAgents?: string[];
  plugins?: string[];
  extensions?: Record<string, unknown[]>;
}
interface McpServerRef {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```

### Source Types (source.types.ts)
```ts
type SourceConfig = GitHubSourceConfig | LocalSourceConfig;
interface GitHubSourceConfig {
  type: "github";
  url: string;
  branch?: string;
}
interface LocalSourceConfig {
  type: "local";
  path: string;
}
interface SourceEntry {
  name: string;
  config: SourceConfig;
  syncedAt?: string;
}
interface PackageManifest {
  name: string;
  version?: string;
  description?: string;
  components?: {
    skills?: string[];
    prompts?: string[];
    mcp?: string[];
    workflows?: string[];
    templates?: string[];
    backends?: string[];
  };
  presets?: string[];
}
interface PresetDefinition {
  name: string;
  version?: string;
  description?: string;
  skills?: string[];
  prompts?: string[];
  mcpServers?: string[];
  workflows?: string[];
  templates?: string[];
}
```
