import { readFile, writeFile, rename, readdir, stat, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentInstanceMeta } from "@agentcraft/shared";
import { InstanceCorruptedError } from "@agentcraft/shared";
import { AgentInstanceMetaSchema } from "./instance-meta-schema";
import { createLogger } from "@agentcraft/shared";

const logger = createLogger("instance-meta-io");

const META_FILENAME = ".agentcraft.json";

export function metaFilePath(workspaceDir: string): string {
  return join(workspaceDir, META_FILENAME);
}

/** Read and validate `.agentcraft.json` from a workspace directory. */
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

  const data = result.data as Record<string, unknown> & {
    backendType?: AgentInstanceMeta["backendType"];
    processOwnership?: AgentInstanceMeta["processOwnership"];
    workspacePolicy?: AgentInstanceMeta["workspacePolicy"];
    launchMode?: AgentInstanceMeta["launchMode"];
  };
  return {
    ...data,
    backendType: data.backendType ?? "cursor",
    processOwnership: data.processOwnership ?? "managed",
    workspacePolicy: data.workspacePolicy ?? (data.launchMode === "one-shot" ? "ephemeral" : "persistent"),
  } as AgentInstanceMeta;
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

/** Partially update `.agentcraft.json` — read, merge, write. */
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
 * Directories whose `.agentcraft.json` is missing or invalid are logged and skipped.
 */
export async function scanInstances(
  instancesBaseDir: string,
): Promise<{ valid: AgentInstanceMeta[]; corrupted: string[] }> {
  let entries: string[];
  try {
    entries = await readdir(instancesBaseDir);
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return { valid: [], corrupted: [] };
    }
    throw err;
  }

  const valid: AgentInstanceMeta[] = [];
  const corrupted: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const dirPath = join(instancesBaseDir, entry);
    const dirStat = await stat(dirPath).catch(() => null);
    if (!dirStat?.isDirectory()) continue;

    try {
      const meta = await readInstanceMeta(dirPath);
      valid.push(meta);
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
