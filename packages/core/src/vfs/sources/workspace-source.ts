import * as fs from "node:fs/promises";
import * as path from "node:path";
import { existsSync } from "node:fs";
import {
  type VfsSourceRegistration,
  type VfsSourceFactory,
  type VfsSourceSpec,
  type VfsLifecycle,
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

type FilesystemSpec = Extract<VfsSourceSpec, { type: "filesystem" }>;

function resolveAbsolute(rootDir: string, relativePath: string): string {
  const resolved = path.resolve(rootDir, relativePath);
  if (!resolved.startsWith(rootDir)) {
    throw new Error(`Path traversal denied: ${relativePath}`);
  }
  return resolved;
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
    const sliced = lines.slice(start, end);

    return { content: sliced.join("\n") };
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
      const dirs = result.filter((e) => e.type === "directory");
      for (const dir of dirs) {
        const subEntries = await handlers.list!(dir.path, { ...opts, recursive: true });
        result.push(...subEntries);
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
          node.children.push(
            await buildNode(
              path.join(absPath, entry.name),
              relPath ? `${relPath}/${entry.name}` : entry.name,
              depth + 1,
            ),
          );
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
        } else {
          if (!opts?.type || opts.type === "file" || opts.type === "all") {
            if (matchGlobSimple(pattern, rel)) results.push(rel);
          }
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
        } else {
          if (opts?.glob && !matchGlobSimple(opts.glob, rel)) continue;
          try {
            const content = await fs.readFile(abs, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
              if (regex.test(lines[i]!)) {
                matches.push({
                  path: rel,
                  line: i + 1,
                  content: lines[i]!,
                });
                regex.lastIndex = 0;
              }
            }
          } catch {
            // Skip binary/unreadable files
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

function matchGlobSimple(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${regexStr}$`).test(filePath);
}

export const workspaceSourceFactory: VfsSourceFactory<FilesystemSpec> = {
  type: "filesystem",

  validate(spec: FilesystemSpec) {
    if (!spec.path) return { valid: false, errors: ["path is required"] };
    return { valid: true };
  },

  create(spec: FilesystemSpec, mountPoint: string, lifecycle: VfsLifecycle): VfsSourceRegistration {
    const rootDir = path.resolve(spec.path);
    const readOnly = spec.readOnly ?? false;
    const handlers = createHandlers(rootDir, readOnly);

    return {
      name: "",
      mountPoint,
      sourceType: "filesystem",
      lifecycle,
      metadata: {
        description: `Workspace: ${rootDir}`,
        readOnly,
      },
      fileSchema: {},
      handlers,
    };
  },
};
