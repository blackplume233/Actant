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
  type: z.enum(["cursor", "claude-code", "custom"]),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const ModelProviderSchema = z.object({
  type: z.enum(["anthropic", "openai", "custom"]),
  config: z.record(z.string(), z.unknown()).optional(),
});

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
// Agent Template schema
// ---------------------------------------------------------------------------

export const AgentTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format (e.g. 1.0.0)"),
  description: z.string().optional(),
  backend: AgentBackendSchema,
  provider: ModelProviderSchema,
  domainContext: DomainContextSchema,
  permissions: PermissionsInputSchema.optional(),
  initializer: InitializerSchema.optional(),
  schedule: ScheduleConfigSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type AgentTemplateInput = z.input<typeof AgentTemplateSchema>;
export type AgentTemplateOutput = z.output<typeof AgentTemplateSchema>;
