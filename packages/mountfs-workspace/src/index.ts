import * as fs from "node:fs/promises";
import * as path from "node:path";
import { existsSync } from "node:fs";
import {
  type VfsFeature,
  type FilesystemTypeDefinition,
  type VfsLifecycle,
  type VfsMountRegistration,
  type VfsHandlerMap,
  type VfsFileContent,
  type VfsWriteResult,
  type VfsEditResult,
  type VfsEntry,
  type VfsStatResult,
  type VfsTreeNode,
  type VfsListOptions,
  type VfsTreeOptions,
  type VfsGlobOptions,
  type VfsGrepResult,
  type VfsGrepOptions,
  type VfsGrepMatch,
} from "@actant/shared";

export interface WorkspaceMountfsConfig {
  path: string;
  readOnly?: boolean;
  watchEnabled?: boolean;
}

const WORKSPACE_TRAITS = new Set<VfsFeature>(["persistent", "writable", "watchable"]);

function resolveAbsolute(rootDir: string, relativePath: string): string {
  const resolved = path.resolve(rootDir, relativePath);
  if (!resolved.startsWith(rootDir)) {
    throw new Error(`Path traversal denied: ${relativePath}`);
  }
  return resolved;
}

function matchGlobSimple(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
  return regex.test(value);
}

