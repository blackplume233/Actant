import { mkdir, rm, access, symlink, lstat, unlink, readlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AgentInstanceMeta,
  AgentArchetype,
  LaunchMode,
  WorkspacePolicy,
  WorkDirConflict,
  PermissionsInput,
  ModelProviderConfig,
  AgentTemplate,
} from "@actant/shared";
import {
  ActantError,
  ConfigValidationError,
  InstanceCorruptedError,
  WorkspaceInitError,
  createLogger,
} from "@actant/shared";
import { WorkspaceBuilder, type ProjectComponentManagers } from "../builder/workspace-builder";
import { resolvePermissions } from "@actant/domain-context";
import { readInstanceMeta, writeInstanceMeta } from "../state/index";
import { InitializationPipeline } from "./pipeline/initialization-pipeline";
import type { StepRegistry } from "./pipeline/step-registry";
import type { StepContext } from "./pipeline/types";
import { modelProviderRegistry, resolveProviderFromEnv } from "@actant/domain-context";
import { getBackendDescriptor } from "../manager/launcher/backend-registry";
import { resolveArchetypeConfig, validateLaunchModeForArchetype, validateWorkspacePolicyForLaunchMode } from "./archetype-defaults";
import { validateBackendForArchetype } from "../manager/launcher/backend-resolver";

const logger = createLogger("agent-initializer");

export interface InitializerOptions {
  defaultLaunchMode?: LaunchMode;
  projectManagers?: ProjectComponentManagers;
  /** Step registry for InitializerConfig pipeline execution. When provided, template.initializer.steps will be executed during createInstance(). */
  stepRegistry?: StepRegistry;
}

export interface InstanceOverrides {
  launchMode: LaunchMode;
  workspacePolicy: WorkspacePolicy;
  /** Override the template archetype. Affects default launchMode, interactionModes, and autoStart. */
  archetype: AgentArchetype;
  /** Explicitly control auto-start. When omitted, derived from archetype. */
  autoStart: boolean;
  /** Absolute path for the agent workspace. When omitted, defaults to {instancesBaseDir}/{name}. */
  workDir: string;
  /** Behavior when workDir already exists. Default: "error". */
  workDirConflict: WorkDirConflict;
  /** Override template permissions at instance level. Completely replaces template.permissions. */
  permissions: PermissionsInput;
  metadata: Record<string, string>;
}

export interface TemplateLookup {
  getOrThrow(name: string): AgentTemplate;
}

export class AgentInitializer {
  private readonly builder: WorkspaceBuilder;
  private readonly pipeline?: InitializationPipeline;

  constructor(
    private readonly templateLookup: TemplateLookup,
    private readonly instancesBaseDir: string,
    private readonly options?: InitializerOptions,
  ) {
    this.builder = new WorkspaceBuilder(options?.projectManagers);
    if (options?.stepRegistry) {
      this.pipeline = new InitializationPipeline(options.stepRegistry);
    }
  }

  get workspaceBuilder(): WorkspaceBuilder {
    return this.builder;
  }

