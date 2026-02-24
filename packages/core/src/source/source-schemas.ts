/**
 * Zod validation schemas for Source package components.
 * Used by SourceValidator to verify component data integrity.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared base: VersionedComponent fields
// ---------------------------------------------------------------------------

const VersionedComponentFields = {
  name: z.string().min(1, "name is required"),
  version: z.string().optional(),
  description: z.string().optional(),
  $type: z.string().optional(),
  $version: z.number().optional(),
  origin: z.object({
    type: z.enum(["builtin", "source", "local"]),
    sourceName: z.string().optional(),
    syncHash: z.string().optional(),
    syncedAt: z.string().optional(),
    modified: z.boolean().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
};

// ---------------------------------------------------------------------------
// PackageManifest (actant.json)
// ---------------------------------------------------------------------------

export const PackageManifestSchema = z.object({
  name: z.string().min(1, "name is required"),
  version: z.string().optional(),
  description: z.string().optional(),
  components: z.object({
    skills: z.array(z.string()).optional(),
    prompts: z.array(z.string()).optional(),
    mcp: z.array(z.string()).optional(),
    workflows: z.array(z.string()).optional(),
    templates: z.array(z.string()).optional(),
  }).optional(),
  presets: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Component schemas
// ---------------------------------------------------------------------------

export const SkillDefinitionSchema = z.object({
  ...VersionedComponentFields,
  content: z.string().min(1, "content is required"),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
});

export const PromptDefinitionSchema = z.object({
  ...VersionedComponentFields,
  content: z.string().min(1, "content is required"),
  variables: z.array(z.string()).optional(),
});

export const McpServerDefinitionSchema = z.object({
  ...VersionedComponentFields,
  command: z.string().min(1, "command is required"),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const WorkflowDefinitionSchema = z.object({
  ...VersionedComponentFields,
  content: z.string().min(1, "content is required"),
});

export const PresetDefinitionSchema = z.object({
  name: z.string().min(1, "name is required"),
  version: z.string().optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
  prompts: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  workflows: z.array(z.string()).optional(),
  templates: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Schema registry by component type
// ---------------------------------------------------------------------------

export const COMPONENT_SCHEMAS = {
  skills: SkillDefinitionSchema,
  prompts: PromptDefinitionSchema,
  mcp: McpServerDefinitionSchema,
  workflows: WorkflowDefinitionSchema,
  templates: null, // uses AgentTemplateSchema from template-schema.ts
  presets: PresetDefinitionSchema,
} as const;

export type ComponentType = keyof typeof COMPONENT_SCHEMAS;
