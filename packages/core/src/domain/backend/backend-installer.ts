import { execFile } from "node:child_process";
import { createLogger } from "@actant/shared";
import type { BackendInstallMethod } from "@actant/shared";

const logger = createLogger("backend-installer");

// ---------------------------------------------------------------------------
// Package manager detection
// ---------------------------------------------------------------------------

export type JsPackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type SystemPackageManager = "brew" | "winget" | "choco";
export type PackageManagerType = JsPackageManager | SystemPackageManager;

interface DetectedJsManager {
  type: JsPackageManager;
  command: string;
}

interface DetectedSystemManager {
  type: SystemPackageManager;
  command: string;
}

const JS_MANAGERS: Array<{ type: JsPackageManager; command: string }> = [
  { type: "npm", command: "npm" },
  { type: "pnpm", command: "pnpm" },
  { type: "yarn", command: "yarn" },
  { type: "bun", command: "bun" },
];

const SYSTEM_MANAGERS: Array<{ type: SystemPackageManager; command: string; platform?: NodeJS.Platform }> = [
  { type: "brew", command: "brew", platform: "darwin" },
  { type: "winget", command: "winget", platform: "win32" },
  { type: "choco", command: "choco", platform: "win32" },
];

let cachedJsManager: DetectedJsManager | null | undefined;
let cachedSystemManagers: DetectedSystemManager[] | undefined;

/** Probe whether a command exists on PATH. */
async function commandExists(command: string): Promise<boolean> {
  const probe = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    execFile(probe, [command], { timeout: 5_000, windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Detect the first available JS package manager.
 * Result is cached for the process lifetime.
 */
export async function detectJsPackageManager(): Promise<DetectedJsManager | null> {
  if (cachedJsManager !== undefined) return cachedJsManager;

  for (const m of JS_MANAGERS) {
    if (await commandExists(m.command)) {
      cachedJsManager = m;
      logger.debug({ manager: m.type }, "JS package manager detected");
      return m;
    }
  }
  cachedJsManager = null;
  logger.debug("No JS package manager detected");
  return null;
}

/** Detect all available system package managers for the current platform. */
export async function detectSystemManagers(): Promise<DetectedSystemManager[]> {
  if (cachedSystemManagers !== undefined) return cachedSystemManagers;

  const results: DetectedSystemManager[] = [];
  const plat = process.platform;
  for (const m of SYSTEM_MANAGERS) {
    if (m.platform && m.platform !== plat) continue;
    if (await commandExists(m.command)) {
      results.push(m);
    }
  }
  cachedSystemManagers = results;
  logger.debug({ managers: results.map((m) => m.type) }, "System package managers detected");
  return results;
}

/** Reset cached detection results (for testing). */
export function _resetDetectionCache(): void {
  cachedJsManager = undefined;
  cachedSystemManagers = undefined;
}

// ---------------------------------------------------------------------------
// Install execution
// ---------------------------------------------------------------------------

export interface InstallResult {
  installed: boolean;
  method: string;
  error?: string;
}

/**
 * Execute a single install method. Returns whether installation succeeded.
 * `url` and `manual` types always return `{ installed: false }` since they
 * require human intervention.
 */
export async function executeInstall(method: BackendInstallMethod): Promise<InstallResult> {
  switch (method.type) {
    case "npm":
      return executeJsInstall(method);
    case "brew":
      return executeSystemInstall("brew", buildBrewArgs(method), method);
    case "winget":
      return executeSystemInstall("winget", buildWingetArgs(method), method);
    case "choco":
      return executeSystemInstall("choco", buildChocoArgs(method), method);
    case "url":
      return { installed: false, method: "url", error: `Open: ${method.package ?? method.label ?? "see documentation"}` };
    case "manual":
      return { installed: false, method: "manual", error: method.instructions ?? method.label ?? "Manual installation required" };
    default:
      return { installed: false, method: method.type, error: `Unknown install type: ${method.type}` };
  }
}

/**
 * Handle npm-type installs with fallback to other JS package managers.
 * Tries: npm → pnpm → yarn → bun
 */
async function executeJsInstall(method: BackendInstallMethod): Promise<InstallResult> {
  if (!method.package) {
    return { installed: false, method: "npm", error: "No package specified" };
  }

  const mgr = await detectJsPackageManager();
  if (!mgr) {
    return {
      installed: false,
      method: "npm",
      error: "No JavaScript package manager found (npm, pnpm, yarn, bun). " +
        "Install Node.js from https://nodejs.org or use another install method.",
    };
  }

  const args = buildJsInstallArgs(mgr.type, method.package);
  logger.info({ manager: mgr.type, package: method.package }, "Installing via JS package manager");

  try {
    await execCommand(mgr.command, args, 120_000);
    logger.info({ manager: mgr.type, package: method.package }, "Installation completed");
    return { installed: true, method: mgr.type };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ manager: mgr.type, package: method.package, error: msg }, "Installation failed");
    return { installed: false, method: mgr.type, error: msg };
  }
}

function buildJsInstallArgs(manager: JsPackageManager, pkg: string): string[] {
  switch (manager) {
    case "npm":
      return ["install", "-g", pkg];
    case "pnpm":
      return ["add", "-g", pkg];
    case "yarn":
      return ["global", "add", pkg];
    case "bun":
      return ["install", "-g", pkg];
  }
}

async function executeSystemInstall(
  command: string,
  args: string[],
  method: BackendInstallMethod,
): Promise<InstallResult> {
  if (!(await commandExists(command))) {
    return { installed: false, method: command, error: `${command} is not available on this system` };
  }

  logger.info({ command, args }, "Installing via system package manager");
  try {
    await execCommand(command, args, 180_000);
    logger.info({ command, package: method.package }, "Installation completed");
    return { installed: true, method: command };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ command, package: method.package, error: msg }, "Installation failed");
    return { installed: false, method: command, error: msg };
  }
}

