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
    backends: z.array(z.string()).optional(),
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
  content: z.string().min(1).optional(),
  hooks: z.array(z.object({
    on: z.string().min(1),
    description: z.string().optional(),
    allowedCallers: z.array(z.string()).optional(),
    actions: z.array(z.object({
      type: z.enum(["shell", "builtin", "agent"]),
    }).passthrough()).min(1),
  })).optional(),
  enabled: z.boolean().optional(),
  level: z.enum(["actant", "instance"]).optional(),
});

const PlatformCommandSchema = z.object({
  win32: z.string().min(1),
  default: z.string().min(1),
});

export const SourceBackendDefinitionSchema = z.object({
  ...VersionedComponentFields,
  supportedModes: z.array(z.enum(["resolve", "open", "acp"])).min(1),
  resolveCommand: PlatformCommandSchema.optional(),
  openCommand: PlatformCommandSchema.optional(),
  acpCommand: PlatformCommandSchema.optional(),
  acpOwnsProcess: z.boolean().optional(),
  resolvePackage: z.string().optional(),
  openWorkspaceDir: z.enum(["arg", "cwd"]).optional(),
  openSpawnOptions: z.object({
    stdio: z.enum(["inherit", "ignore"]).optional(),
    detached: z.boolean().optional(),
    windowsHide: z.boolean().optional(),
    shell: z.boolean().optional(),
  }).optional(),
  existenceCheck: z.object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    expectedExitCode: z.number().int().optional(),
    versionPattern: z.string().optional(),
  }).optional(),
  install: z.array(z.object({
    type: z.enum(["npm", "brew", "winget", "choco", "url", "manual"]),
    package: z.string().optional(),
    platforms: z.array(z.string()).optional(),
    label: z.string().optional(),
    instructions: z.string().optional(),
  })).optional(),
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
  backends: SourceBackendDefinitionSchema,
  templates: null, // uses AgentTemplateSchema from template-schema.ts
  presets: PresetDefinitionSchema,
} as const;

export type ComponentType = keyof typeof COMPONENT_SCHEMAS;