  /**
   * Create a new Agent Instance.
   * 1. Resolve template from registry
   * 2. Create workspace directory {instancesBaseDir}/{name}/
   * 3. Materialize project resource files
   * 4. Write .actant.json metadata
   *
   * @throws {TemplateNotFoundError} if template is not in registry
   * @throws {ConfigValidationError} if name conflicts with existing directory
   * @throws {WorkspaceInitError} if directory creation or file writing fails
   */
  async createInstance(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<AgentInstanceMeta> {
    const template = this.templateLookup.getOrThrow(templateName);
    const customWorkDir = overrides?.workDir;
    const workspaceDir = customWorkDir ?? join(this.instancesBaseDir, name);
    const conflictPolicy = overrides?.workDirConflict ?? "error";

    const exists = await dirExists(workspaceDir);
    if (exists) {
      switch (conflictPolicy) {
        case "error":
          throw new ConfigValidationError(
            `Instance directory "${name}" already exists`,
            [{ path: "name", message: `Directory already exists: ${workspaceDir}` }],
          );
        case "overwrite":
          await rm(workspaceDir, { recursive: true, force: true });
          logger.info({ workspaceDir }, "Existing directory removed (overwrite)");
          break;
        case "append":
          logger.info({ workspaceDir }, "Appending to existing directory");
          break;
      }
    }

    if (customWorkDir) {
      const linkPath = join(this.instancesBaseDir, name);
      if (await entryExists(linkPath)) {
        throw new ConfigValidationError(
          `Instance registration "${name}" already exists in instancesBaseDir`,
          [{ path: "name", message: `Entry already exists: ${linkPath}` }],
        );
      }
    }

    const shouldCleanupOnError = conflictPolicy !== "append" && !exists;

    try {
      await mkdir(workspaceDir, { recursive: true });

      const finalPermissions = overrides?.permissions ?? template.permissions;
      await this.builder.build(
        workspaceDir,
        template.project,
        template.backend.type,
        finalPermissions,
      );

      if (this.pipeline && template.initializer?.steps?.length) {
        const stepContext: StepContext = {
          workspaceDir,
          instanceMeta: { name, templateName: template.name },
          template,
          logger,
          state: new Map(),
        };
        const pipelineResult = await this.pipeline.run(template.initializer.steps, stepContext);
        if (!pipelineResult.success) {
          const firstError = pipelineResult.errors[0];
          throw new WorkspaceInitError(
            workspaceDir,
            firstError?.error ?? new Error("Initializer pipeline failed"),
          );
        }
      }

      const effectivePermissions = resolvePermissions(finalPermissions);

      const resolvedProvider = resolveProviderConfig(template.provider);

      const now = new Date().toISOString();

      const archetype = overrides?.archetype ?? template.archetype ?? "repo";
      const backendDef = getBackendDescriptor(template.backend.type);

      // Validate backend/archetype compatibility
      const validation = validateBackendForArchetype(backendDef, archetype);
      if (!validation.valid) {
        throw new ConfigValidationError(
          `Backend "${template.backend.type}" is not compatible with "${archetype}" archetype`,
          [{ path: "backend.type", message: validation.error ?? "Backend not compatible with archetype" }],
        );
      }

      // Use capability-aware config resolution
      const archetypeConfig = resolveArchetypeConfig(archetype, backendDef, {
        explicitInteractionModes: template.backend.interactionModes,
      });

      if (archetypeConfig.error) {
        throw new ConfigValidationError(
          `Configuration error for "${archetype}" archetype`,
          [{ path: "archetype", message: archetypeConfig.error }],
        );
      }

      // Log warnings if any
      for (const warning of archetypeConfig.warnings) {
        logger.warn({ name, backend: template.backend.type, archetype }, warning);
      }

      const launchMode = overrides?.launchMode
        ?? template.launchMode
        ?? this.options?.defaultLaunchMode
        ?? archetypeConfig.launchMode;

      // Validate launchMode + archetype combination
      const launchModeValidation = validateLaunchModeForArchetype(launchMode, archetype);
      if (!launchModeValidation.valid) {
        throw new ConfigValidationError(
          `Invalid launch mode for archetype`,
          [{ path: "launchMode", message: launchModeValidation.error ?? "Invalid launch mode" }],
        );
      }

      const defaultPolicy: WorkspacePolicy = launchMode === "one-shot" ? "ephemeral" : "persistent";
      const workspacePolicy = overrides?.workspacePolicy ?? defaultPolicy;

      // Validate launchMode + workspacePolicy combination
      const policyValidation = validateWorkspacePolicyForLaunchMode(workspacePolicy, launchMode);
      if (!policyValidation.valid) {
        throw new ConfigValidationError(
          `Invalid workspace policy for launch mode`,
          [{ path: "workspacePolicy", message: policyValidation.error ?? "Invalid workspace policy" }],
        );
      }

      // Use interaction modes from capability-aware resolution
      const interactionModes = archetypeConfig.interactionModes;

      const autoStart = overrides?.autoStart ?? archetypeConfig.autoStart;

      const meta: AgentInstanceMeta = {
        id: randomUUID(),
        name,
        templateName: template.name,
        templateVersion: template.version,
        backendType: template.backend.type,
        backendConfig: template.backend.config ? { ...template.backend.config } : undefined,
        interactionModes,
        providerConfig: resolvedProvider,
        status: "created",
        launchMode,
        workspacePolicy,
        processOwnership: "managed",
        createdAt: now,
        updatedAt: now,
        archetype,
        autoStart,
        effectivePermissions,
        metadata: overrides?.metadata,
        rules: template.rules,
        toolSchema: template.toolSchema,
      };

      await writeInstanceMeta(workspaceDir, meta);

      if (customWorkDir) {
        const linkType = process.platform === "win32" ? "junction" : "dir";
        await symlink(workspaceDir, join(this.instancesBaseDir, name), linkType);
      }

      logger.info({ name, templateName, workspaceDir, customWorkDir: !!customWorkDir }, "Agent instance created");
      return meta;
    } catch (err) {
      if (shouldCleanupOnError) {
        await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
        logger.debug({ workspaceDir }, "Cleaned up workspace after failed creation");
      }
      if (err instanceof ActantError) {
        throw err;
      }
      throw new WorkspaceInitError(workspaceDir, err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Find an existing instance or create a new one (idempotent).
   * - Directory exists + valid .actant.json → return existing
   * - Directory does not exist → create new instance
   * - Directory exists but corrupted → throw InstanceCorruptedError
   */
  async findOrCreateInstance(
    name: string,
    templateName: string,
    overrides?: Partial<InstanceOverrides>,
  ): Promise<{ meta: AgentInstanceMeta; created: boolean }> {
    const workspaceDir = join(this.instancesBaseDir, name);

    if (await dirExists(workspaceDir)) {
      try {
        const meta = await readInstanceMeta(workspaceDir);
        logger.debug({ name }, "Existing instance found");
        return { meta, created: false };
      } catch (err) {
        if (err instanceof InstanceCorruptedError) {
          throw err;
        }
        throw new InstanceCorruptedError(name, err instanceof Error ? err.message : String(err));
      }
    }

    const meta = await this.createInstance(name, templateName, overrides);
    return { meta, created: true };
  }

  /**
   * Destroy an instance by removing its workspace directory.
   * For symlinked instances (custom workDir): removes the symlink and `.actant.json`
   * from the target, but preserves the rest of the user's directory.
   * For normal instances: removes the entire workspace directory.
   */
  async destroyInstance(name: string): Promise<void> {
    const entryPath = join(this.instancesBaseDir, name);
    if (!(await entryExists(entryPath))) {
      logger.warn({ name }, "Instance directory not found, nothing to destroy");
      return;
    }

    if (await isSymlink(entryPath)) {
      const targetDir = await readlink(entryPath);
      try {
        await unlink(join(targetDir, ".actant.json"));
      } catch {
        // .actant.json may have been removed already
      }
      await rmWithRetry(entryPath);
      logger.info({ name, targetDir }, "Symlinked agent instance unregistered");
    } else {
      await rmWithRetry(entryPath);
      logger.info({ name }, "Agent instance destroyed");
    }
  }
}

/**
 * Resolve the effective provider config for an instance.
 *
 * Priority: template explicit config > environment variables > registry default.
 * Always ensures `protocol` is set (uses registry descriptor or "custom" fallback).
 */
function resolveProviderConfig(templateProvider?: ModelProviderConfig): ModelProviderConfig | undefined {
  if (templateProvider) {
    if (templateProvider.protocol) return templateProvider;
    const desc = modelProviderRegistry.get(templateProvider.type);
    return {
      ...templateProvider,
      protocol: desc?.protocol ?? "custom",
    };
  }

  const envProvider = resolveProviderFromEnv();
  if (envProvider) {
    const desc = modelProviderRegistry.get(envProvider.type);
    return {
      ...envProvider,
      protocol: envProvider.protocol ?? desc?.protocol ?? "custom",
    };
  }

  const defaultDesc = modelProviderRegistry.getDefault();
  if (!defaultDesc) return undefined;

  return {
    type: defaultDesc.type,
    protocol: defaultDesc.protocol,
    baseUrl: defaultDesc.defaultBaseUrl,
  };
}

async function dirExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Check if an entry (file, dir, or symlink) exists without following symlinks. */
async function entryExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

const EBUSY_DELAYS_MS = [500, 1000, 2000, 4000];

async function rmWithRetry(target: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rm(target, { recursive: true, force: true });
      return;
    } catch (err) {
      const isTransient =
        err instanceof Error &&
        "code" in err &&
        ((err as NodeJS.ErrnoException).code === "EBUSY" ||
          (err as NodeJS.ErrnoException).code === "EPERM");
      if (!isTransient || attempt >= EBUSY_DELAYS_MS.length) throw err;
      const delay = EBUSY_DELAYS_MS[attempt];
      logger.warn({ target, attempt: attempt + 1, delay }, "rm EBUSY/EPERM, retrying");
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
