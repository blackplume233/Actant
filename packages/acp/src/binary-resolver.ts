import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createLogger, isWindows } from "@actant/shared";

const logger = createLogger("binary-resolver");

export interface ResolvedAcpBinary {
  command: string;
  prependArgs: string[];
}

/**
 * Resolve an ACP binary command to an executable path.
 *
 * Resolution order:
 *  1. Check if the command is already on PATH → return as-is
 *  2. If `resolvePackage` is provided → resolve bin script from that npm package
 *     in node_modules, run via `node <script-path>`
 *  3. Return original command (caller will get a proper spawn error)
 *
 * @param command      The command name (e.g. "claude-agent-acp.cmd")
 * @param resolvePackage  npm package that provides the binary (from BackendDescriptor)
 */
export function resolveAcpBinary(command: string, resolvePackage?: string): ResolvedAcpBinary {
  if (isOnPath(command)) {
    return { command, prependArgs: [] };
  }

  if (!resolvePackage) {
    return { command, prependArgs: [] };
  }

  const bareName = command.replace(/\.cmd$/, "");
  const scriptPath = resolveScriptFromPackage(resolvePackage, bareName);
  if (scriptPath) {
    logger.info({ bareName, resolvePackage, scriptPath }, "Resolved ACP binary from backend dependency");
    const nodeCmd = isWindows() && process.execPath.includes(" ")
      ? `"${process.execPath}"`
      : process.execPath;
    return { command: nodeCmd, prependArgs: [scriptPath] };
  }

  return { command, prependArgs: [] };
}

function isOnPath(command: string): boolean {
  try {
    const which = isWindows() ? "where.exe" : "which";
    execSync(`${which} ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function resolveScriptFromPackage(packageName: string, binName: string): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

    const binField = pkgJson.bin;
    const relBinPath = typeof binField === "string"
      ? binField
      : binField?.[binName];

    if (!relBinPath) return null;

    return join(dirname(pkgJsonPath), relBinPath);
  } catch {
    return null;
  }
}
