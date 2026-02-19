import { z } from "zod/v4";

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

export const AgentTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format (e.g. 1.0.0)"),
  description: z.string().optional(),
  backend: AgentBackendSchema,
  provider: ModelProviderSchema,
  domainContext: DomainContextSchema,
  initializer: InitializerSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type AgentTemplateInput = z.input<typeof AgentTemplateSchema>;
export type AgentTemplateOutput = z.output<typeof AgentTemplateSchema>;
