import { z } from "zod/v4";

export const AgentStatusSchema = z.enum([
  "created",
  "starting",
  "running",
  "stopping",
  "stopped",
  "error",
  "crashed",
]);

export const LaunchModeSchema = z.enum([
  "direct",
  "acp-background",
  "normal",
  "one-shot",
]);

export const ProcessOwnershipSchema = z.enum(["managed", "external"]);

export const WorkspacePolicySchema = z.enum(["persistent", "ephemeral"]);

const AgentBackendTypeSchema = z.string().min(1);

const InteractionModeSchema = z.enum(["open", "start", "chat", "run", "proxy"]);

const PermissionModeSchema = z.enum([
  "default", "acceptEdits", "plan", "dontAsk", "bypassPermissions",
]);

const SandboxNetworkConfigSchema = z.object({
  allowedDomains: z.array(z.string()).optional(),
  allowLocalBinding: z.boolean().optional(),
});

const SandboxConfigSchema = z.object({
  enabled: z.boolean().optional(),
  autoAllowBashIfSandboxed: z.boolean().optional(),
  network: SandboxNetworkConfigSchema.optional(),
});

const PermissionsConfigSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
  defaultMode: PermissionModeSchema.optional(),
  sandbox: SandboxConfigSchema.optional(),
  additionalDirectories: z.array(z.string()).optional(),
});

const ModelApiProtocolSchema = z.enum(["openai", "anthropic", "custom"]);

const ModelProviderConfigSchema = z.object({
  type: z.string().min(1),
  protocol: ModelApiProtocolSchema.optional().default("custom"),
  baseUrl: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const AgentInstanceMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  templateName: z.string().min(1),
  templateVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  backendType: AgentBackendTypeSchema.default("cursor"),
  backendConfig: z.record(z.string(), z.unknown()).optional(),
  interactionModes: z.array(InteractionModeSchema).default(["start"]),
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
});
