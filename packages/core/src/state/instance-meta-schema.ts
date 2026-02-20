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
  "acp-service",
  "one-shot",
]);

export const ProcessOwnershipSchema = z.enum(["managed", "external"]);

export const WorkspacePolicySchema = z.enum(["persistent", "ephemeral"]);

const AgentBackendTypeSchema = z.enum(["cursor", "claude-code", "custom"]);

export const AgentInstanceMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  templateName: z.string().min(1),
  templateVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  backendType: AgentBackendTypeSchema.optional(),
  backendConfig: z.record(z.string(), z.unknown()).optional(),
  status: AgentStatusSchema,
  launchMode: LaunchModeSchema,
  workspacePolicy: WorkspacePolicySchema.optional(),
  processOwnership: ProcessOwnershipSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pid: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});