function buildBrewArgs(method: BackendInstallMethod): string[] {
  if (!method.package) return [];
  const isCask = method.label?.includes("--cask");
  return isCask ? ["install", "--cask", method.package] : ["install", method.package];
}

function buildWingetArgs(method: BackendInstallMethod): string[] {
  if (!method.package) return [];
  return ["install", "--accept-source-agreements", "--accept-package-agreements", method.package];
}

function buildChocoArgs(method: BackendInstallMethod): string[] {
  if (!method.package) return [];
  return ["install", method.package, "-y"];
}

// ---------------------------------------------------------------------------
// Orchestration: try all applicable methods in order
// ---------------------------------------------------------------------------

export interface EnsureInstallResult {
  installed: boolean;
  method?: string;
  attempts: InstallResult[];
  /** Instructions for methods that require human action (url/manual). */
  manualInstructions?: string[];
}

/**
 * Try all applicable install methods for the current platform, in order.
 * Stops at the first successful installation.
 */
export async function tryInstallMethods(
  methods: BackendInstallMethod[],
): Promise<EnsureInstallResult> {
  const plat = process.platform;
  const applicable = methods.filter((m) => !m.platforms || m.platforms.includes(plat));

  if (applicable.length === 0) {
    return { installed: false, attempts: [], manualInstructions: ["No install method available for this platform."] };
  }

  const attempts: InstallResult[] = [];
  const manualInstructions: string[] = [];

  for (const method of applicable) {
    if (method.type === "url" || method.type === "manual") {
      const msg = method.type === "url"
        ? `Download from: ${method.package ?? "see documentation"}`
        : (method.instructions ?? method.label ?? "Manual installation required");
      manualInstructions.push(msg);
      continue;
    }

    const result = await executeInstall(method);
    attempts.push(result);

    if (result.installed) {
      return { installed: true, method: result.method, attempts, manualInstructions };
    }
  }

  return { installed: false, attempts, manualInstructions };
}

// ---------------------------------------------------------------------------
// resolvePackage install (npm package that provides a binary)
// ---------------------------------------------------------------------------

/**
 * Ensure a binary provided by an npm package is available.
 * Tries `npm install -g <pkg>` (or equivalent with detected JS manager).
 */
export async function ensureResolvePackage(pkg: string): Promise<InstallResult> {
  return executeJsInstall({ type: "npm", package: pkg });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function execCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        const combined = [stderr?.trim(), stdout?.trim()].filter(Boolean).join("\n");
        reject(new Error(combined || err.message));
        return;
      }
      resolve(stdout ?? "");
    });
  });
}
