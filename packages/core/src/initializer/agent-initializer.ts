import { mkdir, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentInstanceMeta, LaunchMode } from "@agentcraft/shared";
import {
  AgentCraftError,
  ConfigValidationError,
  InstanceCorruptedError,
  WorkspaceInitError,
  createLogger,
} from "@agentcraft/shared";
import type { TemplateRegistry } from "../template/registry/template-registry";
import { ContextMaterializer, type DomainManagers } from "./context/context-materializer";
import { readInstanceMeta, writeInstanceMeta } from "../state/index";

const logger = createLogger("agent-initializer");

export interface InitializerOptions {
  defaultLaunchMode?: LaunchMode;
  domainManagers?: DomainManagers;
}

export interface InstanceOverrides {
  launchMode: LaunchMode;
  metadata: Record<string, string>;
}

export class AgentInitializer {
  private readonly materializer: ContextMaterializer;

  constructor(
    private readonly templateRegistry: TemplateRegistry,
    private readonly instancesBaseDir: string,
    private readonly options?: InitializerOptions,
  ) {
    this.materializer = new ContextMaterializer(options?.domainManagers);
  }

  /**
   * Create a new Agent Instance.
   * 1. Resolve template from registry
   * 2. Create workspace directory {instancesBaseDir}/{name}/
   * 3. Materialize Domain Context files
   * 4. Write .agentcraft.json metadata
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
    const workspaceDir = join(this.instancesBaseDir, name);

    if (await dirExists(workspaceDir)) {
      throw new ConfigValidationError(
        `Instance directory "${name}" already exists`,
        [{ path: "name", message: `Directory already exists: ${workspaceDir}` }],
      );
    }

    try {
      await mkdir(workspaceDir, { recursive: true });
      await this.materializer.materialize(
        workspaceDir,
        template.domainContext,
        template.backend.type,
      );

      const now = new Date().toISOString();
      const meta: AgentInstanceMeta = {
        id: randomUUID(),
        name,
        templateName: template.name,
        templateVersion: template.version,
        backendType: template.backend.type,
        backendConfig: template.backend.config ? { ...template.backend.config } : undefined,
        status: "created",
        launchMode: overrides?.launchMode ?? this.options?.defaultLaunchMode ?? "direct",
        processOwnership: "managed",
        createdAt: now,
        updatedAt: now,
        metadata: overrides?.metadata,
      };

      await writeInstanceMeta(workspaceDir, meta);
      logger.info({ name, templateName }, "Agent instance created");
      return meta;
    } catch (err) {
      if (err instanceof AgentCraftError) {
        throw err;
      }
      throw new WorkspaceInitError(workspaceDir, err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Find an existing instance or create a new one (idempotent).
   * - Directory exists + valid .agentcraft.json → return existing
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
   * Destroy an instance by removing its entire workspace directory.
   */
  async destroyInstance(name: string): Promise<void> {
    const workspaceDir = join(this.instancesBaseDir, name);
    if (!(await dirExists(workspaceDir))) {
      logger.warn({ name }, "Instance directory not found, nothing to destroy");
      return;
    }
    await rm(workspaceDir, { recursive: true, force: true });
    logger.info({ name }, "Agent instance destroyed");
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
