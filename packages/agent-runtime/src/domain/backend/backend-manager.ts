import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type {
  AgentOpenMode,
  BackendDefinition,
  BackendInstallMethod,
  ConfigValidationResult,
  ModelProviderConfig,
  PlatformCommand,
} from "@actant/shared";
import { ComponentReferenceError, ConfigNotFoundError, ConfigValidationError, createLogger, type Logger } from "@actant/shared";
import { BackendDefinitionSchema } from "./backend-schema";
import { tryInstallMethods, ensureResolvePackage, type EnsureInstallResult, type InstallResult } from "./backend-installer";

export type AcpResolverFn = (
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
) => { command: string; args: string[] };

/**
 * Build env vars for a backend's ACP subprocess from the provider config.
 * Each backend knows which native env vars its process expects.
 */
export type BuildProviderEnvFn = (
  providerConfig: ModelProviderConfig | undefined,
  backendConfig?: Record<string, unknown>,
) => Record<string, string>;

/**
 * Local backend definition collection for runtime builder/launcher flows.
 *
 * Pure-data definitions are stored in the collection (JSON-serializable,
 * loadable from `~/.actant/configs/backends/`). Non-serializable behavioral
 * extensions stay in side maps keyed by backend name.
 */
export class BackendManager {
  private readonly components = new Map<string, BackendDefinition>();
  private readonly logger: Logger;
  private readonly componentType = "Backend";
  private persistDir?: string;

  private readonly acpResolvers = new Map<string, AcpResolverFn>();
  private readonly providerEnvBuilders = new Map<string, BuildProviderEnvFn>();
  private readonly builders = new Map<string, unknown>();

  constructor() {
    this.logger = createLogger("backend-manager");
  }

  setPersistDir(dir: string): void {
    this.persistDir = dir;
  }

  register(component: BackendDefinition): void {
    this.components.set(component.name, component);
    this.logger.debug({ name: component.name }, `${this.componentType} registered`);
  }

  unregister(name: string): boolean {
    return this.components.delete(name);
  }

  get(name: string): BackendDefinition | undefined {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  resolve(names: string[]): BackendDefinition[] {
    return names.map((name) => {
      const component = this.components.get(name);
      if (!component) {
        throw new ComponentReferenceError(this.componentType, name);
      }
      return component;
    });
  }

  list(): BackendDefinition[] {
    return Array.from(this.components.values());
  }

  get size(): number {
    return this.components.size;
  }

  clear(): void {
    this.components.clear();
    this.acpResolvers.clear();
    this.providerEnvBuilders.clear();
    this.builders.clear();
  }

  async loadFromDirectory(dirPath: string): Promise<number> {
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        throw new ConfigNotFoundError(dirPath);
      }
      throw err;
    }

    let count = 0;

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const entryStat = await stat(fullPath);

