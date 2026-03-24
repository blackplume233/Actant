import * as fs from "node:fs/promises";
import * as path from "node:path";
import { existsSync } from "node:fs";
import { createLogger } from "@actant/shared/core";

const logger = createLogger("vfs-data-store");

/**
 * Sidecar metadata stored alongside each virtual file.
 * Written to `<filename>.meta.json` in the same directory.
 */
export interface VfsFileMeta {
  label: string;
  features: string[];
  mountPoint: string;
  createdAt: string;
  updatedAt: string;
  owner?: string;
  mimeType?: string;
  [key: string]: unknown;
}

/**
 * Mount registry entry persisted to `_vfs/mounts.json`.
 */
export interface PersistedMount {
  name: string;
  mountPoint: string;
  label: string;
  features: string[];
  lifecycle: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Audit log entry appended to `_vfs/audit.jsonl`.
 */
export interface VfsAuditEntry {
  timestamp: string;
  action: string;
  path: string;
  identity?: string;
  source?: string;
  detail?: Record<string, unknown>;
}

/**
 * File system mirror for VFS virtual data.
 *
 * Virtual paths map 1:1 to real files under `~/.actant/vfs-data/`:
 *   /memory/agent-a/context.md -> ~/.actant/vfs-data/memory/agent-a/context.md
 *   /config/template.json     -> ~/.actant/vfs-data/config/template.json
 *
 * Special directories:
 *   _vfs/mounts.json  — persistent mount registry
 *   _vfs/audit.jsonl  — change audit log (NDJSON)
 */
export class VfsDataStore {
  private readonly rootDir: string;
  private readonly vfsMetaDir: string;

  constructor(homeDir: string) {
    this.rootDir = path.join(homeDir, "vfs-data");
    this.vfsMetaDir = path.join(this.rootDir, "_vfs");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.mkdir(this.vfsMetaDir, { recursive: true });
    logger.debug({ rootDir: this.rootDir }, "VFS data store initialized");
  }

  /**
   * Get the real filesystem path for a VFS virtual path.
   */
  resolveDataPath(vfsPath: string): string {
    const normalized = vfsPath.startsWith("/") ? vfsPath.slice(1) : vfsPath;
    return path.join(this.rootDir, normalized);
  }

  // ── File operations ──────────────────────────────────────────────────

  async readFile(vfsPath: string): Promise<string> {
    const abs = this.resolveDataPath(vfsPath);
    return fs.readFile(abs, "utf-8");
  }

  async writeFile(vfsPath: string, content: string, meta?: Partial<VfsFileMeta>): Promise<void> {
    const abs = this.resolveDataPath(vfsPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");

    if (meta) {
      await this.writeMeta(vfsPath, {
        ...meta,
        updatedAt: new Date().toISOString(),
        createdAt: meta.createdAt ?? new Date().toISOString(),
      } as VfsFileMeta);
    }
  }

  async deleteFile(vfsPath: string): Promise<void> {
    const abs = this.resolveDataPath(vfsPath);
    if (existsSync(abs)) await fs.unlink(abs);
    const metaPath = abs + ".meta.json";
    if (existsSync(metaPath)) await fs.unlink(metaPath);
  }

  async fileExists(vfsPath: string): Promise<boolean> {
    const abs = this.resolveDataPath(vfsPath);
    return existsSync(abs);
  }

  // ── Meta sidecar ─────────────────────────────────────────────────────

  async writeMeta(vfsPath: string, meta: VfsFileMeta): Promise<void> {
    const abs = this.resolveDataPath(vfsPath) + ".meta.json";
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, JSON.stringify(meta, null, 2), "utf-8");
  }

  async readMeta(vfsPath: string): Promise<VfsFileMeta | null> {
    const abs = this.resolveDataPath(vfsPath) + ".meta.json";
    if (!existsSync(abs)) return null;
    const content = await fs.readFile(abs, "utf-8");
    return JSON.parse(content);
  }

  // ── Mount registry ───────────────────────────────────────────────────

  async saveMounts(mounts: PersistedMount[]): Promise<void> {
    const filePath = path.join(this.vfsMetaDir, "mounts.json");
    await fs.writeFile(filePath, JSON.stringify(mounts, null, 2), "utf-8");
  }

  async loadMounts(): Promise<PersistedMount[]> {
    const filePath = path.join(this.vfsMetaDir, "mounts.json");
    if (!existsSync(filePath)) return [];
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  }

  // ── Audit log ────────────────────────────────────────────────────────

  async appendAudit(entry: VfsAuditEntry): Promise<void> {
    const filePath = path.join(this.vfsMetaDir, "audit.jsonl");
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(filePath, line, "utf-8");
  }

  async readAuditTail(lines = 100): Promise<VfsAuditEntry[]> {
    const filePath = path.join(this.vfsMetaDir, "audit.jsonl");
    if (!existsSync(filePath)) return [];
    const content = await fs.readFile(filePath, "utf-8");
    const allLines = content.trim().split("\n").filter(Boolean);
    const tail = allLines.slice(-lines);
    return tail.map((l) => JSON.parse(l));
  }

  get dataRoot(): string {
    return this.rootDir;
  }
}
