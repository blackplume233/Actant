import { readFile, writeFile, rename, readdir, stat, mkdir } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentInstanceMeta } from "@actant/shared";
import { InstanceCorruptedError } from "@actant/shared";
import { readInstanceMeta } from "./instance-meta-io";
import type { InstanceRegistryAdapter } from "./instance-registry-types";

export interface InstanceRegistryEntry {
  name: string;
  template: string;
  workspacePath: string;
  location: "builtin" | "external";
  createdAt: string;
  status: "stopped" | "running" | "orphaned";
}

export interface InstanceRegistryData {
  version: 1;
  instances: Record<string, InstanceRegistryEntry>;
}

const REGISTRY_VERSION = 1 as const;

function mapMetaStatusToRegistry(status: AgentInstanceMeta["status"]): InstanceRegistryEntry["status"] {
  if (status === "running" || status === "starting") return "running";
  return "stopped";
}

export class InstanceRegistry implements InstanceRegistryAdapter {
  private data: InstanceRegistryData = {
    version: REGISTRY_VERSION,
    instances: {},
  };

  constructor(
    private readonly registryPath: string,
    private readonly builtinInstancesDir: string,
  ) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.registryPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "version" in parsed &&
        (parsed as InstanceRegistryData).version === 1 &&
        "instances" in parsed &&
        typeof (parsed as InstanceRegistryData).instances === "object"
      ) {
        this.data = parsed as InstanceRegistryData;
      }
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        this.data = { version: REGISTRY_VERSION, instances: {} };
        return;
      }
      throw err;
    }
  }

  async save(): Promise<void> {
    const tmpPath = `${this.registryPath}.${randomUUID().slice(0, 8)}.tmp`;
    const content = JSON.stringify(this.data, null, 2) + "\n";
    await mkdir(dirname(this.registryPath), { recursive: true });
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, this.registryPath);
  }

  register(entry: InstanceRegistryEntry): void {
    this.data.instances[entry.name] = entry;
  }

  unregister(name: string): boolean {
    if (!(name in this.data.instances)) return false;
    delete this.data.instances[name];
    return true;
  }

  get(name: string): InstanceRegistryEntry | undefined {
    return this.data.instances[name];
  }

  list(): InstanceRegistryEntry[] {
    return Object.values(this.data.instances);
  }

  has(name: string): boolean {
    return name in this.data.instances;
  }

  updateStatus(name: string, status: InstanceRegistryEntry["status"]): void {
    const entry = this.data.instances[name];
    if (entry) {
      entry.status = status;
    }
  }

  async adopt(workspacePath: string, renameTo?: string): Promise<InstanceRegistryEntry> {
    const resolvedPath = resolve(workspacePath);
    const meta = await readInstanceMeta(resolvedPath);

    if (!meta.name || !meta.templateName) {
      throw new InstanceCorruptedError(
        resolvedPath,
        ".actant.json must have name and templateName",
      );
    }

    const name = renameTo ?? meta.name;
    if (this.has(name)) {
      throw new Error(`Instance name "${name}" already exists in registry`);
    }

    const rel = relative(resolve(this.builtinInstancesDir), resolvedPath);
    const isBuiltin = !rel.startsWith("..");
    const location: "builtin" | "external" = isBuiltin ? "builtin" : "external";

    const entry: InstanceRegistryEntry = {
      name,
      template: meta.templateName,
      workspacePath: resolvedPath,
      location,
      createdAt: meta.createdAt,
      status: mapMetaStatusToRegistry(meta.status),
    };

    this.register(entry);
    await this.save();
    return entry;
  }

  async reconcile(): Promise<{ orphaned: string[]; adopted: string[] }> {
    const orphaned: string[] = [];
    const adopted: string[] = [];

    for (const entry of this.list()) {
      try {
        const st = await stat(entry.workspacePath);
        if (!st.isDirectory()) {
          this.updateStatus(entry.name, "orphaned");
          orphaned.push(entry.name);
        }
      } catch {
        this.updateStatus(entry.name, "orphaned");
        orphaned.push(entry.name);
      }
    }

    let builtinEntries: string[];
    try {
      builtinEntries = await readdir(this.builtinInstancesDir);
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        builtinEntries = [];
      } else {
        throw err;
      }
    }

    for (const entry of builtinEntries) {
      if (entry.startsWith(".")) continue;
      const dirPath = join(this.builtinInstancesDir, entry);
      const dirStat = await stat(dirPath).catch(() => null);
      if (!dirStat?.isDirectory()) continue;

      const registered = this.list().some((e) => e.workspacePath === dirPath);
      if (registered) continue;

      try {
        const adoptedEntry = await this.adopt(dirPath);
        adopted.push(adoptedEntry.name);
      } catch {
        // Skip corrupted or invalid directories
      }
    }

    await this.save();
    return { orphaned, adopted };
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
