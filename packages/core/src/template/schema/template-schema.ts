import { z } from "zod/v4";
import { ScheduleConfigSchema } from "../../scheduler/schedule-config";

export const McpServerRefSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
});

export const DomainContextSchema = z.object({
  skills: z.array(z.string()).optional().default([]),
  prompts: z.array(z.string()).optional().default([]),
  mcpServers: z.array(McpServerRefSchema).optional().default([]),
  workflow: z.string().optional(),
  subAgents: z.array(z.string()).optional().default([]),
  plugins: z.array(z.string()).optional().default([]),
  extensions: z.record(z.string(), z.array(z.unknown())).optional(),
});

export const AgentBackendSchema = z.object({
  type: z.enum(["cursor", "cursor-agent", "claude-code", "custom", "pi"]),
  config: z.record(z.string(), z.unknown()).optional(),
});

const ModelApiProtocolEnum = z.enum(["openai", "anthropic", "custom"]);

type ApiProtocol = z.infer<typeof ModelApiProtocolEnum>;

/**
 * Default API protocol for well-known built-in provider types.
 * Used as fallback when `protocol` is omitted in a template.
 * For providers not in this map, protocol defaults to "custom".
 */
const DEFAULT_PROTOCOL: Record<string, ApiProtocol> = {
  anthropic: "anthropic",
  openai: "openai",
  deepseek: "openai",
  ollama: "openai",
  azure: "openai",
  bedrock: "anthropic",
  vertex: "anthropic",
  custom: "custom",
};

export const ModelProviderSchema = z
  .object({
    type: z.string().min(1),
    protocol: ModelApiProtocolEnum.optional(),
    baseUrl: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((val) => ({
    ...val,
    protocol: (val.protocol ?? DEFAULT_PROTOCOL[val.type] ?? "custom") as ApiProtocol,
  }));

export const InitializerStepSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const InitializerSchema = z.object({
  steps: z.array(InitializerStepSchema).min(1),
});

// ---------------------------------------------------------------------------
// Permissions schema — aligned with Claude Code permissions structure (#51)
// ---------------------------------------------------------------------------

export const PermissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
]);

export const SandboxNetworkSchema = z.object({
  allowedDomains: z.array(z.string()).optional(),
  allowLocalBinding: z.boolean().optional(),
});

export const SandboxSchema = z.object({
  enabled: z.boolean().optional().default(false),
  autoAllowBashIfSandboxed: z.boolean().optional().default(false),
  network: SandboxNetworkSchema.optional(),
});

export const PermissionsObjectSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
  defaultMode: PermissionModeSchema.optional(),
  sandbox: SandboxSchema.optional(),
  additionalDirectories: z.array(z.string()).optional(),
});

export const PermissionPresetSchema = z.enum([
  "permissive",
  "standard",
  "restricted",
  "readonly",
]);

/** Accepts either a preset string or a full permissions object. */
export const PermissionsInputSchema = z.union([
  PermissionPresetSchema,
  PermissionsObjectSchema,
]);

// ---------------------------------------------------------------------------
// Component origin schema — shared VersionedComponent envelope fields (#119)
// ---------------------------------------------------------------------------

export const ComponentOriginSchema = z.object({
  type: z.enum(["builtin", "source", "local"]),
  sourceName: z.string().optional(),
  syncHash: z.string().optional(),
  syncedAt: z.string().optional(),
  modified: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Agent Template schema — includes VersionedComponent fields (#119)
// ---------------------------------------------------------------------------

export const AgentTemplateSchema = z.object({
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
});

export type AgentTemplateInput = z.input<typeof AgentTemplateSchema>;
export type AgentTemplateOutput = z.output<typeof AgentTemplateSchema>;
