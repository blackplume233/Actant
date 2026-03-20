import {
  type SourceTrait,
  type SourceTypeDefinition,
  type VfsSourceRegistration,
  type VfsLifecycle,
  type VfsHandlerMap,
  type VfsFileContent,
  type VfsWriteResult,
  type VfsEntry,
  type VfsGrepResult,
  type VfsGrepMatch,
  type VfsListOptions,
  type VfsStatResult,
} from "@actant/shared";

export interface MemorySourceConfig {
  maxSize?: string;
  persistent?: boolean;
}

const MEMORY_TRAITS = new Set<SourceTrait>(["ephemeral", "writable"]);

interface MemoryFile {
  content: string;
  createdAt: number;
  updatedAt: number;
}

function createHandlers(
  files: Map<string, MemoryFile>,
  maxSizeBytes: number,
): VfsHandlerMap {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    const file = files.get(filePath);
    if (!file) throw new Error(`File not found: ${filePath}`);
    return { content: file.content };
  };

  handlers.write = async (filePath: string, content: string): Promise<VfsWriteResult> => {
    const totalSize = computeTotalSize(files) + Buffer.byteLength(content);
    const existing = files.get(filePath);
    if (existing) {
      const delta = Buffer.byteLength(content) - Buffer.byteLength(existing.content);
      if (computeTotalSize(files) + delta > maxSizeBytes) {
        throw new Error("Memory source size limit exceeded");
      }
    } else if (totalSize > maxSizeBytes) {
      throw new Error("Memory source size limit exceeded");
    }

    const existing2 = files.get(filePath);
    const created = !existing2;
    files.set(filePath, {
      content,
      createdAt: created ? Date.now() : existing2.createdAt,
      updatedAt: Date.now(),
    });
    return { bytesWritten: Buffer.byteLength(content), created };
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    const entries: VfsEntry[] = [];
    const dirs = new Set<string>();

    for (const [key, file] of files) {
      const parts = key.split("/");
      if (parts.length > 1) {
        const dir = parts[0] ?? "";
        if (!dirs.has(dir)) {
          dirs.add(dir);
          entries.push({ name: dir, path: dir, type: "directory" });
        }
      } else {
        entries.push({
          name: key,
          path: key,
          type: "file",
          size: Buffer.byteLength(file.content),
          mtime: new Date(file.updatedAt).toISOString(),
        });
      }
    }
    return entries;
  };

  handlers.stat = async (filePath: string): Promise<VfsStatResult> => {
    const file = files.get(filePath);
    if (file) {
      return {
        size: Buffer.byteLength(file.content),
        mtime: new Date(file.updatedAt).toISOString(),
        type: "file",
      };
    }

    const prefix = filePath ? `${filePath}/` : "";
    let latestMtime = 0;

    for (const [key, candidate] of files) {
      if (filePath === "" || key.startsWith(prefix)) {
        latestMtime = Math.max(latestMtime, candidate.updatedAt);
      }
    }

    if (filePath === "" || latestMtime > 0) {
      return {
        size: 0,
        mtime: new Date(latestMtime).toISOString(),
        type: "directory",
      };
    }

    throw new Error(`File not found: ${filePath}`);
  };

  handlers.grep = async (pattern: string): Promise<VfsGrepResult> => {
    const regex = new RegExp(pattern, "g");
    const matches: VfsGrepMatch[] = [];

    for (const [filePath, file] of files) {
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (regex.test(line)) {
          matches.push({ path: filePath, line: i + 1, content: line });
          regex.lastIndex = 0;
        }
      }
    }

    return { matches, totalMatches: matches.length, truncated: false };
  };

  return handlers;
}

function computeTotalSize(files: Map<string, MemoryFile>): number {
  let total = 0;
  for (const f of files.values()) total += Buffer.byteLength(f.content);
  return total;
}

function parseMaxSize(str?: string): number {
  if (!str) return 10 * 1024 * 1024;
  const match = str.match(/^(\d+)\s*(kb|mb|gb)?$/i);
  if (!match) return 10 * 1024 * 1024;
  const num = parseInt(match[1] ?? "0", 10);
  const unit = (match[2] ?? "mb").toLowerCase();
  const multipliers: Record<string, number> = { kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  return num * (multipliers[unit] ?? 1024 * 1024);
}

export const memorySourceFactory: SourceTypeDefinition<MemorySourceConfig> = {
  type: "memory",
  label: "memory",
  defaultTraits: MEMORY_TRAITS,

  create(spec: MemorySourceConfig, mountPoint: string, lifecycle: VfsLifecycle): VfsSourceRegistration {
    const files = new Map<string, MemoryFile>();
    const maxSize = parseMaxSize(spec.maxSize);
    const handlers = createHandlers(files, maxSize);

    return {
      name: "",
      mountPoint,
      label: "memory",
      traits: new Set(MEMORY_TRAITS),
      lifecycle,
      metadata: {
        description: "In-memory context store",
        virtual: true,
      },
      fileSchema: {},
      handlers,
    };
  },
};
