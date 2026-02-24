import { execFile } from "node:child_process";
import type {
  AgentOpenMode,
  BackendDefinition,
  BackendInstallMethod,
  ConfigValidationResult,
  PlatformCommand,
} from "@actant/shared";
import { BaseComponentManager } from "../base-component-manager";
import { BackendDefinitionSchema } from "./backend-schema";
import { tryInstallMethods, ensureResolvePackage, type EnsureInstallResult, type InstallResult } from "./backend-installer";

export type AcpResolverFn = (
  workspaceDir: string,
  backendConfig?: Record<string, unknown>,
) => { command: string; args: string[] };

/**
 * Manages backend definitions as VersionedComponents.
 *
 * Pure-data definitions are stored in the component registry (JSON-serializable,
 * loadable from `~/.actant/configs/backends/`). Non-serializable behavioral
 * extensions (acpResolver) are stored in a separate Map keyed by backend name.
 */
export class BackendManager extends BaseComponentManager<BackendDefinition> {
  protected readonly componentType = "Backend";

  private readonly acpResolvers = new Map<string, AcpResolverFn>();

  constructor() {
    super("backend-manager");
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
      throw new Error(
        `Backend "${backendName}" does not support "${mode}" mode. ` +
        `Supported modes: [${supported}]. ` +
        (mode === "resolve"
          ? `Use \`agent start\` or \`agent run\` instead.`
          : mode === "open"
            ? `This backend has no native TUI/UI to open.`
            : `Use \`agent resolve\` or \`agent open\` instead.`),
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
