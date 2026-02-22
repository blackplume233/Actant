import { mkdir, rm, access, symlink, lstat, unlink, readlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentInstanceMeta, LaunchMode, WorkspacePolicy, WorkDirConflict, PermissionsInput } from "@actant/shared";
import {
  ActantError,
  ConfigValidationError,
  InstanceCorruptedError,
  WorkspaceInitError,
  createLogger,
} from "@actant/shared";
import type { TemplateRegistry } from "../template/registry/template-registry";
import { WorkspaceBuilder, type DomainManagers } from "../builder/workspace-builder";
import { resolvePermissions } from "../permissions/permission-presets";
import { readInstanceMeta, writeInstanceMeta } from "../state/index";

const logger = createLogger("agent-initializer");

export interface InitializerOptions {
  defaultLaunchMode?: LaunchMode;
  domainManagers?: DomainManagers;
}

export interface InstanceOverrides {
  launchMode: LaunchMode;
  workspacePolicy: WorkspacePolicy;
  /** Absolute path for the agent workspace. When omitted, defaults to {instancesBaseDir}/{name}. */
  workDir: string;
  /** Behavior when workDir already exists. Default: "error". */
  workDirConflict: WorkDirConflict;
  /** Override template permissions at instance level. Completely replaces template.permissions. */
  permissions: PermissionsInput;
  metadata: Record<string, string>;
}

export class AgentInitializer {
  private readonly builder: WorkspaceBuilder;

  constructor(
    private readonly templateRegistry: TemplateRegistry,
    private readonly instancesBaseDir: string,
    private readonly options?: InitializerOptions,
  ) {
    this.builder = new WorkspaceBuilder(options?.domainManagers);
  }

  /**
   * Create a new Agent Instance.
   * 1. Resolve template from registry
   * 2. Create workspace directory {instancesBaseDir}/{name}/
   * 3. Materialize Domain Context files
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
    const template = this.templateRegistry.getOrThrow(templateName);
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
        template.domainContext,
        template.backend.type,
        finalPermissions,
      );

      const effectivePermissions = resolvePermissions(finalPermissions);

      const now = new Date().toISOString();
      const launchMode = overrides?.launchMode ?? this.options?.defaultLaunchMode ?? "direct";
      const defaultPolicy: WorkspacePolicy = launchMode === "one-shot" ? "ephemeral" : "persistent";
      const meta: AgentInstanceMeta = {
        id: randomUUID(),
        name,
        templateName: template.name,
        templateVersion: template.version,
        backendType: template.backend.type,
        backendConfig: template.backend.config ? { ...template.backend.config } : undefined,
        status: "created",
        launchMode,
        workspacePolicy: overrides?.workspacePolicy ?? defaultPolicy,
        processOwnership: "managed",
        createdAt: now,
        updatedAt: now,
        effectivePermissions,
        metadata: overrides?.metadata,
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
      await rm(entryPath, { recursive: true, force: true });
      logger.info({ name, targetDir }, "Symlinked agent instance unregistered");
    } else {
      await rm(entryPath, { recursive: true, force: true });
      logger.info({ name }, "Agent instance destroyed");
    }
  }
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
