import { readFile, writeFile, rename, readdir, stat, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentInstanceMeta } from "@actant/shared";
import { InstanceCorruptedError } from "@actant/shared";
import { AgentInstanceMetaSchema } from "./instance-meta-schema";
import { createLogger } from "@actant/shared";
import type { InstanceRegistryAdapter } from "./instance-registry-types";

const logger = createLogger("instance-meta-io");

const META_FILENAME = ".actant.json";

export function metaFilePath(workspaceDir: string): string {
  return join(workspaceDir, META_FILENAME);
}

/** Read and validate `.actant.json` from a workspace directory. */
export async function readInstanceMeta(workspaceDir: string): Promise<AgentInstanceMeta> {
  const filePath = metaFilePath(workspaceDir);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      throw new InstanceCorruptedError(
        workspaceDir,
        `${META_FILENAME} not found`,
      );
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InstanceCorruptedError(workspaceDir, `${META_FILENAME} contains invalid JSON`);
  }

  const result = AgentInstanceMetaSchema.safeParse(parsed);
  if (!result.success) {
    throw new InstanceCorruptedError(
      workspaceDir,
      `${META_FILENAME} failed schema validation: ${result.error.issues.map((i) => i.message).join(", ")}`,
    );
  }

  return result.data as AgentInstanceMeta;
}

/** Atomic write: write to a temp file then rename (prevents partial writes). */
export async function writeInstanceMeta(
  workspaceDir: string,
  meta: AgentInstanceMeta,
): Promise<void> {
  const filePath = metaFilePath(workspaceDir);
  const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  const content = JSON.stringify(meta, null, 2) + "\n";

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);
}

/** Partially update `.actant.json` — read, merge, write. */
export async function updateInstanceMeta(
  workspaceDir: string,
  patch: Partial<AgentInstanceMeta>,
): Promise<AgentInstanceMeta> {
  const existing = await readInstanceMeta(workspaceDir);
  const updated: AgentInstanceMeta = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeInstanceMeta(workspaceDir, updated);
  return updated;
}

/**
 * Scan `instancesBaseDir` for all valid instance directories.
 * Directories whose `.actant.json` is missing or invalid are logged and skipped.
 *
 * When `registry` is provided, also includes instances from the registry (external workspaces)
 * and deduplicates by name (registry entries take precedence).
 */
export async function scanInstances(
  instancesBaseDir: string,
  registry?: InstanceRegistryAdapter,
): Promise<{ valid: AgentInstanceMeta[]; corrupted: string[] }> {
  const valid: AgentInstanceMeta[] = [];
  const corrupted: string[] = [];
  const validNames = new Set<string>();

  if (registry) {
    for (const entry of registry.list()) {
      if (entry.status === "orphaned") continue;
      try {
        const st = await stat(entry.workspacePath);
        if (!st.isDirectory()) {
          corrupted.push(entry.name);
          continue;
        }
        const meta = await readInstanceMeta(entry.workspacePath);
        valid.push(meta);
        validNames.add(entry.name);
      } catch (err) {
        logger.warn({ name: entry.name, path: entry.workspacePath, error: err }, "Registry entry unreachable or corrupted");
        corrupted.push(entry.name);
      }
    }
  }

  let entries: string[];
  try {
    entries = await readdir(instancesBaseDir);
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return { valid, corrupted };
    }
    throw err;
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const dirPath = join(instancesBaseDir, entry);
    const dirStat = await stat(dirPath).catch(() => null);
    if (!dirStat?.isDirectory()) continue;

    try {
      const meta = await readInstanceMeta(dirPath);
      if (validNames.has(meta.name)) continue;
      valid.push(meta);
      validNames.add(meta.name);
    } catch (err) {
      logger.warn({ dir: entry, error: err }, "Corrupted instance directory");
      corrupted.push(entry);
    }
  }

  return { valid, corrupted };
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
