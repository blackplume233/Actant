import type {
  VfsFeature,
  VfsMountRegistration,
  VfsLifecycle,
  VfsFileContent,
  VfsEntry,
  VfsStatResult,
  VfsListOptions,
} from "@actant/shared";
import type { ContextSource, ContextSourceType } from "../types";

const PROJECT_SOURCE_FEATURES = new Set<VfsFeature>(["persistent", "virtual"]);

/**
 * Structured project overview produced by ProjectSource implementations.
 */
export interface ProjectOverview {
  name: string;
  engine?: string;
  engineVersion?: string;
  modules: ProjectModule[];
  plugins?: string[];
  platforms?: string[];
  [key: string]: unknown;
}

export interface ProjectModule {
  name: string;
  path: string;
  classCount?: number;
  description?: string;
}

export interface ProjectConfig {
  name: string;
  content: string;
}

export interface ProjectChanges {
  summary: string;
  files: string[];
}

/**
 * Abstract base class for project-type ContextSources.
 *
 * Subclasses implement `scan()` to populate the project data structures,
 * then `toVfsMounts()` creates a read-only VFS projection:
 *
 * ```
 * /project/
 * ├── overview.json          → project name, engine, modules, plugins
 * ├── modules/
 * │   ├── <Module>/
 * │   │   └── _summary.json  → class count, key files, public API
 * ├── config/
 * │   ├── <ConfigFile>       → structured config content
 * └── changes.json           → git diff summary (optional)
 * ```
 */
export abstract class ProjectSource implements ContextSource {
  readonly type: ContextSourceType = "project";

  abstract readonly name: string;

  protected overview: ProjectOverview | null = null;
  protected modules: Map<string, ProjectModule> = new Map();
  protected configs: Map<string, ProjectConfig> = new Map();
  protected changes: ProjectChanges | null = null;
  protected lastScanTime: Date | null = null;

  constructor(
    protected readonly projectRoot: string,
    protected readonly lifecycle: VfsLifecycle = { type: "daemon" },
  ) {}

  /**
   * Scan the project directory and populate internal data structures.
   * Called lazily on first `toVfsMounts()` or explicitly before mounting.
   */
  abstract scan(): Promise<void>;

  async hasChanged(since: Date): Promise<boolean> {
    if (!this.lastScanTime) return true;
    return this.lastScanTime > since;
  }

  toVfsMounts(mountPrefix: string): VfsMountRegistration[] {
    const prefix = mountPrefix || "";
    const mountPoint = `${prefix}/project`;

    return [
      {
        name: `project-${this.name}`,
        mountPoint,
        label: "project",
        features: new Set(PROJECT_SOURCE_FEATURES),
        lifecycle: this.lifecycle,
        metadata: {
          description: `Project context: ${this.overview?.name ?? this.name}`,
          virtual: true,
        },
        fileSchema: {},
        handlers: {
          read: async (filePath: string): Promise<VfsFileContent> => {
            if (!this.overview) await this.scan();
            return this.handleRead(filePath);
          },
          list: async (dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
            if (!this.overview) await this.scan();
            return this.handleList(dirPath);
          },
          stat: async (filePath: string): Promise<VfsStatResult> => {
            if (!this.overview) await this.scan();
            return this.handleStat(filePath);
          },
        },
      },
    ];
  }

  private handleRead(filePath: string): VfsFileContent {
    const normalized = filePath.replace(/^\/+/, "");

    if (normalized === "overview.json" || normalized === "") {
      return {
        content: JSON.stringify(this.overview, null, 2),
        mimeType: "application/json",
      };
    }

    if (normalized === "changes.json") {
      if (!this.changes) throw new Error("No changes data available");
      return {
        content: JSON.stringify(this.changes, null, 2),
        mimeType: "application/json",
      };
    }

    if (normalized.startsWith("modules/")) {
      const rest = normalized.slice("modules/".length);
      const parts = rest.split("/");
      const moduleName = parts[0];
      const file = parts[1];

      if (!moduleName) {
        const list = Array.from(this.modules.values()).map((m) => ({
          name: m.name,
          path: m.path,
          classCount: m.classCount,
        }));
        return { content: JSON.stringify(list, null, 2), mimeType: "application/json" };
      }

      const mod = this.modules.get(moduleName);
      if (!mod) throw new Error(`Module not found: ${moduleName}`);

      if (!file || file === "_summary.json") {
        return { content: JSON.stringify(mod, null, 2), mimeType: "application/json" };
      }

      throw new Error(`Unknown module file: ${file}`);
    }

    if (normalized.startsWith("config/")) {
      const configName = normalized.slice("config/".length);
      const config = this.configs.get(configName);
      if (!config) throw new Error(`Config not found: ${configName}`);
      return { content: config.content, mimeType: "text/plain" };
    }

    throw new Error(`Unknown path: ${normalized}`);
  }

  private handleList(dirPath: string): VfsEntry[] {
    const normalized = dirPath.replace(/^\/+/, "").replace(/\/+$/, "");

    if (normalized === "" || normalized === ".") {
      const entries: VfsEntry[] = [
        { name: "overview.json", path: "overview.json", type: "file" },
        { name: "modules", path: "modules", type: "directory" },
      ];
      if (this.configs.size > 0) {
        entries.push({ name: "config", path: "config", type: "directory" });
      }
      if (this.changes) {
        entries.push({ name: "changes.json", path: "changes.json", type: "file" });
      }
      return entries;
    }

    if (normalized === "modules") {
      return Array.from(this.modules.keys()).map((name) => ({
        name,
        path: `modules/${name}`,
        type: "directory" as const,
      }));
    }

    if (normalized.startsWith("modules/")) {
      const moduleName = normalized.slice("modules/".length);
      const mod = this.modules.get(moduleName);
      if (!mod) throw new Error(`Module not found: ${moduleName}`);
      return [
        { name: "_summary.json", path: `modules/${moduleName}/_summary.json`, type: "file" },
      ];
    }

    if (normalized === "config") {
      return Array.from(this.configs.keys()).map((name) => ({
        name,
        path: `config/${name}`,
        type: "file" as const,
      }));
    }

    throw new Error(`Unknown directory: ${normalized}`);
  }

  private handleStat(filePath: string): VfsStatResult {
    const normalized = filePath.replace(/^\/+/, "");
    const isDir = normalized === "" || normalized === "modules" || normalized === "config" ||
      (normalized.startsWith("modules/") && !normalized.includes("_summary"));
    return {
      size: 0,
      type: isDir ? "directory" : "file",
      mtime: this.lastScanTime?.toISOString() ?? new Date().toISOString(),
    };
  }
}
