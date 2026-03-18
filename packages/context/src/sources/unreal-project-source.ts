import { readdir, readFile, stat as fsStat } from "node:fs/promises";
import { join, basename, dirname, relative } from "node:path";
import type { VfsLifecycle } from "@actant/shared";
import { ProjectSource, type ProjectModule, type ProjectConfig } from "./project-source";

const IGNORED_DIRS = new Set([
  "Intermediate",
  "Saved",
  "Binaries",
  "DerivedDataCache",
  ".vs",
  ".git",
  "node_modules",
  "__ExternalActors__",
  "__ExternalObjects__",
]);

/**
 * A ProjectSource specialized for Unreal Engine projects.
 *
 * Scans a UE project directory to extract:
 * - Project overview from .uproject
 * - Modules from *.Build.cs files
 * - Plugins from *.uplugin files
 * - Config from Config/*.ini files
 *
 * VFS layout:
 * ```
 * /project/
 * ├── overview.json          → name, engineVersion, modules, plugins, platforms
 * ├── modules/
 * │   ├── Characters/
 * │   │   └── _summary.json  → { name, path, classCount, headerFiles }
 * │   └── Gameplay/
 * │       └── _summary.json
 * ├── config/
 * │   ├── DefaultEngine.ini
 * │   └── DefaultGame.ini
 * └── changes.json           → (optional) git changes
 * ```
 */
export class UnrealProjectSource extends ProjectSource {
  readonly name = "unreal-project";

  constructor(
    projectRoot: string,
    lifecycle?: VfsLifecycle,
  ) {
    super(projectRoot, lifecycle);
  }

  async scan(): Promise<void> {
    const uprojectPath = await this.findUproject();
    const uprojectContent = await readFile(uprojectPath, "utf-8");
    const uproject = JSON.parse(uprojectContent) as UProjectFile;

    const modules = await this.discoverModules();
    const plugins = await this.discoverPlugins();
    const configs = await this.discoverConfigs();

    this.modules = new Map(modules.map((m) => [m.name, m]));
    this.configs = new Map(configs.map((c) => [c.name, c]));

    this.overview = {
      name: basename(uprojectPath, ".uproject"),
      engine: "UnrealEngine",
      engineVersion: uproject.EngineAssociation,
      modules: modules,
      plugins: plugins,
      platforms: uproject.TargetPlatforms,
      description: uproject.Description,
      category: uproject.Category,
    };

    this.lastScanTime = new Date();
  }

  private async findUproject(): Promise<string> {
    const entries = await readdir(this.projectRoot);
    const uprojectFile = entries.find((e) => e.endsWith(".uproject"));
    if (!uprojectFile) {
      throw new Error(`No .uproject file found in ${this.projectRoot}`);
    }
    return join(this.projectRoot, uprojectFile);
  }

  private async discoverModules(): Promise<ProjectModule[]> {
    const modules: ProjectModule[] = [];
    const sourceDir = join(this.projectRoot, "Source");

    if (!(await dirExists(sourceDir))) return modules;

    const buildFiles = await findFilesRecursive(sourceDir, ".Build.cs", 3);

    for (const buildFile of buildFiles) {
      const moduleName = basename(buildFile, ".Build.cs");
      const moduleDir = dirname(buildFile);
      const relPath = relative(this.projectRoot, moduleDir);

      const headerCount = await countFilesByExtension(moduleDir, [".h", ".hpp"]);

      modules.push({
        name: moduleName,
        path: relPath,
        classCount: headerCount,
        description: `UE Module: ${moduleName}`,
      });
    }

    return modules;
  }

  private async discoverPlugins(): Promise<string[]> {
    const plugins: string[] = [];
    const pluginsDir = join(this.projectRoot, "Plugins");

    if (!(await dirExists(pluginsDir))) return plugins;

    const upluginFiles = await findFilesRecursive(pluginsDir, ".uplugin", 2);
    for (const f of upluginFiles) {
      plugins.push(basename(f, ".uplugin"));
    }

    return plugins;
  }

  private async discoverConfigs(): Promise<ProjectConfig[]> {
    const configs: ProjectConfig[] = [];
    const configDir = join(this.projectRoot, "Config");

    if (!(await dirExists(configDir))) return configs;

    const entries = await readdir(configDir);
    for (const entry of entries) {
      if (!entry.endsWith(".ini")) continue;
      const fullPath = join(configDir, entry);
      const s = await fsStat(fullPath);
      if (!s.isFile()) continue;
      if (s.size > 256 * 1024) continue;

      const content = await readFile(fullPath, "utf-8");
      configs.push({ name: entry, content });
    }

    return configs;
  }
}

interface UProjectFile {
  EngineAssociation?: string;
  Description?: string;
  Category?: string;
  TargetPlatforms?: string[];
  Modules?: Array<{ Name: string; Type: string; LoadingPhase: string }>;
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await fsStat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function findFilesRecursive(
  dir: string,
  suffix: string,
  maxDepth: number,
  depth = 0,
): Promise<string[]> {
  if (depth > maxDepth) return [];

  const results: string[] = [];
  let entries: string[];

  try {
    entries = await readdir(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    let s;
    try {
      s = await fsStat(fullPath);
    } catch {
      continue;
    }

    if (s.isFile() && entry.endsWith(suffix)) {
      results.push(fullPath);
    } else if (s.isDirectory()) {
      const sub = await findFilesRecursive(fullPath, suffix, maxDepth, depth + 1);
      results.push(...sub);
    }
  }

  return results;
}

async function countFilesByExtension(
  dir: string,
  extensions: string[],
): Promise<number> {
  let count = 0;
  const extSet = new Set(extensions);

  async function walk(d: string, depth: number): Promise<void> {
    if (depth > 5) return;
    let entries: string[];
    try {
      entries = await readdir(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry)) continue;
      const fullPath = join(d, entry);
      let s;
      try {
        s = await fsStat(fullPath);
      } catch {
        continue;
      }
      if (s.isFile()) {
        for (const ext of extSet) {
          if (entry.endsWith(ext)) {
            count++;
            break;
          }
        }
      } else if (s.isDirectory()) {
        await walk(fullPath, depth + 1);
      }
    }
  }

  await walk(dir, 0);
  return count;
}