      if (entryStat.isFile() && extname(entry) === ".json") {
        try {
          const raw = await readFile(fullPath, "utf-8");
          const parsed = JSON.parse(raw) as unknown;
          const component = this.validateOrThrow(parsed, fullPath);
          this.register(component);
          count++;
        } catch (err) {
          this.logger.warn({ file: entry, error: err }, `Failed to load ${this.componentType}, skipping`);
        }
      } else if (entryStat.isDirectory() && entry.startsWith("@")) {
        count += await this.loadFromDirectory(fullPath);
      }
    }

    this.logger.info({ count, dirPath }, `${this.componentType}s loaded from directory`);
    return count;
  }

  // ---------------------------------------------------------------------------
  // ACP resolver (behavioral extension, not serializable)
  // ---------------------------------------------------------------------------

  registerAcpResolver(backendName: string, resolver: AcpResolverFn): void {
    this.acpResolvers.set(backendName, resolver);
  }

  getAcpResolver(backendName: string): AcpResolverFn | undefined {
    return this.acpResolvers.get(backendName);
  }

  // ---------------------------------------------------------------------------
  // Provider env builder (behavioral extension, not serializable)
  // ---------------------------------------------------------------------------

  registerBuildProviderEnv(backendName: string, fn: BuildProviderEnvFn): void {
    this.providerEnvBuilders.set(backendName, fn);
  }

  getBuildProviderEnv(backendName: string): BuildProviderEnvFn | undefined {
    return this.providerEnvBuilders.get(backendName);
  }

  // ---------------------------------------------------------------------------
  // Backend builder (behavioral extension for workspace materialization)
  // ---------------------------------------------------------------------------

  registerBuilder(backendName: string, builder: unknown): void {
    this.builders.set(backendName, builder);
  }

  getBuilder(backendName: string): unknown | undefined {
    return this.builders.get(backendName);
  }

  // ---------------------------------------------------------------------------
  // Mode queries
  // ---------------------------------------------------------------------------

  supportsMode(backendName: string, mode: AgentOpenMode): boolean {
    const def = this.get(backendName);
    return def != null && def.supportedModes.includes(mode);
  }

  requireMode(backendName: string, mode: AgentOpenMode): void {
    const def = this.get(backendName);
    if (!def) {
      throw new Error(
        `Backend "${backendName}" is not registered. ` +
        `Ensure the backend package is installed and its definition was loaded at startup.`,
      );
    }
    if (!def.supportedModes.includes(mode)) {
      const supported = def.supportedModes.join(", ");
      let hint: string;
      if (mode === "resolve") {
        hint = `Use \`agent start\` or \`agent run\` instead.`;
      } else if (mode === "open") {
        hint = `This backend has no native TUI/UI to open.`;
      } else {
        hint = def.supportedModes.includes("open")
          ? `Use \`agent open\` to launch the native UI, or \`agent resolve\` to get the spawn command.`
          : `Use \`agent resolve\` to get the spawn command.`;
      }
      throw new Error(
        `Backend "${backendName}" does not support "${mode}" mode. ` +
        `Supported modes: [${supported}]. ` + hint,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Platform command helper
  // ---------------------------------------------------------------------------

  getPlatformCommand(cmd: PlatformCommand): string {
    return process.platform === "win32" ? cmd.win32 : cmd.default;
  }

  // ---------------------------------------------------------------------------
  // Availability check
  // ---------------------------------------------------------------------------

  /**
   * Probe whether a backend binary is available on the system.
   * Uses the `existenceCheck` field. Returns `{ available, version? }`.
   * If no `existenceCheck` is configured, returns `{ available: true }` (assume ok).
   */
  async checkAvailability(backendName: string): Promise<BackendAvailability> {
    const def = this.get(backendName);
    if (!def) return { available: false, error: `Backend "${backendName}" not registered` };
    if (!def.existenceCheck) return { available: true };

    const { command, args = ["--version"], expectedExitCode = 0, versionPattern } = def.existenceCheck;

    try {
      const { stdout, exitCode } = await execCommand(command, args);
      if (exitCode !== expectedExitCode) {
        return { available: false, error: `Exit code ${exitCode} (expected ${expectedExitCode})` };
      }
      if (versionPattern) {
        const match = new RegExp(versionPattern).exec(stdout);
        if (!match) {
          return { available: false, error: `Version output didn't match pattern: ${versionPattern}` };
        }
        return { available: true, version: match[0] };
      }
      const version = stdout.trim().split("\n")[0];
      return { available: true, version: version || undefined };
    } catch (err) {
      return { available: false, error: (err as Error).message };
    }
  }

  /**
   * Get platform-appropriate install methods for a backend.
   * Filters by `platforms` field; returns all methods if no platform restriction.
   */
  getInstallMethods(backendName: string): BackendInstallMethod[] {
    const def = this.get(backendName);
    if (!def?.install) return [];
    const plat = process.platform;
    return def.install.filter((m: BackendInstallMethod) => !m.platforms || m.platforms.includes(plat));
  }

  // ---------------------------------------------------------------------------
  // Auto-install
  // ---------------------------------------------------------------------------

  /**
   * Check availability and optionally auto-install the backend.
   * Flow: existence check → (if missing + autoInstall) install → re-check.
   */
  async ensureAvailable(
    backendName: string,
    options?: { autoInstall?: boolean },
  ): Promise<EnsureAvailableResult> {
    const check = await this.checkAvailability(backendName);
    if (check.available) {
      return { available: true, version: check.version, alreadyInstalled: true };
    }

    if (!options?.autoInstall) {
      const methods = this.getInstallMethods(backendName);
      return {
        available: false,
        alreadyInstalled: false,
        error: check.error,
        installMethods: methods,
      };
    }

    const installResult = await this.installBackend(backendName);
    if (!installResult.installed) {
      return {
        available: false,
        alreadyInstalled: false,
        error: check.error,
        installResult,
      };
    }

    const recheck = await this.checkAvailability(backendName);
    return {
      available: recheck.available,
      alreadyInstalled: false,
      version: recheck.version,
      installResult,
      error: recheck.available ? undefined : recheck.error,
    };
  }

  /**
   * Try all applicable install methods for a backend.
   * Delegates to backend-installer for actual execution.
   */
  async installBackend(backendName: string): Promise<EnsureInstallResult> {
    const methods = this.getInstallMethods(backendName);
    if (methods.length === 0) {
      return { installed: false, attempts: [], manualInstructions: [`No install methods defined for backend "${backendName}".`] };
    }
    this.logger.info({ backendName, methodCount: methods.length }, "Attempting to install backend");
    return tryInstallMethods(methods);
  }

  /**
   * Ensure a binary provided by `resolvePackage` is available.
   * Used for secondary binaries (e.g. `claude-agent-acp` for `claude-code`).
   */
  async ensureResolvePackageAvailable(
    backendName: string,
    options?: { autoInstall?: boolean },
  ): Promise<InstallResult | null> {
    const def = this.get(backendName);
    if (!def?.resolvePackage) return null;

    const cmd = def.resolveCommand
      ? this.getPlatformCommand(def.resolveCommand)
      : undefined;

    if (cmd) {
      const { exitCode } = await execCommand(cmd, ["--version"]);
      if (exitCode === 0) return null;
    }

    if (!options?.autoInstall) return null;

    this.logger.info({ backendName, package: def.resolvePackage }, "Installing resolvePackage");
    return ensureResolvePackage(def.resolvePackage);
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  validate(data: unknown, _source: string): ConfigValidationResult<BackendDefinition> {
    const result = BackendDefinitionSchema.safeParse(data);
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map((i) => ({
          path: i.path.map(String).join("."),
          message: i.message,
          severity: "error" as const,
        })),
        warnings: [],
      };
    }
    return { valid: true, data: result.data as BackendDefinition, errors: [], warnings: [] };
  }

  private validateOrThrow(data: unknown, source: string): BackendDefinition {
    const result = this.validate(data, source);
    if (!result.valid || !result.data) {
      throw new ConfigValidationError(
        `Validation failed for ${this.componentType} in ${source}`,
        result.errors.map((e) => ({ path: e.path, message: e.message })),
        result.errors,
      );
    }
    return result.data;
  }

  async add(component: BackendDefinition, persist = false): Promise<void> {
    const validated = this.validateOrThrow(component, "add");
    this.register(validated);
    if (persist && this.persistDir) {
      await this.writeComponent(validated);
    }
  }

  async update(name: string, patch: Partial<BackendDefinition>, persist = false): Promise<BackendDefinition> {
    const existing = this.get(name);
    if (!existing) {
      throw new ComponentReferenceError(this.componentType, name);
    }
    const merged = { ...existing, ...patch, name } as BackendDefinition;
    const validated = this.validateOrThrow(merged, "update");
    this.register(validated);
    if (persist && this.persistDir) {
      await this.writeComponent(validated);
    }
    return validated;
  }

  async remove(name: string, persist = false): Promise<boolean> {
    const existed = this.unregister(name);
    if (existed && persist && this.persistDir) {
      await this.deleteComponent(name);
    }
    return existed;
  }

  async importFromFile(filePath: string): Promise<BackendDefinition> {
    const absPath = resolve(filePath);
    const raw = await readFile(absPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const component = this.validateOrThrow(parsed, absPath);
    this.register(component);
    this.logger.info({ name: component.name, filePath: absPath }, `${this.componentType} imported`);
    return component;
  }

  async exportToFile(name: string, filePath: string): Promise<void> {
    const component = this.get(name);
    if (!component) {
      throw new ComponentReferenceError(this.componentType, name);
    }
    const absPath = resolve(filePath);
    await writeFile(absPath, JSON.stringify(component, null, 2) + "\n", "utf-8");
    this.logger.info({ name, filePath: absPath }, `${this.componentType} exported`);
  }

  search(query: string): BackendDefinition[] {
    const lower = query.toLowerCase();
    return this.list().filter((component) => {
      if (component.name.toLowerCase().includes(lower)) return true;
      const description = (component as unknown as { description?: unknown }).description;
      return typeof description === "string" && description.toLowerCase().includes(lower);
    });
  }

  filter(predicate: (component: BackendDefinition) => boolean): BackendDefinition[] {
    return this.list().filter(predicate);
  }

  private async writeComponent(component: BackendDefinition): Promise<void> {
    if (!this.persistDir) return;
    await mkdir(this.persistDir, { recursive: true });
    const filePath = join(this.persistDir, `${component.name}.json`);
    await writeFile(filePath, JSON.stringify(component, null, 2) + "\n", "utf-8");
    this.logger.debug({ name: component.name, filePath }, `${this.componentType} persisted`);
  }

  private async deleteComponent(name: string): Promise<void> {
    if (!this.persistDir) return;
    const filePath = join(this.persistDir, `${name}.json`);
    try {
      await unlink(filePath);
      this.logger.debug({ name, filePath }, `${this.componentType} file deleted`);
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") return;
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export interface BackendAvailability {
  available: boolean;
  version?: string;
  error?: string;
}

export interface EnsureAvailableResult {
  available: boolean;
  alreadyInstalled: boolean;
  version?: string;
  error?: string;
  installMethods?: BackendInstallMethod[];
  installResult?: EnsureInstallResult;
}

function execCommand(command: string, args: string[]): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 10_000, windowsHide: true }, (err, stdout) => {
      if (err && typeof (err as NodeJS.ErrnoException).code === "string" && (err as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({ stdout: "", exitCode: -1 });
        return;
      }
      const exitCode = err && "code" in err && typeof err.code === "number" ? err.code : err ? 1 : 0;
      resolve({ stdout: stdout ?? "", exitCode });
    });
  });
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
