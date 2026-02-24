import { z } from "zod/v4";

const PlatformCommandSchema = z.object({
  win32: z.string().min(1),
  default: z.string().min(1),
});

const OpenSpawnOptionsSchema = z.object({
  stdio: z.enum(["inherit", "ignore"]).optional(),
  detached: z.boolean().optional(),
  windowsHide: z.boolean().optional(),
  shell: z.boolean().optional(),
});

const ExistenceCheckSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  expectedExitCode: z.number().int().optional(),
  versionPattern: z.string().optional(),
});

const InstallMethodSchema = z.object({
  type: z.enum(["npm", "brew", "winget", "choco", "url", "manual"]),
  package: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  label: z.string().optional(),
  instructions: z.string().optional(),
});

export const BackendDefinitionSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    supportedModes: z.array(z.enum(["resolve", "open", "acp"])).min(1),
    resolveCommand: PlatformCommandSchema.optional(),
    openCommand: PlatformCommandSchema.optional(),
    acpCommand: PlatformCommandSchema.optional(),
    acpOwnsProcess: z.boolean().optional(),
    resolvePackage: z.string().optional(),
    openWorkspaceDir: z.enum(["arg", "cwd"]).optional(),
    openSpawnOptions: OpenSpawnOptionsSchema.optional(),
    existenceCheck: ExistenceCheckSchema.optional(),
    install: z.array(InstallMethodSchema).optional(),
  })
  .passthrough();