function createHandlers(rootDir: string, readOnly: boolean): VfsHandlerMap {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const abs = resolveAbsolute(rootDir, filePath);
    const content = await fs.readFile(abs, "utf-8");
    return { content };
  };

  handlers.read_range = async (
    filePath: string,
    startLine: number,
    endLine?: number,
  ): Promise<VfsFileContent> => {
    const abs = resolveAbsolute(rootDir, filePath);
    const content = await fs.readFile(abs, "utf-8");
    const lines = content.split("\n");
    const start = startLine < 0 ? Math.max(0, lines.length + startLine) : startLine - 1;
    const end = endLine != null ? endLine : lines.length;
    return { content: lines.slice(start, end).join("\n") };
  };

  if (!readOnly) {
    handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
      const abs = resolveAbsolute(rootDir, filePath);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      const existed = existsSync(abs);
      await fs.writeFile(abs, content, "utf-8");
      return { bytesWritten: Buffer.byteLength(content), created: !existed };
    };

    handlers.edit = async (
      filePath: string,
      oldStr: string,
      newStr: string,
      replaceAll?: boolean,
    ): Promise<VfsEditResult> => {
      const abs = resolveAbsolute(rootDir, filePath);
      let content = await fs.readFile(abs, "utf-8");
      let replacements = 0;

      if (replaceAll) {
        const parts = content.split(oldStr);
        replacements = parts.length - 1;
        content = parts.join(newStr);
      } else {
        const idx = content.indexOf(oldStr);
        if (idx >= 0) {
          content = content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
          replacements = 1;
        }
      }

      if (replacements > 0) {
        await fs.writeFile(abs, content, "utf-8");
      }
      return { replacements };
    };

    handlers.delete = async (filePath: string): Promise<void> => {
      const abs = resolveAbsolute(rootDir, filePath);
      await fs.unlink(abs);
    };
  }

  handlers.list = async (dirPath: string, opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const abs = resolveAbsolute(rootDir, dirPath || ".");
    const entries = await fs.readdir(abs, { withFileTypes: true });
    const result: VfsEntry[] = [];

    for (const entry of entries) {
      if (!opts?.showHidden && entry.name.startsWith(".")) continue;
      const entryPath = path.join(dirPath || "", entry.name);
      const item: VfsEntry = {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
      };
      if (opts?.long) {
        const stat = await fs.stat(path.join(abs, entry.name));
        item.size = stat.size;
        item.mtime = stat.mtime.toISOString();
      }
      result.push(item);
    }

    if (opts?.recursive) {
      for (const dir of result.filter((entry) => entry.type === "directory")) {
        const listHandler = handlers.list;
        if (!listHandler) continue;
        result.push(...await listHandler(dir.path, { ...opts, recursive: true }));
      }
    }

    return result;
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const abs = resolveAbsolute(rootDir, filePath);
    const stat = await fs.stat(abs);
    return {
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      type: stat.isDirectory() ? "directory" : stat.isSymbolicLink() ? "symlink" : "file",
    };
  };

  handlers.tree = async (dirPath: string, opts?: VfsTreeOptions): Promise<VfsTreeNode> => {
    const abs = resolveAbsolute(rootDir, dirPath || ".");
    const maxDepth = opts?.depth ?? 5;

    async function buildNode(absPath: string, relPath: string, depth: number): Promise<VfsTreeNode> {
      const stat = await fs.stat(absPath);
      const node: VfsTreeNode = {
        name: path.basename(absPath) || relPath,
        path: relPath,
        type: stat.isDirectory() ? "directory" : "file",
      };

      if (stat.isDirectory() && depth < maxDepth) {
        const entries = await fs.readdir(absPath, { withFileTypes: true });
        node.children = [];
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          if (opts?.pattern && !entry.isDirectory() && !entry.name.includes(opts.pattern)) continue;
          node.children.push(await buildNode(
            path.join(absPath, entry.name),
            relPath ? `${relPath}/${entry.name}` : entry.name,
            depth + 1,
          ));
        }
      }

      return node;
    }

    return buildNode(abs, dirPath || "", 0);
  };

  handlers.glob = async (pattern: string, opts?: VfsGlobOptions): Promise<string[]> => {
    const cwd = opts?.cwd ? resolveAbsolute(rootDir, opts.cwd) : rootDir;
    const results: string[] = [];

    async function walk(dir: string, relDir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const abs = path.join(dir, entry.name);
        const rel = relDir ? `${relDir}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (!opts?.type || opts.type === "directory" || opts.type === "all") {
            if (matchGlobSimple(pattern, rel)) results.push(rel);
          }
          await walk(abs, rel);
        } else if (!opts?.type || opts.type === "file" || opts.type === "all") {
          if (matchGlobSimple(pattern, rel)) results.push(rel);
        }
      }
    }

    await walk(cwd, "");
    return results;
  };

  handlers.grep = async (pattern: string, opts?: VfsGrepOptions): Promise<VfsGrepResult> => {
    const regex = new RegExp(pattern, opts?.caseInsensitive ? "gi" : "g");
    const matches: VfsGrepMatch[] = [];
    const maxResults = opts?.maxResults ?? 1000;

    async function searchDir(dir: string, relDir: string): Promise<void> {
      if (matches.length >= maxResults) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (matches.length >= maxResults) return;
        if (entry.name.startsWith(".")) continue;

        const abs = path.join(dir, entry.name);
        const rel = relDir ? `${relDir}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await searchDir(abs, rel);
          continue;
        }

        if (opts?.glob && !matchGlobSimple(opts.glob, rel)) {
          continue;
        }

        const content = await fs.readFile(abs, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          if (regex.test(line)) {
            matches.push({ path: rel, line: i + 1, content: line });
            regex.lastIndex = 0;
            if (matches.length >= maxResults) break;
          }
        }
      }
    }

    await searchDir(rootDir, "");
    return {
      matches,
      totalMatches: matches.length,
      truncated: matches.length >= maxResults,
    };
  };

  return handlers;
}

export const workspaceSourceFactory: FilesystemTypeDefinition<WorkspaceMountfsConfig> = {
  type: "workspace",
  label: "workspace",
  defaultFeatures: WORKSPACE_TRAITS,
  create(spec: WorkspaceMountfsConfig, mountPoint: string, lifecycle: VfsLifecycle): VfsMountRegistration {
    const rootDir = path.resolve(spec.path);
    const readOnly = spec.readOnly ?? false;
    return {
      name: "",
      mountPoint,
      label: "workspace",
      features: new Set(readOnly ? ["persistent", "watchable"] : WORKSPACE_TRAITS),
      lifecycle,
      metadata: {
        description: `Workspace root: ${rootDir}`,
        filesystemType: "hostfs",
        mountType: mountPoint === "/" ? "root" : "direct",
        readOnly,
      },
      fileSchema: {},
      handlers: createHandlers(rootDir, readOnly),
    };
  },
};
